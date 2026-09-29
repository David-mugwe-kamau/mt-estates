"""Database initialization - creates tables from models."""
from app.database.base import Base
from app.database.session import engine

# Import all models so they are registered with Base.metadata
from app.models.user import User  # noqa: F401
from app.models.user_role import UserRole  # noqa: F401
from app.models.subscription import Subscription  # noqa: F401
from app.models.wishlist_item import WishlistItem  # noqa: F401
from app.models.property import Property  # noqa: F401
from app.models.unit import Unit  # noqa: F401
from app.models.tenant import Tenant  # noqa: F401
from app.models.rent_payment import RentPayment  # noqa: F401


def create_tables() -> None:
    """Create all tables in the database."""
    Base.metadata.create_all(bind=engine)
