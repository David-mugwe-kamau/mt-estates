"""Authentication API routes."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.user_schema import UserCreate, UserLogin, UserMeResponse, UserResponse, UserUpdate
from app.services.auth_service import register_user, authenticate_user
from app.services.user_profile_service import build_user_response, build_user_me_response
from app.auth.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse)
def register(
    data: UserCreate,
    db: Annotated[Session, Depends(get_db)],
) -> UserResponse:
    """Register a new account (renter by default; optional listing/host roles)."""
    try:
        user = register_user(db, data)
        return build_user_response(db, user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login")
def login(
    data: UserLogin,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Login and receive JWT access token."""
    try:
        user, token = authenticate_user(db, data)
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": build_user_response(db, user),
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.get("/me", response_model=UserMeResponse)
def me(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserMeResponse:
    """Get current user profile, roles, and subscription summary."""
    return build_user_me_response(db, current_user)


@router.patch("/me", response_model=UserResponse)
def update_profile(
    data: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """Update current user's name, phone, or avatar URL."""
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return build_user_response(db, current_user)
