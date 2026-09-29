"""Compare live Supabase schema against expected MT Estates tables/columns."""
from dotenv import load_dotenv
import os
from sqlalchemy import create_engine, text

load_dotenv()
url = os.environ.get("DATABASE_URL")
if not url:
    print("NO_DATABASE_URL")
    raise SystemExit(1)

engine = create_engine(url, pool_pre_ping=True)
needed = [
    "users",
    "properties",
    "units",
    "tenants",
    "property_images",
    "wishlist_items",
    "viewing_requests",
    "meter_readings",
    "rent_payments",
    "subscriptions",
]
cols_check = {
    "properties": [
        "contact_phone",
        "whatsapp",
        "contact_email",
        "latitude",
        "longitude",
        "listing_type",
        "availability_badge",
        "water_rate_per_unit",
        "garbage_fee",
        "main_meter_reading",
        "view_count",
        "image_url",
        "is_published",
    ],
    "users": ["avatar_url"],
    "meter_readings": [
        "arrears",
        "previous_reading",
        "current_reading",
        "water_units",
        "water_cost",
        "garbage_fee",
        "rent_amount",
        "total_due",
        "amount_paid",
        "balance",
        "period",
    ],
    "wishlist_items": ["listing_type", "external_ref"],
}

with engine.connect() as conn:
    tables = {
        r[0]
        for r in conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public'"
            )
        )
    }
    print("=== TABLES ===")
    for t in needed:
        print(("OK" if t in tables else "MISSING") + f": {t}")
    print("=== OTHER PUBLIC TABLES ===")
    for t in sorted(tables):
        if t not in needed:
            print(f"extra: {t}")
    print("=== KEY COLUMNS ===")
    for table, cols in cols_check.items():
        if table not in tables:
            print(f"{table}: TABLE MISSING")
            continue
        existing = {
            r[0]
            for r in conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema='public' AND table_name=:t"
                ),
                {"t": table},
            )
        }
        for c in cols:
            print(("OK" if c in existing else "MISSING") + f": {table}.{c}")
