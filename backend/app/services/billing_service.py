"""Automated monthly billing from water meter readings.

Mirrors the landlord's paper sheet: one row per unit, water units computed from
meter readings, plus garbage and rent. Unpaid balance carries forward as arrears.
"""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.meter_reading import MeterReading
from app.models.property import Property
from app.models.tenant import Tenant
from app.models.unit import Unit
from app.schemas.billing_schema import BulkReadingsRequest, PaymentUpdate
from app.services.property_service import get_property_by_id


def _dec(v) -> Decimal:
    return Decimal(str(v or 0))


def _prev_period(period: str) -> str:
    year, month = map(int, period.split("-"))
    if month == 1:
        return f"{year - 1}-12"
    return f"{year}-{month - 1:02d}"


def _tenant_for_unit(db: Session, unit_id: int) -> Tenant | None:
    return db.query(Tenant).filter(Tenant.unit_id == unit_id).first()


def _prior_balance(db: Session, unit_id: int, period: str) -> Decimal:
    """Outstanding balance carried in from the previous month."""
    last = (
        db.query(MeterReading)
        .filter(MeterReading.unit_id == unit_id, MeterReading.period == _prev_period(period))
        .first()
    )
    if not last:
        return Decimal("0")
    return _dec(last.balance)


def get_statement(db: Session, property_id: int, owner_id: int, period: str) -> dict | None:
    prop = get_property_by_id(db, property_id, owner_id)
    if not prop:
        return None

    units = (
        db.query(Unit)
        .filter(Unit.property_id == property_id, Unit.is_unused.is_(False))
        .order_by(Unit.unit_number)
        .all()
    )
    water_rate = _dec(prop.water_rate_per_unit if prop.water_rate_per_unit is not None else 150)
    garbage = _dec(prop.garbage_fee if prop.garbage_fee is not None else 200)
    prev = _prev_period(period)

    lines = []
    for unit in units:
        tenant = _tenant_for_unit(db, unit.id)

        existing = (
            db.query(MeterReading)
            .filter(MeterReading.unit_id == unit.id, MeterReading.period == period)
            .first()
        )
        if existing:
            lines.append(_line_from_reading(existing, unit.unit_number, tenant))
            continue

        last = (
            db.query(MeterReading)
            .filter(MeterReading.unit_id == unit.id, MeterReading.period == prev)
            .first()
        )
        previous = _dec(last.current_reading) if last else Decimal("0")
        arrears = _dec(last.balance) if last else Decimal("0")
        rent = _dec(unit.rent_amount)
        total_due = garbage + rent

        lines.append(
            {
                "id": None,
                "unit_id": unit.id,
                "unit_number": unit.unit_number,
                "tenant_id": tenant.id if tenant else None,
                "tenant_name": tenant.name if tenant else None,
                "tenant_phone": tenant.phone if tenant else None,
                "period": period,
                "previous_reading": float(previous),
                "current_reading": float(previous),
                "water_units": 0.0,
                "water_cost": 0.0,
                "garbage_fee": float(garbage),
                "rent_amount": float(rent),
                "total_due": float(total_due),
                "arrears": float(arrears),
                "amount_paid": 0.0,
                "balance": float(arrears + total_due),
            }
        )

    return {
        "property_id": property_id,
        "period": period,
        "water_rate_per_unit": float(water_rate),
        "garbage_fee": float(garbage),
        "main_meter_reading": float(prop.main_meter_reading) if prop.main_meter_reading is not None else None,
        "lines": lines,
        "totals": _totals(lines),
    }


def upsert_readings(
    db: Session, property_id: int, owner_id: int, period: str, data: BulkReadingsRequest
) -> dict | None:
    prop = get_property_by_id(db, property_id, owner_id)
    if not prop:
        return None

    water_rate = _dec(prop.water_rate_per_unit if prop.water_rate_per_unit is not None else 150)
    garbage_default = _dec(prop.garbage_fee if prop.garbage_fee is not None else 200)
    prev_period = _prev_period(period)

    if data.main_meter_reading is not None:
        prop.main_meter_reading = data.main_meter_reading

    for item in data.readings:
        unit = (
            db.query(Unit)
            .filter(Unit.id == item.unit_id, Unit.property_id == property_id, Unit.is_unused.is_(False))
            .first()
        )
        if not unit:
            raise ValueError(f"Unit {item.unit_id} not found on this property")

        last = (
            db.query(MeterReading)
            .filter(MeterReading.unit_id == unit.id, MeterReading.period == prev_period)
            .first()
        )

        previous = _dec(item.previous_reading) if item.previous_reading is not None else (
            _dec(last.current_reading) if last else Decimal("0")
        )

        current = _dec(item.current_reading)
        if current < previous:
            raise ValueError(f"Current reading for {unit.unit_number} cannot be less than previous")

        water_units = current - previous
        water_cost = water_units * water_rate
        garbage = garbage_default
        rent = _dec(unit.rent_amount)
        total_due = water_cost + garbage + rent
        arrears = _dec(last.balance) if last else Decimal("0")
        amount_paid = _dec(item.amount_paid) if item.amount_paid is not None else Decimal("0")

        existing = (
            db.query(MeterReading)
            .filter(MeterReading.unit_id == unit.id, MeterReading.period == period)
            .first()
        )
        if existing and item.amount_paid is None:
            amount_paid = _dec(existing.amount_paid)

        balance = arrears + total_due - amount_paid

        if existing:
            existing.previous_reading = previous
            existing.current_reading = current
            existing.water_units = water_units
            existing.water_cost = water_cost
            existing.garbage_fee = garbage
            existing.rent_amount = rent
            existing.total_due = total_due
            existing.arrears = arrears
            existing.amount_paid = amount_paid
            existing.balance = balance
        else:
            db.add(
                MeterReading(
                    unit_id=unit.id,
                    period=period,
                    previous_reading=previous,
                    current_reading=current,
                    water_units=water_units,
                    water_cost=water_cost,
                    garbage_fee=garbage,
                    rent_amount=rent,
                    total_due=total_due,
                    arrears=arrears,
                    amount_paid=amount_paid,
                    balance=balance,
                )
            )

    db.commit()
    return get_statement(db, property_id, owner_id, period)


def record_payment(db: Session, reading_id: int, owner_id: int, data: PaymentUpdate) -> MeterReading | None:
    reading = (
        db.query(MeterReading)
        .join(Unit, Unit.id == MeterReading.unit_id)
        .join(Property, Property.id == Unit.property_id)
        .filter(MeterReading.id == reading_id, Property.owner_id == owner_id)
        .first()
    )
    if not reading:
        return None
    reading.amount_paid = _dec(data.amount_paid)
    reading.balance = _dec(reading.arrears) + _dec(reading.total_due) - reading.amount_paid
    db.commit()
    db.refresh(reading)
    return reading


def list_periods(db: Session, property_id: int, owner_id: int) -> list[str] | None:
    prop = get_property_by_id(db, property_id, owner_id)
    if not prop:
        return None
    rows = (
        db.query(MeterReading.period)
        .join(Unit, Unit.id == MeterReading.unit_id)
        .filter(Unit.property_id == property_id)
        .distinct()
        .order_by(MeterReading.period.desc())
        .all()
    )
    return [r[0] for r in rows]


def tenant_ledger(db: Session, unit_id: int, owner_id: int) -> list[dict] | None:
    """Full payment history for one unit, newest first."""
    unit = (
        db.query(Unit)
        .join(Property, Property.id == Unit.property_id)
        .filter(Unit.id == unit_id, Property.owner_id == owner_id)
        .first()
    )
    if not unit:
        return None
    tenant = _tenant_for_unit(db, unit_id)
    rows = (
        db.query(MeterReading)
        .filter(MeterReading.unit_id == unit_id)
        .order_by(MeterReading.period.desc())
        .all()
    )
    return [_line_from_reading(r, unit.unit_number, tenant) for r in rows]


def _line_from_reading(r: MeterReading, unit_number: str, tenant: Tenant | None = None) -> dict:
    return {
        "id": r.id,
        "unit_id": r.unit_id,
        "unit_number": unit_number,
        "tenant_id": tenant.id if tenant else None,
        "tenant_name": tenant.name if tenant else None,
        "tenant_phone": tenant.phone if tenant else None,
        "period": r.period,
        "previous_reading": float(r.previous_reading),
        "current_reading": float(r.current_reading),
        "water_units": float(r.water_units),
        "water_cost": float(r.water_cost),
        "garbage_fee": float(r.garbage_fee),
        "rent_amount": float(r.rent_amount),
        "total_due": float(r.total_due),
        "arrears": float(getattr(r, "arrears", 0) or 0),
        "amount_paid": float(r.amount_paid),
        "balance": float(r.balance),
    }


def _totals(lines: list[dict]) -> dict:
    keys = [
        "water_units",
        "water_cost",
        "garbage_fee",
        "rent_amount",
        "total_due",
        "arrears",
        "amount_paid",
        "balance",
    ]
    return {k: float(sum(_dec(line.get(k, 0)) for line in lines)) for k in keys}
