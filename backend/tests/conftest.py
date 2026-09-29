"""Pytest fixtures for MT Estates tests."""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Use in-memory SQLite for tests (or set TEST_DATABASE_URL in env)
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.main import app
from app.database.base import Base
from app.database.session import get_db


@pytest.fixture(scope="function")
def db_engine():
    """Create a fresh DB engine for each test (SQLite in-memory)."""
    db_url = os.environ.get("DATABASE_URL", "sqlite:///:memory:")
    if db_url.startswith("sqlite"):
        engine = create_engine(
            db_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    else:
        engine = create_engine(db_url, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(db_engine):
    """Provide a DB session for tests."""
    Session = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_engine):
    """Test client with overridden get_db to use test DB."""
    Session = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    Base.metadata.create_all(bind=db_engine)

    def override_get_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
