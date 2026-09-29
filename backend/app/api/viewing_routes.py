"""Viewing request API routes."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.viewing_schema import ViewingCreate, ViewingResponse, ViewingUpdate
from app.services.viewing_service import (
    create_viewing,
    list_my_viewings,
    list_received_viewings,
    update_viewing,
)

router = APIRouter(prefix="/viewings", tags=["Viewings"])


@router.post("", response_model=ViewingResponse, status_code=201)
def create(
    data: ViewingCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ViewingResponse:
    try:
        item = create_viewing(db, current_user.id, data)
        return ViewingResponse.model_validate(item)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/mine", response_model=list[ViewingResponse])
def mine(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ViewingResponse]:
    return [ViewingResponse(**r) for r in list_my_viewings(db, current_user.id)]


@router.get("/received", response_model=list[ViewingResponse])
def received(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ViewingResponse]:
    return [ViewingResponse(**r) for r in list_received_viewings(db, current_user.id)]


@router.patch("/{viewing_id}", response_model=ViewingResponse)
def patch(
    viewing_id: int,
    data: ViewingUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ViewingResponse:
    try:
        item = update_viewing(db, viewing_id, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Viewing not found")
    return ViewingResponse.model_validate(item)
