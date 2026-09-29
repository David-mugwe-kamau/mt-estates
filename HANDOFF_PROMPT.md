# Handoff prompt — finish the arrears + tenant-name billing feature

Copy everything below the line into the new agent.

---

You are continuing work on **MT Estates**, a real estate platform (rentals, Airbnbs, property sales) in Kenya. The project root is:

`C:\Users\LENOVO\OneDrive\Desktop\MT estates`

Stack: FastAPI + SQLAlchemy + PostgreSQL (hosted on Supabase) for the backend in `backend/`, Next.js 14 + TypeScript + Tailwind for the frontend in `frontend/`. The shell is **PowerShell on Windows** — chain commands with `;`, never `&&`.

All commands are pre-approved. Work autonomously and do not stop to ask questions. Make reasonable expert decisions on your own.

## Background: what this feature is

The landlord's #1 feature is **automated monthly billing**. Each month the landlord enters only the current water meter reading for each unit, and the system computes everything else. The statement table has one row per unit with these columns:

`Unit | Tenant | Initial | Current | Units | Water | Garbage | Rent | Arrears | Total | Paid | Balance`

Rules:
- `water_units = current_reading - previous_reading`
- `water_cost = water_units × property.water_rate_per_unit` (default 150)
- `garbage_fee` comes from `property.garbage_fee` (default 200)
- `rent_amount` comes from `unit.rent_amount`
- `total_due = water_cost + garbage_fee + rent_amount`
- `arrears` = last month's unpaid `balance`, carried forward
- `balance = arrears + total_due - amount_paid`
- This month's `previous_reading` auto-fills from last month's `current_reading`

Acceptance figures from the landlord's real January 2026 sheet, which must reproduce exactly: unit A1 with readings 142 → 149, water rate 150, garbage 200, rent 8,500 gives water units 7, water cost 1,050, and **total 9,750**. February's initial reading for A1 must auto-fill to **149**.

## What is already done (do not redo)

The backend work is complete and committed to the working tree:

- `backend/app/models/meter_reading.py` — has an `arrears` column (`Numeric(12,2)`, not null, default 0).
- `backend/app/schemas/billing_schema.py` — `ReadingLineResponse` has `tenant_id`, `tenant_name`, `tenant_phone`, and `arrears`.
- `backend/app/services/billing_service.py` — fully rewritten. `get_statement`, `upsert_readings`, `record_payment`, `list_periods`, and `tenant_ledger` all handle arrears carry-forward and attach tenant details via the `_tenant_for_unit` helper. Tenant info comes from `backend/app/models/tenant.py`, which has `name`, `phone`, and a unique `unit_id`.
- `backend/alembic/versions/006_arrears_carryforward.sql` — written but **not yet applied** to the database.
- API routes already exist in `backend/app/api/billing_routes.py`: `GET /billing/{property_id}/periods`, `GET /billing/{property_id}/{period}`, `POST /billing/{property_id}/{period}/readings`, `PATCH /billing/readings/{reading_id}/payment`.

## Your tasks, in this exact order

### 1. Apply migration 006 to the database

The `arrears` column exists in the SQLAlchemy model but **not in the live Supabase database**. Until you fix this, every billing request will fail with an "undefined column" error. This is the highest priority.

Use the existing helper `backend/apply_migration_005.py` as your template — it loads `DATABASE_URL` from `.env`, splits the SQL file into statements, and executes them. Either generalize it to accept a filename argument or write an equivalent `apply_migration_006.py`. Run it against `alembic/versions/006_arrears_carryforward.sql`.

Do **not** run `alembic upgrade` — Alembic has never worked in this environment. Do not modify the Supabase connection string in `.env`; it points at the `eu-central-1` pooler and is correct.

If the connection fails because of the local network, print the SQL clearly in your final report and mark it as a manual step for the user to paste into the Supabase SQL Editor. Then continue with the remaining tasks.

Verify afterwards by querying `information_schema.columns` for a row where `table_name = 'meter_readings'` and `column_name = 'arrears'`.

### 2. Surface tenant name and arrears in the frontend

Neither `arrears` nor `tenant_name` appears anywhere in the frontend yet — I checked. Two files need updating:

**`frontend/lib/api.ts`** — find the billing TypeScript interface that mirrors `ReadingLineResponse` and add the four new optional fields: `tenant_id?: number | null`, `tenant_name?: string | null`, `tenant_phone?: string | null`, and `arrears: number`.

**`frontend/app/dashboard/properties/[id]/billing/page.tsx`** — this is the landlord's billing screen. Add a **Tenant** column right after Unit (show the tenant name, or a muted dash when the unit is vacant) and an **Arrears** column immediately before Total. Include both in the totals row at the bottom. Make sure the arrears value feeds into the displayed balance, and that the existing print stylesheet still lays the wider table out sensibly on paper.

Match the styling and conventions already used in that file — do not restructure the page or change any existing behaviour.

### 3. Extend the test suite

Add tests to `backend/tests/test_overnight.py`, following the patterns already in that file. Cover:

- The January acceptance case above, asserting A1's total is exactly 9,750.
- February's `previous_reading` for A1 auto-filling to 149.
- Carry-forward: leave January partly unpaid, then confirm February's `arrears` equals January's leftover balance and that February's `balance` equals `arrears + total_due - amount_paid`.
- A vacant unit (no tenant row) returning `tenant_name` as null rather than raising.

### 4. Verify everything

Run all of these and fix whatever fails:

- Backend imports cleanly: from `backend/`, run `python -c "from app.main import app"`.
- All tests pass: from `backend/`, run `pytest -q`.
- The frontend builds: from `frontend/`, run `npx next build`.

### 5. Restart both dev servers

Kill anything already holding the ports first — stale Uvicorn and Next processes have repeatedly caused confusing failures on this machine. Use `Get-NetTCPConnection` plus `Stop-Process`, then start:

- Backend from `backend/`: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Frontend from `frontend/`: `npx next dev -p 3004`

If Next.js throws `EINVAL: invalid argument, readlink`, delete `frontend/.next` and start it again. This is a known OneDrive quirk.

### 6. Report

Append a short section to `NEXT_STEPS.md` titled **"ARREARS + TENANT BILLING"** listing what you completed, anything you skipped and why, and anything the user must do by hand.

## Constraints

- Do not change the Supabase connection string or commit any `.env` file.
- Do not use `alembic upgrade`; apply SQL programmatically.
- Do not alter existing billing behaviour beyond adding arrears and tenant columns.
- Do not add narration comments to the code. Match the surrounding style.

## One known caveat, worth fixing if you have time

`arrears` is frozen onto the row at the moment readings are saved. If the landlord later records a payment against the *previous* month, the current month's arrears becomes stale. The clean fix is to recompute arrears from the previous period's live balance whenever a statement is read, rather than trusting the stored value. Treat this as optional — get tasks 1 through 6 done first.
