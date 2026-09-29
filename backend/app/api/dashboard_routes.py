"""Dashboard API routes."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.schemas.dashboard_schema import DashboardResponse
from app.services.dashboard_service import get_dashboard

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard_stats(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DashboardResponse:
    """Get dashboard summary: total properties, units, occupied/vacant, rent collected."""
    return get_dashboard(db, current_user.id)
