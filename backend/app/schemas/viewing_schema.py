"""Viewing request schemas."""
from datetime import date, datetime

from pydantic import BaseModel, Field


class ViewingCreate(BaseModel):
    property_id: int
    preferred_date: date | None = None
    message: str | None = Field(None, max_length=1000)


class ViewingUpdate(BaseModel):
    status: str  # pending | confirmed | declined


class ViewingResponse(BaseModel):
    id: int
    property_id: int
    user_id: int
    preferred_date: date | None
    message: str | None
    status: str
    created_at: datetime
    property_name: str | None = None
    property_location: str | None = None
    requester_name: str | None = None
    requester_email: str | None = None
    requester_phone: str | None = None
    listing_type: str | None = None
    contact_phone: str | None = None
    contact_whatsapp: str | None = None

    model_config = {"from_attributes": True}
