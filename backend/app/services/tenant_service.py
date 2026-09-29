"""Tenant management business logic."""
from sqlalchemy.orm import Session

from app.models.tenant import Tenant
from app.models.unit import Unit
from app.models.property import Property
from app.schemas.tenant_schema import TenantCreate


def create_tenant(db: Session, owner_id: int, data: TenantCreate) -> Tenant:
    """Add a tenant and assign to unit. Verifies unit belongs to owner."""
    unit = (
        db.query(Unit)
        .join(Property)
        .filter(Unit.id == data.unit_id, Property.owner_id == owner_id)
        .first()
    )
    if not unit:
        raise ValueError("Unit not found or access denied")
    if unit.tenant is not None:
        raise ValueError("Unit is already occupied")
    tenant = Tenant(
        name=data.name,
        phone=data.phone,
        email=data.email,
        national_id=data.national_id,
        unit_id=data.unit_id,
        lease_start=data.lease_start,
        lease_end=data.lease_end,
    )
    db.add(tenant)
    unit.status = "occupied"
    db.commit()
    db.refresh(tenant)
    return tenant


def list_tenants_by_owner(db: Session, owner_id: int) -> list[Tenant]:
    """List all tenants in owner's properties."""
    return (
        db.query(Tenant)
        .join(Unit)
        .join(Property)
        .filter(Property.owner_id == owner_id)
        .all()
    )


def get_tenant_by_id(db: Session, tenant_id: int, owner_id: int) -> Tenant | None:
    """Get tenant by id if they belong to owner's property."""
    return (
        db.query(Tenant)
        .join(Unit)
        .join(Property)
        .filter(Tenant.id == tenant_id, Property.owner_id == owner_id)
        .first()
    )
