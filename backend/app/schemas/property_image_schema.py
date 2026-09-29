"""Property image request/response schemas."""
from datetime import datetime

from pydantic import BaseModel, Field


FREE_GALLERY_LIMIT = 6


class PropertyImageCreate(BaseModel):
    """Add a gallery image (base64 data URL or external URL)."""

    url: str = Field(..., min_length=1)
    is_cover: bool = False
    unit_type_id: int | None = None


class PropertyImageResponse(BaseModel):
    """Gallery image in responses."""

    id: int
    property_id: int
    url: str
    sort_order: int
    is_cover: bool
    is_unused: bool = False
    unused_at: datetime | None = None
    unit_type_id: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UnusedImageAdminResponse(BaseModel):
    """Unused (hidden) gallery image for platform maintenance."""

    id: int
    property_id: int
    property_name: str | None = None
    url: str
    unused_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
