"""Property gallery image model."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class PropertyImage(Base):
    """Gallery image for a property listing."""

    __tablename__ = "property_images"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    property_id: Mapped[int] = mapped_column(
        ForeignKey("properties.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_cover: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_unused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    unused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    unit_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("unit_types.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    property: Mapped["Property"] = relationship("Property", back_populates="images")
    unit_type: Mapped["UnitType | None"] = relationship("UnitType", back_populates="images")
