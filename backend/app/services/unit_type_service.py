"""Apartment types for a listing — photos stay on the type (no copies)."""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.property_image import PropertyImage
from app.models.unit import Unit
from app.models.unit_type import UNIT_CATEGORIES, UnitType
from app.schemas.property_image_schema import PropertyImageResponse
from app.schemas.unit_type_schema import UnitTypeCreate, UnitTypeUpdate
from app.services.property_service import get_property_by_id


def _visible_units():
    return Unit.is_unused.is_(False)


def _visible_images():
    return PropertyImage.is_unused.is_(False)


def create_unit_type(db: Session, property_id: int, owner_id: int, data: UnitTypeCreate) -> UnitType:
    prop = get_property_by_id(db, property_id, owner_id)
    if not prop:
        raise ValueError("Property not found")
    if data.category not in UNIT_CATEGORIES:
        raise ValueError("Unknown apartment type")
    if data.category == "other" and not (data.custom_label or "").strip():
        raise ValueError("Type a name for Other")

    existing = (
        db.query(UnitType)
        .filter(UnitType.property_id == property_id, UnitType.category == data.category)
        .all()
    )
    if data.category != "other" and existing:
        raise ValueError("This apartment type is already on the listing")

    count = db.query(UnitType).filter(UnitType.property_id == property_id).count()
    row = UnitType(
        property_id=property_id,
        category=data.category,
        custom_label=(data.custom_label or "").strip() or None,
        rent_amount=Decimal(str(data.rent_amount)) if data.rent_amount is not None else None,
        is_vacant=True,
        sort_order=count,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_unit_type(db: Session, type_id: int, owner_id: int, data: UnitTypeUpdate) -> UnitType | None:
    row = (
        db.query(UnitType)
        .join(Property)
        .filter(UnitType.id == type_id, Property.owner_id == owner_id, Property.is_unused.is_(False))
        .first()
    )
    if not row:
        return None
    if data.category is not None:
        if data.category not in UNIT_CATEGORIES:
            raise ValueError("Unknown apartment type")
        row.category = data.category
    if data.custom_label is not None:
        row.custom_label = data.custom_label.strip() or None
    if data.rent_amount is not None:
        row.rent_amount = Decimal(str(data.rent_amount))
    if data.is_vacant is not None:
        row.is_vacant = data.is_vacant
    db.commit()
    db.refresh(row)
    return row


def delete_unit_type(db: Session, type_id: int, owner_id: int) -> bool:
    row = (
        db.query(UnitType)
        .join(Property)
        .filter(UnitType.id == type_id, Property.owner_id == owner_id, Property.is_unused.is_(False))
        .first()
    )
    if not row:
        return False
    live_units = db.query(Unit).filter(Unit.unit_type_id == type_id, _visible_units()).count()
    if live_units:
        raise ValueError("Move or remove units of this type first")
    for img in db.query(PropertyImage).filter(PropertyImage.unit_type_id == type_id, _visible_images()):
        img.unit_type_id = None
        img.is_unused = True
    db.delete(row)
    db.commit()
    return True


def set_listing_cover(db: Session, property_id: int, owner_id: int, image_id: int) -> Property:
    prop = get_property_by_id(db, property_id, owner_id)
    if not prop:
        raise ValueError("Property not found")
    image = (
        db.query(PropertyImage)
        .filter(
            PropertyImage.id == image_id,
            PropertyImage.property_id == property_id,
            _visible_images(),
        )
        .first()
    )
    if not image:
        raise ValueError("Photo not found on this listing")
    prop.cover_image_id = image.id
    db.commit()
    db.refresh(prop)
    return prop


def serialize_unit_types(db: Session, property_id: int, vacant_only: bool = False) -> list[dict]:
    types = (
        db.query(UnitType)
        .filter(UnitType.property_id == property_id)
        .order_by(UnitType.sort_order, UnitType.id)
        .all()
    )
    images = (
        db.query(PropertyImage)
        .filter(PropertyImage.property_id == property_id, _visible_images())
        .order_by(PropertyImage.sort_order, PropertyImage.id)
        .all()
    )
    units = db.query(Unit).filter(Unit.property_id == property_id, _visible_units()).all()
    out = []
    for t in types:
        if vacant_only and not t.is_vacant:
            continue
        t_imgs = [i for i in images if i.unit_type_id == t.id]
        t_units = [u for u in units if u.unit_type_id == t.id]
        rents = [float(u.rent_amount) for u in t_units]
        type_rent = float(t.rent_amount) if t.rent_amount is not None else None
        min_rent = type_rent if type_rent is not None else (min(rents) if rents else None)
        out.append(
            {
                "id": t.id,
                "property_id": t.property_id,
                "category": t.category,
                "custom_label": t.custom_label,
                "label": t.display_label(),
                "sort_order": t.sort_order,
                "rent_amount": type_rent,
                "is_vacant": t.is_vacant,
                "images": [PropertyImageResponse.model_validate(i) for i in t_imgs],
                "vacant_units": sum(1 for u in t_units if u.status == "vacant"),
                "total_units": len(t_units),
                "min_rent": min_rent,
                "created_at": t.created_at,
            }
        )
    return out
