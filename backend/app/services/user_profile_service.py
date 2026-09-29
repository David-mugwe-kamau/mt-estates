"""Build API responses for user profile (roles, subscriptions)."""
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user_schema import UserMeResponse, UserResponse
from app.services.platform_admin import is_platform_admin
from app.services.subscription_service import list_subscriptions_summary
from app.services.user_role_service import get_role_names


def build_user_response(db: Session, user: User) -> UserResponse:
    roles = get_role_names(db, user.id)
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        avatar_url=getattr(user, "avatar_url", None),
        role=user.role,
        roles=roles,
        created_at=user.created_at,
    )


def build_user_me_response(db: Session, user: User) -> UserMeResponse:
    base = build_user_response(db, user)
    subs = list_subscriptions_summary(db, user.id)
    return UserMeResponse(
        **base.model_dump(),
        subscriptions=subs,
        is_platform_admin=is_platform_admin(db, user),
    )
