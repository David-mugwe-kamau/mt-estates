"""Tests for auth endpoints."""
import pytest
from fastapi.testclient import TestClient


def test_register(client: TestClient):
    """Register a new user."""
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "name": "John Landlord",
            "email": "john@example.com",
            "password": "securepass123",
            "phone": "+254700000000",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "john@example.com"
    assert data["name"] == "John Landlord"
    assert "password" not in data


def test_register_duplicate_email(client: TestClient):
    """Duplicate email returns 400."""
    payload = {
        "name": "Jane",
        "email": "jane@example.com",
        "password": "pass123",
    }
    client.post("/api/v1/auth/register", json=payload)
    resp = client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 400


def test_login(client: TestClient):
    """Login returns token."""
    client.post(
        "/api/v1/auth/register",
        json={"name": "Test", "email": "test@example.com", "password": "secret123"},
    )
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "secret123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid(client: TestClient):
    """Invalid credentials return 401."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "wrong"},
    )
    assert resp.status_code == 401
