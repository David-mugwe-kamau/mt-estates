"""Database engine and session management."""
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.database.base import Base

# Create engine (sync for SQLAlchemy 2.0 with psycopg2; SQLite tests skip pool args)
_db_url = settings.database_url
_engine_kwargs = (
    {
        "connect_args": {"check_same_thread": False},
    }
    if _db_url.startswith("sqlite")
    else {
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 10,
    }
)
engine = create_engine(_db_url, echo=settings.debug, **_engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables (use Alembic in production)."""
    Base.metadata.create_all(bind=engine)
