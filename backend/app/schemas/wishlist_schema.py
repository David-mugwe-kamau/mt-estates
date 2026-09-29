"""Wishlist request/response schemas."""
from datetime import datetime

from typing import Literal

from pydantic import BaseModel, Field


class WishlistCreate(BaseModel):
    """Create a saved item."""

    title: str = Field(..., min_length=1, max_length=255)
    location_text: str | None = None
    listing_type: Literal["rental", "airbnb", "for_sale"]
    notes: str | None = None
    external_ref: str | None = None
    is_available: bool | None = None


class WishlistResponse(BaseModel):
    """Saved item in responses."""

    id: int
    title: str
    location_text: str | None
    listing_type: str
    notes: str | None
    external_ref: str | None
    is_available: bool | None
    created_at: datetime

    model_config = {"from_attributes": True}
