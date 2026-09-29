"""Property gallery image business logic."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.property_image import PropertyImage
from app.schemas.property_image_schema import FREE_GALLERY_LIMIT, PropertyImageCreate
from app.services.property_service import get_property_by_id


def _visible_filter():
    return PropertyImage.is_unused.is_(False)


def list_property_images(db: Session, property_id: int, owner_id: int) -> list[PropertyImage] | None:
    prop = get_property_by_id(db, property_id, owner_id)
    if not prop:
        return None
    return (
        db.query(PropertyImage)
        .filter(PropertyImage.property_id == property_id, _visible_filter())
        .order_by(PropertyImage.sort_order, PropertyImage.id)
        .all()
    )


def list_public_property_images(db: Session, property_id: int) -> list[PropertyImage]:
    return (
        db.query(PropertyImage)
        .join(Property, Property.id == PropertyImage.property_id)
        .filter(
            Property.id == property_id,
            Property.is_published.is_(True),
            _visible_filter(),
        )
        .order_by(PropertyImage.sort_order, PropertyImage.id)
        .all()
    )


def _visible_count(db: Session, property_id: int, unit_type_id: int | None = None) -> int:
    q = db.query(PropertyImage).filter(PropertyImage.property_id == property_id, _visible_filter())
    if unit_type_id is None:
        q = q.filter(PropertyImage.unit_type_id.is_(None))
    else:
        q = q.filter(PropertyImage.unit_type_id == unit_type_id)
    return q.count()


def add_property_image(
    db: Session, property_id: int, owner_id: int, data: PropertyImageCreate
) -> PropertyImage | None:
    prop = get_property_by_id(db, property_id, owner_id)
    if not prop:
        return None

    if data.unit_type_id:
        from app.models.unit_type import UnitType

        ut = (
            db.query(UnitType)
            .filter(UnitType.id == data.unit_type_id, UnitType.property_id == property_id)
            .first()
        )
        if not ut:
            raise ValueError("Apartment type not found on this listing")

    count = _visible_count(db, property_id, data.unit_type_id)
    scope = "this apartment type" if data.unit_type_id else "the listing"
    if count >= FREE_GALLERY_LIMIT:
        raise ValueError(f"Free gallery limit is {FREE_GALLERY_LIMIT} photos for {scope}")

    image = PropertyImage(
        property_id=property_id,
        url=data.url,
        sort_order=count,
        is_cover=False,
        is_unused=False,
        unused_at=None,
        unit_type_id=data.unit_type_id,
    )
    db.add(image)
    db.flush()

    if data.is_cover or count == 0:
        _clear_cover(db, property_id, data.unit_type_id)
        image.is_cover = True
        if not data.unit_type_id:
            prop.image_url = data.url[:500] if len(data.url) <= 500 else None
        if prop.cover_image_id is None:
            prop.cover_image_id = image.id

    db.commit()
    db.refresh(image)
    return image


def hide_property_image(db: Session, property_id: int, image_id: int, owner_id: int) -> bool:
    """Landlord remove — soft-hide as unused (not permanently deleted)."""
    prop = get_property_by_id(db, property_id, owner_id)
    if not prop:
        return False

    image = (
        db.query(PropertyImage)
        .filter(
            PropertyImage.id == image_id,
            PropertyImage.property_id == property_id,
            _visible_filter(),
        )
        .first()
    )
    if not image:
        return False

    was_cover = image.is_cover
    image.is_unused = True
    image.unused_at = datetime.now(timezone.utc)
    image.is_cover = False
    db.commit()

    if was_cover:
        _promote_next_cover(db, prop, image.unit_type_id)
    if prop.cover_image_id == image_id:
        prop.cover_image_id = None
        db.commit()

    return True


# Keep old name as alias so existing imports don't break mid-edit
delete_property_image = hide_property_image


def set_cover_image(db: Session, property_id: int, image_id: int, owner_id: int) -> PropertyImage | None:
    prop = get_property_by_id(db, property_id, owner_id)
    if not prop:
        return None

    image = (
        db.query(PropertyImage)
        .filter(
            PropertyImage.id == image_id,
            PropertyImage.property_id == property_id,
            _visible_filter(),
        )
        .first()
    )
    if not image:
        return None

    _clear_cover(db, property_id, image.unit_type_id)
    image.is_cover = True
    if not image.unit_type_id:
        prop.image_url = image.url[:500] if len(image.url) <= 500 else None
    if prop.cover_image_id is None:
        prop.cover_image_id = image.id
    db.commit()
    db.refresh(image)
    return image


def list_unused_images(db: Session) -> list[PropertyImage]:
    return (
        db.query(PropertyImage)
        .filter(PropertyImage.is_unused.is_(True))
        .order_by(PropertyImage.unused_at.desc().nullslast(), PropertyImage.id.desc())
        .all()
    )


def restore_unused_image(db: Session, image_id: int) -> PropertyImage | None:
    image = (
        db.query(PropertyImage)
        .filter(PropertyImage.id == image_id, PropertyImage.is_unused.is_(True))
        .first()
    )
    if not image:
        return None

    visible = _visible_count(db, image.property_id, image.unit_type_id)
    if visible >= FREE_GALLERY_LIMIT:
        raise ValueError(
            f"Cannot restore — this gallery already has {FREE_GALLERY_LIMIT} visible photos. "
            "Hide another photo first."
        )

    image.is_unused = False
    image.unused_at = None
    prop = db.query(Property).filter(Property.id == image.property_id).first()
    if prop and visible == 0:
        _clear_cover(db, image.property_id, image.unit_type_id)
        image.is_cover = True
        if prop and not image.unit_type_id:
            prop.image_url = image.url[:500] if len(image.url) <= 500 else None
    db.commit()
    db.refresh(image)
    return image


def purge_unused_image(db: Session, image_id: int) -> bool:
    """Platform admin permanent delete of an unused image."""
    image = (
        db.query(PropertyImage)
        .filter(PropertyImage.id == image_id, PropertyImage.is_unused.is_(True))
        .first()
    )
    if not image:
        return False
    db.delete(image)
    db.commit()
    return True


def _promote_next_cover(db: Session, prop: Property, unit_type_id: int | None = None) -> None:
    q = db.query(PropertyImage).filter(PropertyImage.property_id == prop.id, _visible_filter())
    if unit_type_id is None:
        q = q.filter(PropertyImage.unit_type_id.is_(None))
    else:
        q = q.filter(PropertyImage.unit_type_id == unit_type_id)
    next_cover = q.order_by(PropertyImage.sort_order, PropertyImage.id).first()
    if next_cover:
        next_cover.is_cover = True
        if unit_type_id is None:
            prop.image_url = next_cover.url[:500] if len(next_cover.url) <= 500 else None
        if prop.cover_image_id is None:
            prop.cover_image_id = next_cover.id
    elif unit_type_id is None:
        prop.image_url = None
    db.commit()


def _clear_cover(db: Session, property_id: int, unit_type_id: int | None = None) -> None:
    q = db.query(PropertyImage).filter(
        PropertyImage.property_id == property_id,
        PropertyImage.is_cover.is_(True),
        _visible_filter(),
    )
    if unit_type_id is None:
        q = q.filter(PropertyImage.unit_type_id.is_(None))
    else:
        q = q.filter(PropertyImage.unit_type_id == unit_type_id)
    for img in q:
        img.is_cover = False
