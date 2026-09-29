"""Property request/response schemas."""
from datetime import datetime

from pydantic import BaseModel

from app.schemas.property_image_schema import PropertyImageResponse
from app.schemas.unit_type_schema import UnitTypeResponse


class PropertyCreate(BaseModel):
    """Schema for creating a property."""

    name: str
    location: str
    county: str | None = None
    locality: str | None = None
    listing_type: str | None = None        # rental, airbnb, for_sale
    description: str | None = None
    contact_phone: str | None = None
    contact_whatsapp: str | None = None
    contact_email: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    water_rate_per_unit: float | None = 150
    garbage_fee: float | None = 200


class PropertyUpdate(BaseModel):
    """Schema for updating a property."""

    name: str | None = None
    location: str | None = None
    county: str | None = None
    locality: str | None = None
    listing_type: str | None = None
    description: str | None = None
    is_published: bool | None = None
    contact_phone: str | None = None
    contact_whatsapp: str | None = None
    contact_email: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    image_url: str | None = None
    water_rate_per_unit: float | None = None
    garbage_fee: float | None = None
    main_meter_reading: float | None = None


class PropertyResponse(BaseModel):
    """Schema for property in responses."""

    id: int
    owner_id: int
    name: str
    location: str
    county: str | None = None
    locality: str | None = None
    listing_type: str | None
    is_published: bool
    description: str | None
    image_url: str | None
    contact_phone: str | None
    contact_whatsapp: str | None
    contact_email: str | None
    latitude: float | None
    longitude: float | None
    water_rate_per_unit: float | None = None
    garbage_fee: float | None = None
    main_meter_reading: float | None = None
    view_count: int = 0
    is_unused: bool = False
    unused_at: datetime | None = None
    cover_image_id: int | None = None
    created_at: datetime
    type_count: int | None = None
    has_vacant_type: bool | None = None
    vacant_type_labels: list[str] | None = None

    model_config = {"from_attributes": True}


class VacantTypeSummary(BaseModel):
    label: str
    category: str
    rent_amount: float | None = None


class UnusedListingAdminResponse(BaseModel):
    """Unused (hidden) listing for platform maintenance."""

    id: int
    owner_id: int
    name: str
    location: str
    listing_type: str | None
    unused_at: datetime | None = None
    created_at: datetime


class PropertyDetailResponse(PropertyResponse):
    """Owner property detail including gallery."""

    images: list[PropertyImageResponse] = []
    unit_types: list[UnitTypeResponse] = []


class PublicListingResponse(BaseModel):
    """Schema for public listing (no owner details)."""

    id: int
    name: str
    location: str
    county: str | None = None
    locality: str | None = None
    listing_type: str | None
    description: str | None
    image_url: str | None
    contact_phone: str | None
    contact_whatsapp: str | None
    contact_email: str | None
    latitude: float | None
    longitude: float | None
    min_rent: float | None = None
    vacant_types: list[VacantTypeSummary] = []

    model_config = {"from_attributes": True}


class PublicListingDetailResponse(PublicListingResponse):
    """Public listing detail with gallery."""

    images: list[PropertyImageResponse] = []
    unit_types: list[UnitTypeResponse] = []
    cover_image_id: int | None = None
