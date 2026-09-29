"""Saved homes / wishlist — free for signed-in users (addressed by name in UI, not 'tenant')."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class WishlistItem(Base):
    """A saved property or place the user wants to remember."""

    __tablename__ = "wishlist_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    location_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    listing_type: Mapped[str] = mapped_column(String(30), nullable=False)  # rental, airbnb, for_sale
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
    external_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_available: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="wishlist_items")
