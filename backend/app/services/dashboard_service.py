"""Dashboard aggregation business logic."""
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.property import Property
from app.models.unit import Unit
from app.models.rent_payment import RentPayment
from app.models.tenant import Tenant
from app.schemas.dashboard_schema import DashboardResponse


def get_dashboard(db: Session, owner_id: int) -> DashboardResponse:
    """Compute dashboard stats for the given owner."""
    total_properties = (
        db.query(Property)
        .filter(Property.owner_id == owner_id, Property.is_unused.is_(False))
        .count()
    )

    units_sub = (
        db.query(Unit)
        .join(Property)
        .filter(Property.owner_id == owner_id, Unit.is_unused.is_(False))
    )
    total_units = units_sub.count()
    occupied_units = units_sub.filter(Unit.status == "occupied").count()
    vacant_units = total_units - occupied_units

    rent_collected = (
        db.query(func.coalesce(func.sum(RentPayment.amount), 0))
        .join(Tenant)
        .join(Unit)
        .join(Property)
        .filter(Property.owner_id == owner_id, RentPayment.status == "paid")
        .scalar()
    )
    rent_collected_float = float(rent_collected or 0)

    return DashboardResponse(
        total_properties=total_properties,
        total_units=total_units,
        occupied_units=occupied_units,
        vacant_units=vacant_units,
        rent_collected=rent_collected_float,
    )
