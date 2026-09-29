"""SQLAlchemy declarative base and common mixins."""
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    type_annotation_map = {
        datetime: DateTime(timezone=True),
    }


class TimestampMixin:
    """Mixin adding created_at to models."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


def repr_model(cls: type, **fields: Any) -> str:
    """Helper to generate __repr__ for models."""
    attrs = ", ".join(f"{k}={v!r}" for k, v in fields.items())
    return f"{cls.__name__}({attrs})"
