"""Property management business logic."""
from datetime import datetime, timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.property_image import PropertyImage
from app.models.unit import Unit
from app.models.unit_type import UnitType
from app.schemas.property_schema import PropertyCreate, PropertyUpdate


def _visible():
    return Property.is_unused.is_(False)


def create_property(db: Session, owner_id: int, data: PropertyCreate) -> Property:
    """Create a new property for the given owner."""
    prop = Property(
        owner_id=owner_id,
        name=data.name,
        location=data.location,
        county=data.county,
        locality=data.locality,
        listing_type=data.listing_type,
        description=data.description,
        contact_phone=data.contact_phone,
        contact_whatsapp=data.contact_whatsapp,
        contact_email=data.contact_email,
        latitude=data.latitude,
        longitude=data.longitude,
        water_rate_per_unit=data.water_rate_per_unit if data.water_rate_per_unit is not None else 150,
        garbage_fee=data.garbage_fee if data.garbage_fee is not None else 200,
        is_unused=False,
        unused_at=None,
    )
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop


def update_property(db: Session, property_id: int, owner_id: int, data: PropertyUpdate) -> Property | None:
    """Update property fields including publish status."""
    prop = get_property_by_id(db, property_id, owner_id)
    if not prop:
        return None
    payload = data.model_dump(exclude_none=True)
    if payload.get("is_published") is True:
        phone = (payload.get("contact_phone") if "contact_phone" in payload else prop.contact_phone) or ""
        wa = (payload.get("contact_whatsapp") if "contact_whatsapp" in payload else prop.contact_whatsapp) or ""
        if not str(phone).strip() and not str(wa).strip():
            raise ValueError("Add a viewing phone or WhatsApp number before publishing.")
        if prop.listing_type in ("rental", "airbnb"):
            types = list(prop.unit_types or [])
            if not types:
                raise ValueError("Add at least one apartment type before publishing.")
            ready = False
            for t in types:
                if not t.is_vacant:
                    continue
                rent = t.rent_amount
                if rent is None:
                    continue
                photo_count = (
                    db.query(PropertyImage)
                    .filter(
                        PropertyImage.property_id == prop.id,
                        PropertyImage.unit_type_id == t.id,
                        PropertyImage.is_unused.is_(False),
                    )
                    .count()
                )
                if photo_count > 0:
                    ready = True
                    break
            if not ready:
                raise ValueError(
                    "Before publishing, add a vacant type with rent and at least one photo."
                )
    for field, value in payload.items():
        setattr(prop, field, value)
    db.commit()
    db.refresh(prop)
    return prop


def _cover_urls_by_property(db: Session, props: list[Property]) -> dict[int, str]:
    """Listing card photo: chosen cover_image_id, else a type cover, else any gallery photo."""
    property_ids = [p.id for p in props]
    if not property_ids:
        return {}
    rows = (
        db.query(PropertyImage)
        .filter(PropertyImage.property_id.in_(property_ids), PropertyImage.is_unused.is_(False))
        .order_by(PropertyImage.sort_order, PropertyImage.id)
        .all()
    )
    by_prop: dict[int, list[PropertyImage]] = {}
    for img in rows:
        by_prop.setdefault(img.property_id, []).append(img)

    out: dict[int, str] = {}
    for prop in props:
        imgs = by_prop.get(prop.id, [])
        chosen = None
        if prop.cover_image_id:
            chosen = next((i for i in imgs if i.id == prop.cover_image_id), None)
        if chosen is None:
            typed_covers = [i for i in imgs if i.unit_type_id and i.is_cover]
            if typed_covers:
                chosen = typed_covers[0]
        if chosen is None:
            typed = [i for i in imgs if i.unit_type_id]
            if typed:
                chosen = typed[0]
        if chosen is None:
            covers = [i for i in imgs if i.is_cover]
            chosen = covers[0] if covers else (imgs[0] if imgs else None)
        if chosen and chosen.url:
            out[prop.id] = chosen.url
    return out


def list_public_listings(
    db: Session,
    listing_type: str | None = None,
    location: str | None = None,
    county: str | None = None,
    locality: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = 20.0,
    category: str | None = None,
) -> list[dict]:
    """Return published listings with optional filters."""
    query = db.query(Property).filter(Property.is_published.is_(True), _visible())

    if listing_type:
        query = query.filter(Property.listing_type == listing_type)

    if county:
        c = county.strip()
        query = query.filter(
            or_(
                Property.county.ilike(c),
                Property.location.ilike(f"%{c}%"),
            )
        )

    if locality:
        loc = locality.strip()
        query = query.filter(
            or_(
                Property.locality.ilike(loc),
                Property.location.ilike(f"%{loc}%"),
            )
        )
    elif location:
        query = query.filter(Property.location.ilike(f"%{location}%"))

    radius_active = lat is not None and lng is not None
    category_filter = (category or "").strip() or None

    props = query.all()
    covers = _cover_urls_by_property(db, props)

    results = []
    for prop in props:
        if radius_active:
            if not prop.latitude or not prop.longitude:
                continue
            dlat = abs(prop.latitude - lat)
            dlng = abs(prop.longitude - lng)
            approx_km = ((dlat ** 2 + dlng ** 2) ** 0.5) * 111
            if approx_km > radius_km:
                continue

        types = [t for t in (prop.unit_types or [])]
        vacant_for_card: list = []
        if prop.listing_type in ("rental", "airbnb") and types:
            vacant = [t for t in types if t.is_vacant]
            if not vacant:
                continue
            if category_filter and not any(t.category == category_filter for t in vacant):
                continue
            vacant_for_card = vacant
            type_rents = [float(t.rent_amount) for t in vacant if t.rent_amount is not None]
            min_rent = min(type_rents) if type_rents else None
            if min_rent is None:
                vacant_ids = [t.id for t in vacant]
                min_rent_row = (
                    db.query(func.min(Unit.rent_amount))
                    .filter(
                        Unit.property_id == prop.id,
                        Unit.is_unused.is_(False),
                        Unit.unit_type_id.in_(vacant_ids),
                    )
                    .scalar()
                )
                min_rent = float(min_rent_row) if min_rent_row else None
        elif types:
            if category_filter and not any(t.category == category_filter for t in types):
                continue
            vacant_for_card = [t for t in types if t.is_vacant] or types
            type_rents = [float(t.rent_amount) for t in types if t.rent_amount is not None]
            min_rent = min(type_rents) if type_rents else None
            if min_rent is None:
                min_rent_row = (
                    db.query(func.min(Unit.rent_amount))
                    .filter(Unit.property_id == prop.id, Unit.is_unused.is_(False))
                    .scalar()
                )
                min_rent = float(min_rent_row) if min_rent_row else None
        else:
            if category_filter:
                continue
            min_rent_row = (
                db.query(func.min(Unit.rent_amount))
                .filter(Unit.property_id == prop.id, Unit.is_unused.is_(False))
                .scalar()
            )
            min_rent = float(min_rent_row) if min_rent_row else None

        if min_price and min_rent and min_rent < min_price:
            continue
        if max_price and min_rent and min_rent > max_price:
            continue

        vacant_types = [
            {
                "label": t.display_label(),
                "category": t.category,
                "rent_amount": float(t.rent_amount) if t.rent_amount is not None else None,
            }
            for t in vacant_for_card
        ]

        results.append({
            "id": prop.id,
            "name": prop.name,
            "location": prop.location,
            "county": prop.county,
            "locality": prop.locality,
            "listing_type": prop.listing_type,
            "description": prop.description,
            "image_url": covers.get(prop.id) or (
                prop.image_url if prop.image_url and len(prop.image_url) >= 32 else None
            ),
            "contact_phone": prop.contact_phone,
            "contact_whatsapp": prop.contact_whatsapp,
            "contact_email": None,
            "latitude": prop.latitude,
            "longitude": prop.longitude,
            "min_rent": min_rent,
            "vacant_types": vacant_types,
        })
    return results


def list_properties_by_owner(db: Session, owner_id: int) -> list[Property]:
    """List all visible properties for a given owner."""
    return (
        db.query(Property)
        .filter(Property.owner_id == owner_id, _visible())
        .order_by(Property.id.desc())
        .all()
    )


def get_property_by_id(db: Session, property_id: int, owner_id: int) -> Property | None:
    """Get a visible property by id if it belongs to the owner."""
    return (
        db.query(Property)
        .filter(Property.id == property_id, Property.owner_id == owner_id, _visible())
        .first()
    )


def get_published_property_by_id(db: Session, property_id: int) -> Property | None:
    """Get a published property for public detail view."""
    return (
        db.query(Property)
        .filter(Property.id == property_id, Property.is_published.is_(True), _visible())
        .first()
    )


def _min_rent_for_property(db: Session, property_id: int) -> float | None:
    types = db.query(UnitType).filter(UnitType.property_id == property_id).all()
    if types:
        vacant = [t for t in types if t.is_vacant]
        type_rents = [float(t.rent_amount) for t in vacant if t.rent_amount is not None]
        if type_rents:
            return min(type_rents)
        vacant_ids = [t.id for t in vacant]
        if vacant_ids:
            min_rent_row = (
                db.query(func.min(Unit.rent_amount))
                .filter(
                    Unit.property_id == property_id,
                    Unit.is_unused.is_(False),
                    Unit.unit_type_id.in_(vacant_ids),
                )
                .scalar()
            )
            return float(min_rent_row) if min_rent_row else None
        return None
    min_rent_row = (
        db.query(func.min(Unit.rent_amount))
        .filter(Unit.property_id == property_id, Unit.is_unused.is_(False))
        .scalar()
    )
    return float(min_rent_row) if min_rent_row else None


def build_public_listing_dict(db: Session, prop: Property) -> dict:
    images = (
        db.query(PropertyImage)
        .filter(PropertyImage.property_id == prop.id, PropertyImage.is_unused.is_(False))
        .order_by(PropertyImage.sort_order, PropertyImage.id)
        .all()
    )
    cover = None
    if images:
        cover_img = next((i for i in images if i.is_cover), images[0])
        cover = cover_img.url
    elif prop.image_url:
        cover = prop.image_url

    return {
        "id": prop.id,
        "name": prop.name,
        "location": prop.location,
        "county": prop.county,
        "locality": prop.locality,
        "listing_type": prop.listing_type,
        "description": prop.description,
        "image_url": cover,
        "contact_phone": prop.contact_phone,
        "contact_whatsapp": prop.contact_whatsapp,
        "contact_email": None,
        "latitude": prop.latitude,
        "longitude": prop.longitude,
        "min_rent": _min_rent_for_property(db, prop.id),
        "images": images,
        "cover_image_id": prop.cover_image_id,
    }


def hide_property(db: Session, property_id: int, owner_id: int) -> bool:
    """Landlord remove — soft-hide listing as unused (not permanently deleted)."""
    prop = get_property_by_id(db, property_id, owner_id)
    if not prop:
        return False
    prop.is_unused = True
    prop.unused_at = datetime.now(timezone.utc)
    prop.is_published = False
    db.commit()
    return True


def delete_property(db: Session, property_id: int, owner_id: int) -> bool:
    """Landlord remove listing — permanently delete the property and related rows."""
    prop = get_property_by_id(db, property_id, owner_id)
    if not prop:
        return False
    db.delete(prop)
    db.commit()
    return True


def list_unused_properties(db: Session) -> list[Property]:
    return (
        db.query(Property)
        .filter(Property.is_unused.is_(True))
        .order_by(Property.unused_at.desc().nullslast(), Property.id.desc())
        .all()
    )


def restore_unused_property(db: Session, property_id: int) -> Property | None:
    prop = db.query(Property).filter(Property.id == property_id, Property.is_unused.is_(True)).first()
    if not prop:
        return None
    prop.is_unused = False
    prop.unused_at = None
    prop.is_published = False
    db.commit()
    db.refresh(prop)
    return prop


def purge_unused_property(db: Session, property_id: int) -> bool:
    """Platform admin permanent delete of an unused listing."""
    prop = db.query(Property).filter(Property.id == property_id, Property.is_unused.is_(True)).first()
    if not prop:
        return False
    db.delete(prop)
    db.commit()
    return True
