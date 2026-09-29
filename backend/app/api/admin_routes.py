"""Platform admin / maintenance routes (MT Estates owner only)."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.property import Property
from app.models.user import User
from app.schemas.property_image_schema import PropertyImageResponse, UnusedImageAdminResponse
from app.schemas.property_schema import PropertyResponse, UnusedListingAdminResponse
from app.schemas.unit_schema import UnitResponse, UnusedUnitAdminResponse
from app.services.platform_admin import is_platform_admin
from app.services.property_image_service import (
    list_unused_images,
    purge_unused_image,
    restore_unused_image,
)
from app.services.property_service import (
    list_unused_properties,
    purge_unused_property,
    restore_unused_property,
)
from app.services.unit_service import (
    list_unused_units,
    purge_unused_unit,
    restore_unused_unit,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


def _require_admin(db: Session, user: User) -> None:
    if not is_platform_admin(db, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform admin only")


@router.get("/unused-images", response_model=list[UnusedImageAdminResponse])
def get_unused_images(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[UnusedImageAdminResponse]:
    """List hidden (unused) gallery photos for maintenance."""
    _require_admin(db, current_user)
    rows = list_unused_images(db)
    out: list[UnusedImageAdminResponse] = []
    for img in rows:
        prop = db.query(Property).filter(Property.id == img.property_id).first()
        out.append(
            UnusedImageAdminResponse(
                id=img.id,
                property_id=img.property_id,
                property_name=prop.name if prop else None,
                url=img.url,
                unused_at=img.unused_at,
                created_at=img.created_at,
            )
        )
    return out


@router.patch("/unused-images/{image_id}/restore", response_model=PropertyImageResponse)
def restore_image(
    image_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PropertyImageResponse:
    """Restore a hidden photo back to the listing gallery."""
    _require_admin(db, current_user)
    try:
        image = restore_unused_image(db, image_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unused image not found")
    return image


@router.delete("/unused-images/{image_id}")
def permanently_delete_image(
    image_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Permanently delete an unused photo (cannot be undone)."""
    _require_admin(db, current_user)
    ok = purge_unused_image(db, image_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unused image not found")
    return {"message": "Image permanently deleted"}


@router.get("/unused-units", response_model=list[UnusedUnitAdminResponse])
def get_unused_units(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[UnusedUnitAdminResponse]:
    """List hidden (unused) units for maintenance."""
    _require_admin(db, current_user)
    rows = list_unused_units(db)
    out: list[UnusedUnitAdminResponse] = []
    for unit in rows:
        prop = db.query(Property).filter(Property.id == unit.property_id).first()
        out.append(
            UnusedUnitAdminResponse(
                id=unit.id,
                property_id=unit.property_id,
                property_name=prop.name if prop else None,
                unit_number=unit.unit_number,
                rent_amount=unit.rent_amount,
                status=unit.status,
                unused_at=unit.unused_at,
            )
        )
    return out


@router.patch("/unused-units/{unit_id}/restore", response_model=UnitResponse)
def restore_unit(
    unit_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UnitResponse:
    """Restore a hidden unit back to the property."""
    _require_admin(db, current_user)
    unit = restore_unused_unit(db, unit_id)
    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unused unit not found")
    return unit


@router.delete("/unused-units/{unit_id}")
def permanently_delete_unit(
    unit_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Permanently delete an unused unit (cannot be undone)."""
    _require_admin(db, current_user)
    ok = purge_unused_unit(db, unit_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unused unit not found")
    return {"message": "Unit permanently deleted"}


@router.get("/unused-listings", response_model=list[UnusedListingAdminResponse])
def get_unused_listings(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[UnusedListingAdminResponse]:
    """List hidden (unused) listings for maintenance."""
    _require_admin(db, current_user)
    rows = list_unused_properties(db)
    return [
        UnusedListingAdminResponse(
            id=p.id,
            owner_id=p.owner_id,
            name=p.name,
            location=p.location,
            listing_type=p.listing_type,
            unused_at=p.unused_at,
            created_at=p.created_at,
        )
        for p in rows
    ]


@router.patch("/unused-listings/{property_id}/restore", response_model=PropertyResponse)
def restore_listing(
    property_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PropertyResponse:
    """Restore a hidden listing (stays unpublished until landlord republishes)."""
    _require_admin(db, current_user)
    prop = restore_unused_property(db, property_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unused listing not found")
    return prop


@router.delete("/unused-listings/{property_id}")
def permanently_delete_listing(
    property_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Permanently delete an unused listing (cannot be undone)."""
    _require_admin(db, current_user)
    ok = purge_unused_property(db, property_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unused listing not found")
    return {"message": "Listing permanently deleted"}
