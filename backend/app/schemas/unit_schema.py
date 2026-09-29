"""Unit request/response schemas."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class UnitCreate(BaseModel):
    """Schema for creating a unit."""

    property_id: int
    unit_number: str
    rent_amount: Decimal
    status: str = "vacant"
    unit_type_id: int | None = None


class UnitUpdate(BaseModel):
    """Schema for updating a unit (number, rent, status)."""

    unit_number: str | None = None
    status: str | None = None
    rent_amount: Decimal | None = None
    unit_type_id: int | None = None


class UnitResponse(BaseModel):
    """Schema for unit in responses."""

    id: int
    property_id: int
    unit_number: str
    rent_amount: Decimal
    status: str
    unit_type_id: int | None = None
    is_unused: bool = False
    unused_at: datetime | None = None

    model_config = {"from_attributes": True}


class UnusedUnitAdminResponse(BaseModel):
    """Unused (hidden) unit for platform maintenance."""

    id: int
    property_id: int
    property_name: str | None = None
    unit_number: str
    rent_amount: Decimal
    status: str
    unused_at: datetime | None = None
