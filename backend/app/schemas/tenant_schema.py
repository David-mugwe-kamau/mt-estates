"""Tenant request/response schemas."""
from datetime import date

from pydantic import BaseModel, EmailStr


class TenantCreate(BaseModel):
    """Schema for creating a tenant."""

    name: str
    phone: str
    email: EmailStr
    national_id: str | None = None
    unit_id: int
    lease_start: date
    lease_end: date


class TenantResponse(BaseModel):
    """Schema for tenant in responses."""

    id: int
    name: str
    phone: str
    email: str
    national_id: str | None
    unit_id: int
    lease_start: date
    lease_end: date

    model_config = {"from_attributes": True}
