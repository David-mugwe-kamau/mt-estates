"""Rent payment model."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class RentPayment(Base):
    """Rent payment model."""

    __tablename__ = "rent_payments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)  # mpesa, cash, bank
    status: Mapped[str] = mapped_column(String(20), default="paid", nullable=False)  # paid, pending

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="rent_payments")

    def __repr__(self) -> str:
        return f"RentPayment(id={self.id}, amount={self.amount})"
