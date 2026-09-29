"""Wishlist (saved homes) API — free for authenticated users."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.schemas.wishlist_schema import WishlistCreate, WishlistResponse
from app.services.wishlist_service import add_wishlist_item, delete_wishlist_item, list_wishlist

router = APIRouter(prefix="/wishlist", tags=["Wishlist"])


@router.get("", response_model=list[WishlistResponse])
def get_wishlist(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[WishlistResponse]:
    """List saved homes for the current user."""
    items = list_wishlist(db, current_user.id)
    return [WishlistResponse(**i) for i in items]


@router.post("", response_model=WishlistResponse, status_code=status.HTTP_201_CREATED)
def create_wishlist_item(
    data: WishlistCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> WishlistResponse:
    """Save a home or place to the user's list."""
    item = add_wishlist_item(db, current_user.id, data)
    return item


@router.delete("/{item_id}")
def remove_wishlist_item(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Remove a saved item."""
    ok = delete_wishlist_item(db, current_user.id, item_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return {"message": "Removed"}
