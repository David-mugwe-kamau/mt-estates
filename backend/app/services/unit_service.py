"""Unit management business logic."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.tenant import Tenant
from app.models.unit import Unit
from app.schemas.unit_schema import UnitCreate, UnitUpdate


def _visible():
    return Unit.is_unused.is_(False)


def create_unit(db: Session, owner_id: int, data: UnitCreate) -> Unit:
    """Add a unit to a property. Verifies property belongs to owner."""
    prop = db.query(Property).filter(
        Property.id == data.property_id,
        Property.owner_id == owner_id,
        Property.is_unused.is_(False),
    ).first()
    if not prop:
        raise ValueError("Property not found or access denied")
    if data.unit_type_id:
        from app.models.unit_type import UnitType

        ut = (
            db.query(UnitType)
            .filter(UnitType.id == data.unit_type_id, UnitType.property_id == data.property_id)
            .first()
        )
        if not ut:
            raise ValueError("Apartment type not found on this listing")
    unit = Unit(
        property_id=data.property_id,
        unit_number=data.unit_number,
        rent_amount=data.rent_amount,
        status=data.status,
        unit_type_id=data.unit_type_id,
        is_unused=False,
        unused_at=None,
    )
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


def list_units_by_property(
    db: Session,
    property_id: int,
    owner_id: int,
) -> list[Unit]:
    """List visible units for a property. Verifies property belongs to owner."""
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.owner_id == owner_id,
        Property.is_unused.is_(False),
    ).first()
    if not prop:
        return []
    return (
        db.query(Unit)
        .filter(Unit.property_id == property_id, _visible())
        .order_by(Unit.unit_number)
        .all()
    )


def list_units_by_owner(db: Session, owner_id: int) -> list[Unit]:
    """List all visible units across all properties of the owner."""
    return (
        db.query(Unit)
        .join(Property)
        .filter(Property.owner_id == owner_id, _visible())
        .order_by(Unit.unit_number)
        .all()
    )


def get_unit_by_id(db: Session, unit_id: int, owner_id: int) -> Unit | None:
    """Get a visible unit by id if it belongs to owner's property."""
    return (
        db.query(Unit)
        .join(Property)
        .filter(Unit.id == unit_id, Property.owner_id == owner_id, _visible())
        .first()
    )


def update_unit(
    db: Session,
    unit_id: int,
    owner_id: int,
    data: UnitUpdate,
) -> Unit | None:
    """Update unit number/status/rent. Returns updated unit or None if not found."""
    unit = get_unit_by_id(db, unit_id, owner_id)
    if not unit:
        return None
    if data.unit_number is not None:
        unit.unit_number = data.unit_number
    if data.status is not None:
        unit.status = data.status
    if data.rent_amount is not None:
        unit.rent_amount = data.rent_amount
    if data.unit_type_id is not None:
        if data.unit_type_id:
            from app.models.unit_type import UnitType

            ut = (
                db.query(UnitType)
                .filter(UnitType.id == data.unit_type_id, UnitType.property_id == unit.property_id)
                .first()
            )
            if not ut:
                raise ValueError("Apartment type not found on this listing")
        unit.unit_type_id = data.unit_type_id
    db.commit()
    db.refresh(unit)
    return unit


def hide_unit(db: Session, unit_id: int, owner_id: int) -> bool:
    """Landlord remove — soft-hide as unused (not permanently deleted)."""
    unit = get_unit_by_id(db, unit_id, owner_id)
    if not unit:
        return False

    if unit.status == "occupied":
        raise ValueError("Cannot remove an occupied unit. Mark it vacant or move the tenant first.")

    tenant = db.query(Tenant).filter(Tenant.unit_id == unit_id).first()
    if tenant:
        raise ValueError("Cannot remove a unit that still has a tenant assigned.")

    unit.is_unused = True
    unit.unused_at = datetime.now(timezone.utc)
    db.commit()
    return True


def list_unused_units(db: Session) -> list[Unit]:
    return (
        db.query(Unit)
        .filter(Unit.is_unused.is_(True))
        .order_by(Unit.unused_at.desc().nullslast(), Unit.id.desc())
        .all()
    )


def restore_unused_unit(db: Session, unit_id: int) -> Unit | None:
    unit = db.query(Unit).filter(Unit.id == unit_id, Unit.is_unused.is_(True)).first()
    if not unit:
        return None
    unit.is_unused = False
    unit.unused_at = None
    db.commit()
    db.refresh(unit)
    return unit


def purge_unused_unit(db: Session, unit_id: int) -> bool:
    """Platform admin permanent delete of an unused unit."""
    unit = db.query(Unit).filter(Unit.id == unit_id, Unit.is_unused.is_(True)).first()
    if not unit:
        return False
    db.delete(unit)
    db.commit()
    return True
