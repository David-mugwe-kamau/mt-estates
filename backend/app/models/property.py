"""Property (building) model."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin


class Property(Base, TimestampMixin):
    """Property (apartment building) model."""

    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(500), nullable=False)
    county: Mapped[str | None] = mapped_column(String(100), nullable=True)
    locality: Mapped[str | None] = mapped_column(String(150), nullable=True)

    # Listing type and visibility
    listing_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # rental, airbnb, for_sale
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Contact info (shown on public listing)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    contact_whatsapp: Mapped[str | None] = mapped_column(String(50), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # GPS coordinates for map directions + location search
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Billing defaults (editable by landlord)
    water_rate_per_unit: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), default=Decimal("150"))
    garbage_fee: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), default=Decimal("200"))
    main_meter_reading: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_unused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    unused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cover_image_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="properties")
    units: Mapped[list["Unit"]] = relationship(
        "Unit",
        back_populates="property",
        cascade="all, delete-orphan",
    )
    unit_types: Mapped[list["UnitType"]] = relationship(
        "UnitType",
        back_populates="listing",
        cascade="all, delete-orphan",
        order_by="UnitType.sort_order",
    )
    images: Mapped[list["PropertyImage"]] = relationship(
        "PropertyImage",
        back_populates="property",
        cascade="all, delete-orphan",
        order_by="PropertyImage.sort_order",
    )

    def __repr__(self) -> str:
        return f"Property(id={self.id}, name={self.name})"
