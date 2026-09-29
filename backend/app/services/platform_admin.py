"""Platform owner / admin helpers for MT Estates maintenance."""
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.services.user_role_service import ROLE_OWNER, get_role_names


def is_platform_admin(db: Session, user: User) -> bool:
    """True for MT Estates owner (platform admin)."""
    if user.role in ("admin", "owner"):
        return True
    if user.email and user.email.lower() in settings.platform_admin_emails_list:
        return True
    roles = get_role_names(db, user.id)
    return ROLE_OWNER in roles
