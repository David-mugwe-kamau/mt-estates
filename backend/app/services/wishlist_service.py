"""Wishlist / saved homes — free for signed-in users."""
from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.unit import Unit
from app.models.wishlist_item import WishlistItem
from app.schemas.wishlist_schema import WishlistCreate


def list_wishlist(db: Session, user_id: int) -> list[dict]:
    items = (
        db.query(WishlistItem)
        .filter(WishlistItem.user_id == user_id)
        .order_by(WishlistItem.created_at.desc())
        .all()
    )
    result = []
    for item in items:
        available = _compute_availability(db, item)
        result.append(
            {
                "id": item.id,
                "title": item.title,
                "location_text": item.location_text,
                "listing_type": item.listing_type,
                "notes": item.notes,
                "external_ref": item.external_ref,
                "is_available": available,
                "created_at": item.created_at,
            }
        )
    return result


def _compute_availability(db: Session, item: WishlistItem) -> bool | None:
    if not item.external_ref or not str(item.external_ref).isdigit():
        return item.is_available
    prop_id = int(item.external_ref)
    prop = db.query(Property).filter(Property.id == prop_id).first()
    if not prop:
        return False
    if getattr(prop, "is_unused", False):
        return False
    if not prop.is_published:
        return False
    if item.listing_type == "rental":
        vacant = (
            db.query(Unit)
            .filter(
                Unit.property_id == prop.id,
                Unit.status == "vacant",
                Unit.is_unused.is_(False),
            )
            .first()
        )
        return vacant is not None
    return True


def add_wishlist_item(db: Session, user_id: int, data: WishlistCreate) -> WishlistItem:
    existing = None
    if data.external_ref:
        existing = (
            db.query(WishlistItem)
            .filter(
                WishlistItem.user_id == user_id,
                WishlistItem.external_ref == data.external_ref,
            )
            .first()
        )
    if existing:
        return existing

    item = WishlistItem(
        user_id=user_id,
        title=data.title,
        location_text=data.location_text,
        listing_type=data.listing_type,
        notes=data.notes,
        external_ref=data.external_ref,
        is_available=data.is_available,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def delete_wishlist_item(db: Session, user_id: int, item_id: int) -> bool:
    item = db.query(WishlistItem).filter(WishlistItem.id == item_id, WishlistItem.user_id == user_id).first()
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True
