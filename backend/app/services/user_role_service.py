"""User role helpers — single account, multiple capabilities."""
from sqlalchemy.orm import Session

from app.models.user_role import UserRole

ROLE_RENTER = "renter"
ROLE_RENTAL_LANDLORD = "rental_landlord"
ROLE_AIRBNB_HOST = "airbnb_host"
ROLE_OWNER = "owner"


def get_role_names(db: Session, user_id: int) -> list[str]:
    """Return enabled role names for a user."""
    rows = (
        db.query(UserRole)
        .filter(UserRole.user_id == user_id, UserRole.enabled.is_(True))
        .order_by(UserRole.role)
        .all()
    )
    return [r.role for r in rows]


def assign_roles_for_new_user(
    db: Session,
    user_id: int,
    *,
    list_rentals: bool,
    host_airbnb: bool,
) -> None:
    """Attach default renter + optional landlord/host roles."""
    roles: list[str] = [ROLE_RENTER]
    if list_rentals:
        roles.append(ROLE_RENTAL_LANDLORD)
    if host_airbnb:
        roles.append(ROLE_AIRBNB_HOST)
    for role in roles:
        db.add(UserRole(user_id=user_id, role=role, enabled=True))
