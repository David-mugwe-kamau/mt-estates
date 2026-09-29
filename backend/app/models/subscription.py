"""Subscription records — landlord management and Airbnb premium (Stripe / M-Pesa later)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Subscription(Base):
    """Tracks paid products per user (provider + status for reconciliation)."""

    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    product: Mapped[str] = mapped_column(String(50), nullable=False)  # landlord_management, airbnb_premium
    status: Mapped[str] = mapped_column(String(30), nullable=False)  # active, canceled, past_due, trialing
    provider: Mapped[str | None] = mapped_column(String(30), nullable=True)  # stripe, mpesa, null
    provider_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="subscriptions")
