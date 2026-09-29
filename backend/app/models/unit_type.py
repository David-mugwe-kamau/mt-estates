"""Apartment type within a listing (1 bedroom, bedsitter, …). Photos live on the type."""
from __future__ import annotations

from datetime import datetime

from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

UNIT_CATEGORIES = [
    "single_room",
    "double_room",
    "bedsitter",
    "one_bedroom",
    "two_bedroom",
    "three_bedroom",
    "four_bedroom",
    "five_bedroom_plus",
    "maisonette",
    "bungalow",
    "townhouse",
    "penthouse",
    "sq",
    "shared_room",
    "other",
]

UNIT_CATEGORY_LABELS = {
    "single_room": "Single room",
    "double_room": "Double room",
    "bedsitter": "Bedsitter / studio",
    "one_bedroom": "1 bedroom",
    "two_bedroom": "2 bedroom",
    "three_bedroom": "3 bedroom",
    "four_bedroom": "4 bedroom",
    "five_bedroom_plus": "5 bedroom+",
    "maisonette": "Maisonette",
    "bungalow": "Bungalow",
    "townhouse": "Townhouse",
    "penthouse": "Penthouse",
    "sq": "SQ / backyard unit",
    "shared_room": "Shared / hostel room",
    "other": "Other",
}


class UnitType(Base):
    __tablename__ = "unit_types"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    custom_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rent_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    is_vacant: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    listing: Mapped["Property"] = relationship("Property", back_populates="unit_types")
    units: Mapped[list["Unit"]] = relationship("Unit", back_populates="unit_type")
    images: Mapped[list["PropertyImage"]] = relationship("PropertyImage", back_populates="unit_type")

    def display_label(self) -> str:
        if self.category == "other" and self.custom_label:
            return self.custom_label.strip()
        return UNIT_CATEGORY_LABELS.get(self.category, self.category)
