"""Unit API routes."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.schemas.unit_schema import UnitCreate, UnitUpdate, UnitResponse
from app.services.unit_service import (
    create_unit,
    list_units_by_property,
    list_units_by_owner,
    update_unit,
    hide_unit,
)

router = APIRouter(prefix="/units", tags=["Units"])


@router.post("", response_model=UnitResponse)
def create(
    data: UnitCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UnitResponse:
    """Add a unit to a property."""
    try:
        unit = create_unit(db, current_user.id, data)
        return unit
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=list[UnitResponse])
def list_units(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    property_id: int | None = Query(None, description="Filter by property ID"),
) -> list[UnitResponse]:
    """List units. Optionally filter by property_id."""
    if property_id is not None:
        units = list_units_by_property(db, property_id, current_user.id)
    else:
        units = list_units_by_owner(db, current_user.id)
    return units


@router.patch("/{unit_id}", response_model=UnitResponse)
def update(
    unit_id: int,
    data: UnitUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UnitResponse:
    """Update unit (e.g. unit number, status or rent_amount)."""
    try:
        unit = update_unit(db, unit_id, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")
    return unit


@router.delete("/{unit_id}")
def remove_unit(
    unit_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Hide a unit as unused (not permanently deleted)."""
    try:
        ok = hide_unit(db, unit_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")
    return {"message": "Unit hidden (unused)"}
