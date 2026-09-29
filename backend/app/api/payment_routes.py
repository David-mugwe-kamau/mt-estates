"""Rent payment API routes."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.schemas.payment_schema import PaymentCreate, PaymentResponse
from app.services.payment_service import create_payment, list_payments_by_owner

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("", response_model=PaymentResponse)
def create(
    data: PaymentCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PaymentResponse:
    """Record a rent payment."""
    try:
        payment = create_payment(db, current_user.id, data)
        return payment
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=list[PaymentResponse])
def list_payments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[PaymentResponse]:
    """List all rent payments."""
    payments = list_payments_by_owner(db, current_user.id)
    return payments
