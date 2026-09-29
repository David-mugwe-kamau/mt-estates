"""Meter reading / monthly billing model."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class MeterReading(Base):
    """Monthly water + rent + garbage statement line for a unit."""

    __tablename__ = "meter_readings"
    __table_args__ = (UniqueConstraint("unit_id", "period", name="uq_meter_unit_period"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id", ondelete="CASCADE"), nullable=False)
    period: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM
    previous_reading: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    current_reading: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    water_units: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    water_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    garbage_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    rent_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total_due: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    arrears: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    unit: Mapped["Unit"] = relationship("Unit")
