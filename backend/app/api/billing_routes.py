"""Billing API routes."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.billing_schema import BillingStatementResponse, BulkReadingsRequest, PaymentUpdate
from app.services.billing_service import get_statement, list_periods, record_payment, upsert_readings

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("/{property_id}/periods", response_model=list[str])
def periods(
    property_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[str]:
    result = list_periods(db, property_id, current_user.id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return result


@router.get("/{property_id}/{period}", response_model=BillingStatementResponse)
def statement(
    property_id: int,
    period: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BillingStatementResponse:
    result = get_statement(db, property_id, current_user.id, period)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return BillingStatementResponse(**result)


@router.post("/{property_id}/{period}/readings", response_model=BillingStatementResponse)
def save_readings(
    property_id: int,
    period: str,
    data: BulkReadingsRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BillingStatementResponse:
    try:
        result = upsert_readings(db, property_id, current_user.id, period, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return BillingStatementResponse(**result)


@router.patch("/readings/{reading_id}/payment")
def payment(
    reading_id: int,
    data: PaymentUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    reading = record_payment(db, reading_id, current_user.id, data)
    if not reading:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reading not found")
    return {
        "id": reading.id,
        "amount_paid": float(reading.amount_paid),
        "balance": float(reading.balance),
        "total_due": float(reading.total_due),
    }
