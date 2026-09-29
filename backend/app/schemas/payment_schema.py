"""Rent payment request/response schemas."""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class PaymentCreate(BaseModel):
    """Schema for recording a rent payment."""

    tenant_id: int
    amount: Decimal
    payment_date: date
    payment_method: str  # mpesa, cash, bank
    status: str = "paid"


class PaymentResponse(BaseModel):
    """Schema for payment in responses."""

    id: int
    tenant_id: int
    amount: Decimal
    payment_date: date
    payment_method: str
    status: str

    model_config = {"from_attributes": True}
