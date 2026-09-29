"""Apartment type schemas."""
from datetime import datetime

from pydantic import BaseModel

from app.schemas.property_image_schema import PropertyImageResponse


class UnitTypeCreate(BaseModel):
    category: str
    custom_label: str | None = None
    rent_amount: float | None = None


class UnitTypeUpdate(BaseModel):
    category: str | None = None
    custom_label: str | None = None
    rent_amount: float | None = None
    is_vacant: bool | None = None


class UnitTypeResponse(BaseModel):
    id: int
    property_id: int
    category: str
    custom_label: str | None
    label: str
    sort_order: int
    rent_amount: float | None = None
    is_vacant: bool = True
    images: list[PropertyImageResponse] = []
    vacant_units: int = 0
    total_units: int = 0
    min_rent: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ListingCoverUpdate(BaseModel):
    image_id: int
