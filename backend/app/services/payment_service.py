"""Rent payment business logic."""
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.rent_payment import RentPayment
from app.models.tenant import Tenant
from app.models.unit import Unit
from app.models.property import Property
from app.schemas.payment_schema import PaymentCreate


def create_payment(db: Session, owner_id: int, data: PaymentCreate) -> RentPayment:
    """Record a rent payment. Verifies tenant belongs to owner."""
    tenant = (
        db.query(Tenant)
        .join(Unit)
        .join(Property)
        .filter(Tenant.id == data.tenant_id, Property.owner_id == owner_id)
        .first()
    )
    if not tenant:
        raise ValueError("Tenant not found or access denied")
    payment = RentPayment(
        tenant_id=data.tenant_id,
        amount=data.amount,
        payment_date=data.payment_date,
        payment_method=data.payment_method,
        status=data.status,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def list_payments_by_owner(db: Session, owner_id: int) -> list[RentPayment]:
    """List all rent payments for owner's tenants."""
    return (
        db.query(RentPayment)
        .join(Tenant)
        .join(Unit)
        .join(Property)
        .filter(Property.owner_id == owner_id)
        .order_by(RentPayment.payment_date.desc())
        .all()
    )


def get_rent_collected_by_owner(db: Session, owner_id: int) -> Decimal:
    """Sum of all paid rent for owner's tenants."""
    result = (
        db.query(func.coalesce(func.sum(RentPayment.amount), 0))
        .join(Tenant)
        .join(Unit)
        .join(Property)
        .filter(Property.owner_id == owner_id, RentPayment.status == "paid")
        .scalar()
    )
    return result or Decimal("0")
