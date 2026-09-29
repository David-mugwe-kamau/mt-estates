"""User request/response schemas."""
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    """Schema for user registration."""

    name: str
    email: EmailStr
    phone: str | None = None
    password: str
    # Optional capabilities (same account; roles stored in user_roles).
    list_rentals: bool = False
    host_airbnb: bool = False


class UserLogin(BaseModel):
    """Schema for login."""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user in responses (no password)."""

    id: int
    name: str
    email: str
    phone: str | None
    avatar_url: str | None = None
    role: str
    roles: list[str] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """Schema for updating user profile."""

    name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None


class UserMeResponse(UserResponse):
    """Current user profile including subscription summary (payments wired later)."""

    subscriptions: list[dict] = []
    is_platform_admin: bool = False
