"""Overnight build tests — auth, listings, gallery, billing math, viewings."""
from decimal import Decimal

from app.services.billing_service import _dec, _prev_period, _totals


def test_prev_period():
    assert _prev_period("2026-01") == "2025-12"
    assert _prev_period("2026-02") == "2026-01"


def test_january_a1_billing_math():
    """Acceptance: A1 142→149 @ 150 + garbage 200 + rent 8500 = 9750."""
    water_rate = Decimal("150")
    previous = Decimal("142")
    current = Decimal("149")
    water_units = current - previous
    water_cost = water_units * water_rate
    garbage = Decimal("200")
    rent = Decimal("8500")
    total = water_cost + garbage + rent
    assert water_units == Decimal("7")
    assert water_cost == Decimal("1050")
    assert total == Decimal("9750")


def test_totals_helper():
    lines = [
        {
            "water_units": 7,
            "water_cost": 1050,
            "garbage_fee": 200,
            "rent_amount": 8500,
            "total_due": 9750,
            "arrears": 0,
            "amount_paid": 5000,
            "balance": 4750,
        },
        {
            "water_units": 1,
            "water_cost": 150,
            "garbage_fee": 200,
            "rent_amount": 13000,
            "total_due": 13350,
            "arrears": 1000,
            "amount_paid": 0,
            "balance": 14350,
        },
    ]
    t = _totals(lines)
    assert t["water_units"] == 8.0
    assert t["total_due"] == 23100.0
    assert t["arrears"] == 1000.0
    assert t["balance"] == 19100.0


def test_register_login_and_property_flow(client):
    email = "overnight_landlord@example.com"
    r = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Overnight Landlord",
            "email": email,
            "password": "password123",
            "list_rentals": True,
        },
    )
    assert r.status_code == 200, r.text

    login = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    prop = client.post(
        "/api/v1/properties",
        headers=headers,
        json={
            "name": "Test Court",
            "location": "Nairobi, Test Estate",
            "county": "Nairobi",
            "locality": "Kilimani",
            "listing_type": "rental",
            "contact_phone": "+254700000000",
            "water_rate_per_unit": 150,
            "garbage_fee": 200,
        },
    )
    assert prop.status_code == 200, prop.text
    prop_id = prop.json()["id"]

    unit = client.post(
        "/api/v1/units",
        headers=headers,
        json={"property_id": prop_id, "unit_number": "A1", "rent_amount": 8500},
    )
    assert unit.status_code == 200, unit.text
    unit_id = unit.json()["id"]

    vacant = client.post(
        "/api/v1/units",
        headers=headers,
        json={"property_id": prop_id, "unit_number": "A5", "rent_amount": 13000},
    )
    assert vacant.status_code == 200, vacant.text

    # tiny jpeg-ish data url under limit for gallery
    img = client.post(
        f"/api/v1/properties/{prop_id}/images",
        headers=headers,
        json={"url": "data:image/jpeg;base64,/9j/4AAQ", "is_cover": True},
    )
    assert img.status_code == 201, img.text

    # fill gallery to limit then expect 400 on 7th
    for i in range(5):
        r = client.post(
            f"/api/v1/properties/{prop_id}/images",
            headers=headers,
            json={"url": f"data:image/jpeg;base64,extra{i}"},
        )
        assert r.status_code == 201, r.text
    seventh = client.post(
        f"/api/v1/properties/{prop_id}/images",
        headers=headers,
        json={"url": "data:image/jpeg;base64,too-many"},
    )
    assert seventh.status_code == 400

    # Soft-hide one visible photo — frees a gallery slot (image kept as unused)
    first_img_id = img.json()["id"]
    hide = client.delete(f"/api/v1/properties/{prop_id}/images/{first_img_id}", headers=headers)
    assert hide.status_code == 200
    assert "unused" in hide.json()["message"].lower() or "hidden" in hide.json()["message"].lower()

    after_hide = client.post(
        f"/api/v1/properties/{prop_id}/images",
        headers=headers,
        json={"url": "data:image/jpeg;base64,slot-freed"},
    )
    assert after_hide.status_code == 201, after_hide.text

    pub = client.patch(
        f"/api/v1/properties/{prop_id}",
        headers=headers,
        json={"is_published": True},
    )
    assert pub.status_code == 200
    assert pub.json()["is_published"] is True

    listings = client.get("/api/v1/listings?listing_type=rental")
    assert listings.status_code == 200
    assert any(x["id"] == prop_id for x in listings.json())

    detail = client.get(f"/api/v1/listings/{prop_id}")
    assert detail.status_code == 200
    assert detail.json()["name"] == "Test Court"

    # billing January A1 — acceptance: total 9750
    stmt = client.post(
        f"/api/v1/billing/{prop_id}/2026-01/readings",
        headers=headers,
        json={
            "readings": [
                {
                    "unit_id": unit_id,
                    "previous_reading": 142,
                    "current_reading": 149,
                    "amount_paid": 0,
                }
            ]
        },
    )
    assert stmt.status_code == 200, stmt.text
    a1 = next(x for x in stmt.json()["lines"] if x["unit_number"] == "A1")
    assert a1["water_units"] == 7
    assert a1["water_cost"] == 1050
    assert a1["garbage_fee"] == 200
    assert a1["rent_amount"] == 8500
    assert a1["total_due"] == 9750
    assert a1["arrears"] == 0
    assert a1["tenant_name"] is None  # vacant until tenant assigned

    # vacant A5 must not raise and tenant_name stays null
    a5 = next(x for x in stmt.json()["lines"] if x["unit_number"] == "A5")
    assert a5["tenant_name"] is None

    # February initial auto-fills to 149; unpaid Jan balance carries as arrears
    feb = client.get(f"/api/v1/billing/{prop_id}/2026-02", headers=headers)
    assert feb.status_code == 200
    a1_feb = next(x for x in feb.json()["lines"] if x["unit_number"] == "A1")
    assert a1_feb["previous_reading"] == 149
    assert a1_feb["arrears"] == 9750
    assert a1_feb["balance"] == a1_feb["arrears"] + a1_feb["total_due"] - a1_feb["amount_paid"]

    # Partial January payment, then re-check February arrears after re-saving Feb readings
    pay = client.patch(
        f"/api/v1/billing/readings/{a1['id']}/payment",
        headers=headers,
        json={"amount_paid": 5000},
    )
    assert pay.status_code == 200
    assert pay.json()["balance"] == 4750

    # Save February readings: arrears should be January leftover 4750
    feb_save = client.post(
        f"/api/v1/billing/{prop_id}/2026-02/readings",
        headers=headers,
        json={
            "readings": [
                {
                    "unit_id": unit_id,
                    "previous_reading": 149,
                    "current_reading": 155,
                    "amount_paid": 0,
                }
            ]
        },
    )
    assert feb_save.status_code == 200, feb_save.text
    a1_feb_saved = next(x for x in feb_save.json()["lines"] if x["unit_number"] == "A1")
    assert a1_feb_saved["arrears"] == 4750
    # water 6*150=900 + 200 + 8500 = 9600; balance = 4750 + 9600 - 0
    assert a1_feb_saved["total_due"] == 9600
    assert a1_feb_saved["balance"] == 14350

    # tenant viewing
    client.post(
        "/api/v1/auth/register",
        json={"name": "Tenant", "email": "overnight_tenant@example.com", "password": "password123"},
    )
    tlogin = client.post(
        "/api/v1/auth/login",
        json={"email": "overnight_tenant@example.com", "password": "password123"},
    )
    th = {"Authorization": f"Bearer {tlogin.json()['access_token']}"}
    viewing = client.post(
        "/api/v1/viewings",
        headers=th,
        json={"property_id": prop_id, "message": "Can I view tomorrow?"},
    )
    assert viewing.status_code == 201, viewing.text

    received = client.get("/api/v1/viewings/received", headers=headers)
    assert received.status_code == 200
    assert len(received.json()) >= 1

    # wishlist availability enrichment
    wish = client.post(
        "/api/v1/wishlist",
        headers=th,
        json={
            "title": "Test Court",
            "listing_type": "rental",
            "external_ref": str(prop_id),
            "location_text": "Nairobi",
        },
    )
    assert wish.status_code == 201
    listed = client.get("/api/v1/wishlist", headers=th)
    assert listed.status_code == 200
    item = listed.json()[0]
    assert item["is_available"] is True


def test_password_too_short(client):
    r = client.post(
        "/api/v1/auth/register",
        json={"name": "X", "email": "short@example.com", "password": "short"},
    )
    assert r.status_code == 400
