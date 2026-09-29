"""Unit model - individual apartments within a property."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Unit(Base):
    """Unit (apartment) model."""

    __tablename__ = "units"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    property_id: Mapped[int] = mapped_column(
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
    )
    unit_number: Mapped[str] = mapped_column(String(50), nullable=False)
    rent_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="vacant", nullable=False)  # vacant, occupied
    is_unused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    unused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    unit_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("unit_types.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    property: Mapped["Property"] = relationship("Property", back_populates="units")
    unit_type: Mapped["UnitType | None"] = relationship("UnitType", back_populates="units")
    tenant: Mapped["Tenant | None"] = relationship(
        "Tenant",
        back_populates="unit",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"Unit(id={self.id}, unit_number={self.unit_number})"
