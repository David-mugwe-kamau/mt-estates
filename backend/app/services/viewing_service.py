"""Viewing request business logic."""
from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.user import User
from app.models.viewing_request import ViewingRequest
from app.schemas.viewing_schema import ViewingCreate, ViewingUpdate


def create_viewing(db: Session, user_id: int, data: ViewingCreate) -> ViewingRequest:
    prop = db.query(Property).filter(
        Property.id == data.property_id,
        Property.is_published.is_(True),
        Property.is_unused.is_(False),
    ).first()
    if not prop:
        raise ValueError("Property not found or not published")
    if prop.owner_id == user_id:
        raise ValueError("You cannot book a viewing for your own listing")

    item = ViewingRequest(
        property_id=data.property_id,
        user_id=user_id,
        preferred_date=data.preferred_date,
        message=data.message,
        status="pending",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_my_viewings(db: Session, user_id: int) -> list[dict]:
    rows = (
        db.query(ViewingRequest, Property)
        .join(Property, Property.id == ViewingRequest.property_id)
        .filter(ViewingRequest.user_id == user_id)
        .order_by(ViewingRequest.created_at.desc())
        .all()
    )
    return [_to_dict(v, prop=p) for v, p in rows]


def list_received_viewings(db: Session, owner_id: int) -> list[dict]:
    rows = (
        db.query(ViewingRequest, Property, User)
        .join(Property, Property.id == ViewingRequest.property_id)
        .join(User, User.id == ViewingRequest.user_id)
        .filter(Property.owner_id == owner_id)
        .order_by(ViewingRequest.created_at.desc())
        .all()
    )
    return [_to_dict(v, prop=p, user=u) for v, p, u in rows]


def update_viewing(db: Session, viewing_id: int, owner_id: int, data: ViewingUpdate) -> ViewingRequest | None:
    if data.status not in ("pending", "confirmed", "declined"):
        raise ValueError("Invalid status")
    row = (
        db.query(ViewingRequest)
        .join(Property, Property.id == ViewingRequest.property_id)
        .filter(ViewingRequest.id == viewing_id, Property.owner_id == owner_id)
        .first()
    )
    if not row:
        return None
    row.status = data.status
    db.commit()
    db.refresh(row)
    return row


def _to_dict(v: ViewingRequest, prop: Property | None = None, user: User | None = None) -> dict:
    return {
        "id": v.id,
        "property_id": v.property_id,
        "user_id": v.user_id,
        "preferred_date": v.preferred_date,
        "message": v.message,
        "status": v.status,
        "created_at": v.created_at,
        "property_name": prop.name if prop else None,
        "property_location": prop.location if prop else None,
        "requester_name": user.name if user else None,
        "requester_email": user.email if user else None,
        "requester_phone": user.phone if user else None,
        "listing_type": prop.listing_type if prop else None,
        "contact_phone": prop.contact_phone if prop else None,
        "contact_whatsapp": prop.contact_whatsapp if prop else None,
    }
