"""Shared helper utilities."""
from datetime import date, datetime
from decimal import Decimal
from typing import Any


def serialize_value(value: Any) -> Any:
    """Convert model values for JSON (e.g. Decimal, date)."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value
