"""Authentication business logic."""
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user_schema import UserCreate, UserLogin
from app.auth.password_utils import hash_password, verify_password
from app.auth.jwt_handler import create_access_token
from app.services.user_role_service import assign_roles_for_new_user


def register_user(db: Session, data: UserCreate) -> User:
    """Register a new user. Raises ValueError if email already exists."""
    if len(data.password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if db.query(User).filter(User.email == data.email).first():
        raise ValueError("Email already registered")
    # Legacy column: landlord-style account if they opt into listing/hosting.
    legacy_role = "landlord" if (data.list_rentals or data.host_airbnb) else "user"
    user = User(
        name=data.name,
        email=data.email,
        phone=data.phone,
        password_hash=hash_password(data.password),
        role=legacy_role,
    )
    db.add(user)
    db.flush()
    assign_roles_for_new_user(
        db,
        user.id,
        list_rentals=data.list_rentals,
        host_airbnb=data.host_airbnb,
    )
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, data: UserLogin) -> tuple[User, str]:
    """
    Authenticate user by email/password. Returns (user, access_token).
    Raises ValueError if credentials are invalid.
    """
    from app.services.user_role_service import get_role_names

    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise ValueError("Invalid email or password")
    roles = get_role_names(db, user.id)
    token = create_access_token(subject=user.id, extra_claims={"roles": roles})
    return user, token
