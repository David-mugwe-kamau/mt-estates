"""Dashboard response schema."""
from pydantic import BaseModel


class DashboardResponse(BaseModel):
    """Schema for dashboard summary."""

    total_properties: int
    total_units: int
    occupied_units: int
    vacant_units: int
    rent_collected: float
