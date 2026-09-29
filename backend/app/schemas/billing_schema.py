"""Billing / meter reading schemas."""
from decimal import Decimal

from pydantic import BaseModel, Field


class ReadingInput(BaseModel):
    unit_id: int
    previous_reading: Decimal | None = None
    current_reading: Decimal
    amount_paid: Decimal | None = None


class BulkReadingsRequest(BaseModel):
    readings: list[ReadingInput]
    main_meter_reading: Decimal | None = None


class PaymentUpdate(BaseModel):
    amount_paid: Decimal = Field(..., ge=0)


class ReadingLineResponse(BaseModel):
    id: int | None = None
    unit_id: int
    unit_number: str
    tenant_id: int | None = None
    tenant_name: str | None = None
    tenant_phone: str | None = None
    period: str
    previous_reading: float
    current_reading: float
    water_units: float
    water_cost: float
    garbage_fee: float
    rent_amount: float
    total_due: float
    arrears: float = 0
    amount_paid: float
    balance: float


class BillingStatementResponse(BaseModel):
    property_id: int
    period: str
    water_rate_per_unit: float
    garbage_fee: float
    main_meter_reading: float | None = None
    lines: list[ReadingLineResponse]
    totals: dict
