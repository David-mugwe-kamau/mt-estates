"""Tenant model."""
from __future__ import annotations

from datetime import date
from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Tenant(Base):
    """Tenant model."""

    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    national_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit_id: Mapped[int] = mapped_column(
        ForeignKey("units.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    lease_start: Mapped[date] = mapped_column(Date, nullable=False)
    lease_end: Mapped[date] = mapped_column(Date, nullable=False)

    # Relationships
    unit: Mapped["Unit"] = relationship("Unit", back_populates="tenant")
    rent_payments: Mapped[list["RentPayment"]] = relationship(
        "RentPayment",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"Tenant(id={self.id}, name={self.name})"
