"""Property API routes."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.unit_type import UnitType
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.schemas.property_schema import (
    PropertyCreate,
    PropertyDetailResponse,
    PropertyResponse,
    PropertyUpdate,
    PublicListingDetailResponse,
    PublicListingResponse,
)
from app.schemas.property_image_schema import PropertyImageCreate, PropertyImageResponse
from app.schemas.unit_type_schema import ListingCoverUpdate, UnitTypeCreate, UnitTypeResponse, UnitTypeUpdate
from app.services.property_service import (
    create_property,
    list_properties_by_owner,
    get_property_by_id,
    delete_property,
    update_property,
    list_public_listings,
    get_published_property_by_id,
    build_public_listing_dict,
    _cover_urls_by_property,
)
from app.services.property_image_service import (
    list_property_images,
    add_property_image,
    delete_property_image,
    set_cover_image,
)
from app.services.unit_type_service import (
    create_unit_type,
    delete_unit_type,
    serialize_unit_types,
    set_listing_cover,
    update_unit_type,
)

router = APIRouter(prefix="/properties", tags=["Properties"])


@router.get("/public", response_model=list[PublicListingResponse], tags=["Listings"])
def public_listings(
    db: Annotated[Session, Depends(get_db)],
    listing_type: str | None = Query(None, description="rental | airbnb | for_sale"),
    location: str | None = Query(None, description="Text search on location"),
    county: str | None = Query(None, description="Kenya county"),
    locality: str | None = Query(None, description="Estate or town"),
    min_price: float | None = Query(None),
    max_price: float | None = Query(None),
    lat: float | None = Query(None, description="Latitude for radius search"),
    lng: float | None = Query(None, description="Longitude for radius search"),
    radius: float = Query(20.0, description="Search radius in km"),
    category: str | None = Query(None, description="Apartment type category e.g. one_bedroom"),
) -> list[PublicListingResponse]:
    """Public listings — no auth required. Supports location, type and price filters."""
    results = list_public_listings(
        db,
        listing_type=listing_type,
        location=location,
        county=county,
        locality=locality,
        min_price=min_price,
        max_price=max_price,
        lat=lat,
        lng=lng,
        radius_km=radius,
        category=category,
    )
    return [PublicListingResponse(**r) for r in results]


@router.post("", response_model=PropertyResponse)
def create(
    data: PropertyCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PropertyResponse:
    """Create a new property."""
    prop = create_property(db, current_user.id, data)
    return prop


@router.get("", response_model=list[PropertyResponse])
def list_properties(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[PropertyResponse]:
    """List all properties for the current user."""
    props = list_properties_by_owner(db, current_user.id)
    covers = _cover_urls_by_property(db, props)
    results: list[PropertyResponse] = []
    for prop in props:
        item = PropertyResponse.model_validate(prop)
        cover = covers.get(prop.id)
        if cover:
            item.image_url = cover
        elif not item.image_url or len(item.image_url) < 32:
            item.image_url = None
        types = list(prop.unit_types or [])
        vacant = [t for t in types if t.is_vacant]
        item.type_count = len(types)
        item.has_vacant_type = len(vacant) > 0 if types else None
        item.vacant_type_labels = [t.display_label() for t in vacant]
        results.append(item)
    return results


@router.get("/{property_id}", response_model=PropertyDetailResponse)
def get_property(
    property_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PropertyDetailResponse:
    """Get a single property with gallery for the owner."""
    prop = get_property_by_id(db, property_id, current_user.id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    images = list_property_images(db, property_id, current_user.id) or []
    cover = _cover_urls_by_property(db, [prop]).get(prop.id)
    item = PropertyResponse.model_validate(prop)
    if cover:
        item.image_url = cover
    return PropertyDetailResponse(
        **item.model_dump(),
        images=[PropertyImageResponse.model_validate(i) for i in images],
        unit_types=serialize_unit_types(db, property_id),
    )


@router.patch("/{property_id}", response_model=PropertyResponse)
def update(
    property_id: int,
    data: PropertyUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PropertyResponse:
    """Update property details or publish/unpublish it."""
    try:
        prop = update_property(db, property_id, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return prop


@router.delete("/{property_id}")
def delete(
    property_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Delete a property."""
    deleted = delete_property(db, property_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return {"message": "Listing deleted"}


# ── Gallery images (free tier: up to 6 per listing) ───────────────────────────

@router.get("/{property_id}/images", response_model=list[PropertyImageResponse])
def get_images(
    property_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[PropertyImageResponse]:
    """List gallery images for a property."""
    images = list_property_images(db, property_id, current_user.id)
    if images is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return images


@router.post("/{property_id}/images", response_model=PropertyImageResponse, status_code=201)
def upload_image(
    property_id: int,
    data: PropertyImageCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PropertyImageResponse:
    """Add a gallery image (free — up to 6 per listing)."""
    try:
        image = add_property_image(db, property_id, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return image


@router.patch("/{property_id}/images/{image_id}/cover", response_model=PropertyImageResponse)
def make_cover(
    property_id: int,
    image_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PropertyImageResponse:
    """Set an image as the listing cover photo."""
    image = set_cover_image(db, property_id, image_id, current_user.id)
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    return image


@router.delete("/{property_id}/images/{image_id}")
def remove_image(
    property_id: int,
    image_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Remove a gallery image (soft-hide as unused — not permanently deleted)."""
    deleted = delete_property_image(db, property_id, image_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    return {"message": "Image hidden (unused)"}


@router.post("/{property_id}/unit-types", response_model=UnitTypeResponse)
def add_unit_type(
    property_id: int,
    data: UnitTypeCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UnitTypeResponse:
    try:
        row = create_unit_type(db, property_id, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    types = serialize_unit_types(db, property_id)
    match = next((t for t in types if t["id"] == row.id), None)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Type not found")
    return UnitTypeResponse(**match)


@router.patch("/{property_id}/unit-types/{type_id}", response_model=UnitTypeResponse)
def patch_unit_type(
    property_id: int,
    type_id: int,
    data: UnitTypeUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UnitTypeResponse:
    try:
        row = update_unit_type(db, type_id, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not row or row.property_id != property_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Type not found")
    types = serialize_unit_types(db, property_id)
    match = next((t for t in types if t["id"] == row.id), None)
    return UnitTypeResponse(**match)


@router.delete("/{property_id}/unit-types/{type_id}")
def remove_unit_type(
    property_id: int,
    type_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    try:
        ok = delete_unit_type(db, type_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Type not found")
    return {"message": "Apartment type removed"}


@router.patch("/{property_id}/listing-cover", response_model=PropertyResponse)
def patch_listing_cover(
    property_id: int,
    data: ListingCoverUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PropertyResponse:
    try:
        prop = set_listing_cover(db, property_id, current_user.id, data.image_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    item = PropertyResponse.model_validate(prop)
    cover = _cover_urls_by_property(db, [prop]).get(prop.id)
    if cover:
        item.image_url = cover
    return item


def get_public_listing_detail(db: Session, listing_id: int) -> PublicListingDetailResponse:
    """Shared handler for public listing detail."""
    prop = get_published_property_by_id(db, listing_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    prop.view_count = (prop.view_count or 0) + 1
    db.commit()
    db.refresh(prop)
    data = build_public_listing_dict(db, prop)
    images = data.pop("images")
    cover = _cover_urls_by_property(db, [prop]).get(prop.id)
    if cover:
        data["image_url"] = cover
    elif images and (not data.get("image_url") or len(str(data.get("image_url") or "")) < 20):
        data["image_url"] = images[0].url if hasattr(images[0], "url") else images[0].get("url")
    types = db.query(UnitType).filter(UnitType.property_id == listing_id).all()
    hide_empty = prop.listing_type in ("rental", "airbnb")
    if hide_empty and types and not any(t.is_vacant for t in types):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    return PublicListingDetailResponse(
        **data,
        images=[PropertyImageResponse.model_validate(i) for i in images],
        unit_types=serialize_unit_types(db, listing_id, vacant_only=hide_empty),
    )
