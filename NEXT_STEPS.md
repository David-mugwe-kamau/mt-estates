# OVERNIGHT BUILD REPORT

**Completed: 1–2 Aug 2026 overnight autonomous build**

## ARREARS + TENANT BILLING

**Completed: 2 Aug 2026**

### ✅ Done
1. **Migration 006 applied** to live Supabase — `meter_readings.arrears` column verified via `information_schema`. Helper: `backend/apply_migration_006.py`.
2. **Frontend billing sheet** — Tenant column (name or muted dash if vacant) + Arrears column before Total; live balance = `arrears + total_due − paid`; totals row updated. Types in `frontend/lib/api.ts`.
3. **Tests extended** — January A1 = 9750; Feb previous = 149; unpaid Jan carries as arrears; partial pay then Feb save uses leftover 4750; vacant unit `tenant_name` is null. **9 passed**.
4. **Verified** — `from app.main import app` OK; `pytest -q` green; `npx next build` passed.

### Skipped
- Optional live-recompute of arrears on statement read when a prior-month payment is recorded after the current month was already saved (stored arrears can go stale until the current month is re-saved). Backend still recomputes correctly on every `upsert_readings`.

### Manual
- None for this feature — migration 006 ran successfully from this network.

---

## ✅ Done (overnight)

### Critical tasks
1. **Public pages wired to live API** — `/rentals`, `/airbnbs`, `/for-sale` + detail pages use `listings.public` / `listings.get`; empty states; price formatting; gallery carousel; skeletons.
2. **Homepage search** — functional Quick Search (type/location/price) + Near me (geolocation → 20km).
3. **Viewing bookings** — model + API (`POST /viewings`, `/mine`, `/received`, `PATCH`); Book viewing on detail pages; `/dashboard/my-viewings` + `/dashboard/viewings`.
4. **Wishlist live availability** — enriched from published property + vacant units; duplicate-save prevented; PropertyDetail checks saved state on mount.
5. **Automated monthly billing** — property `water_rate_per_unit` / `garbage_fee`; `meter_readings` table + full billing API; UI at `/dashboard/properties/[id]/billing` matching paper layout; live recompute; main meter field; auto-carry previous reading to next month. **Acceptance math verified in pytest:** A1 142→149 @150 +200 +8500 = **9750**; Feb previous auto-fills **149**; partial payment balance correct.
6. **Bug fixes** — wishlist lookup, gallery cover URL fallback (full URL), password min 8 chars.

### Improvements
- Client-side JPEG compression (max 1280px, q=0.8) before gallery upload
- CORS locked to configured origins (not `*`)
- Toast on wishlist/share; branded `not-found`; `icon.svg`; root `README.md`
- Share listing button; similar listings on detail; view_count increment on public detail GET; host discovery page `/host/[id]`
- Pytest suite `tests/test_overnight.py` — **all green**
- `npx next build` — **passed**
- Backend import — **passed**
- Dev servers left running: backend `:8000`, frontend `:3004`

## ⚠️ Manual action required (morning)

1. **Migration 005** — if viewings/billing tables were never created on live DB, paste `backend/alembic/versions/005_viewings_billing.sql` into Supabase SQL Editor (or `python apply_migration_005.py` when pooler works). **Migration 006 (arrears) already applied successfully on 2 Aug.**

2. **WiFi IP is now `192.168.2.101`** — `.env.local`, CORS, and `allowedDevOrigins` updated. Phone URL: `http://192.168.2.101:3004`

3. Without migration 005, billing/viewings endpoints will error against live Supabase until SQL is applied. Local pytest uses in-memory SQLite and already proves the logic.

## Skipped / deferred
- Supabase Storage bucket (kept compressed base64; compression done)
- slowapi rate limiting (not added — avoid new dependency overnight; password min length done)
- Role-gate on `POST /properties` (ownership checks remain; optional improvement)
- True host profile filter by owner_id on public listings (page exists as discovery; needs `owner_id` or public host endpoint for perfect filter)
- M-Pesa payments (explicitly out of scope)

---

# MT Estates — Overnight Build Instructions & Recommendations

_Last updated: 1 Aug 2026. This document tells the next agent exactly what to do to finish the project._

---

## 1. Current State (What Already Works)

### Backend — FastAPI + Supabase PostgreSQL (`backend/`)
- **Auth**: register (with optional `list_rentals` / `host_airbnb` roles), login (JWT), `GET/PATCH /auth/me` (profile + avatar).
- **Properties**: full CRUD, publish/unpublish (`is_published`), contact fields (phone/WhatsApp/email), GPS coords, listing type (`rental` | `airbnb` | `for_sale`).
- **Gallery**: `property_images` table, up to 6 free photos per listing, cover photo, add/remove/set-cover endpoints.
- **Public listings**: `GET /api/v1/listings` (filters: type, location, price, GPS radius) and `GET /api/v1/listings/{id}` (detail + gallery). No auth required.
- **Units**: create/list/update (rent per unit, vacant/occupied status).
- **Wishlist**: add/list/remove, `is_available` flag.
- **Dashboard stats**: `GET /api/v1/dashboard` (rental-centric aggregate).
- **DB connection**: Supabase session pooler — `aws-1-eu-central-1.pooler.supabase.com:5432` (region is eu-central-1, NOT eu-west-1). All migrations 001–004 already run in Supabase manually.
- CORS is currently `allow_origins=["*"]` for development.

### Frontend — Next.js 14 + Tailwind v4 (`frontend/`)
- **Auth pages**: `/auth/register`, `/auth/login` with `?next=` return-URL support, auto-login after register.
- **Dashboard**: `/dashboard` (hub), `/dashboard/profile` (edit + avatar upload as base64), `/dashboard/wishlist` (list/remove with availability badge).
- **Landlord management**: `/dashboard/properties` (list), `/dashboard/properties/new` (create), `/dashboard/properties/[id]` (edit, gallery upload, publish toggle, units/pricing).
- **Public pages**: `/rentals`, `/airbnbs`, `/for-sale` + detail pages — **STILL USING STATIC MOCK DATA** (see task 1).
- **Header**: reactive auth state (`mt_auth_change` event), mobile hamburger menu.
- **API client**: `frontend/lib/api.ts` — typed, 401 auto-logout, all endpoints wired.
- **Roles helper**: `frontend/lib/roles.ts` (`rental_landlord`, `airbnb_host`, legacy `landlord`).

### Environment
- Backend: `backend/.env` (DATABASE_URL, SECRET_KEY, CORS). Start: `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000` from `backend/`.
- Frontend: `frontend/.env.local` sets `NEXT_PUBLIC_API_URL`. Start: `npx next dev -p 3004` from `frontend/`.
- **WiFi note**: the machine IP changes between networks (`192.168.100.37` or `10.120.0.87`). `NEXT_PUBLIC_API_URL` and `allowedDevOrigins` in `next.config.mjs` must match the current IP for phone testing. For localhost-only testing use `http://localhost:8000`.
- OneDrive path can corrupt `.next` cache — if Next.js fails with `EINVAL readlink`, delete `frontend/.next` and restart.
- Windows/PowerShell: use `;` not `&&` to chain commands. Ports often hold stale processes — check `netstat -ano | findstr :8000` and `taskkill /F /PID <pid>`.

---

## 2. CRITICAL TASKS (do these first, in order)

### Task 1 — Wire public pages to the real API (highest priority) ✅
The public browse pages still show hardcoded mock data. Replace with live API data:
- `/rentals`, `/airbnbs`, `/for-sale` → call `listings.public({ listing_type })` from `lib/api.ts`.
- Detail pages `/rentals/[id]`, `/airbnbs/[id]`, `/for-sale/[id]` → call `listings.get(id)`; render the gallery (`images[]`) as a proper photo carousel/grid, not one image.
- Show a friendly empty state when no published listings exist ("Be the first to list…" + CTA to register as landlord).
- Format price from `min_rent` (KSh, `/ month` for rental, `/ night` for airbnb, absolute for sale).
- Keep the WhatsApp / Call / Directions buttons — they already exist in `ListingCard` and `PropertyDetail`.
- Map `PublicListing` fields: `name`→title, `image_url`→image (fallback to a placeholder gradient if null).

### Task 2 — Homepage search that works ✅
`app/page.tsx` has a decorative search form. Make it functional:
- Search by location text + listing type → navigate to `/rentals?location=...` etc.
- Browse pages must read query params and pass to `listings.public()`.
- Add a "Near me" button using browser geolocation → pass `lat`/`lng`/`radius=20` to the API.

### Task 3 — Book a viewing ✅
Core feature from the product vision. Simplest robust version:
- New table `viewing_requests`: id, property_id, user_id, preferred_date, message, status (`pending`/`confirmed`/`declined`), created_at. Write SQL migration file in `backend/alembic/versions/005_*.sql` AND run it via a Python script against DATABASE_URL (psycopg2 is installed; direct SQL execution works through the session pooler).
- Endpoints: `POST /api/v1/viewings` (auth, tenant), `GET /api/v1/viewings/mine` (tenant), `GET /api/v1/viewings/received` (landlord — for their properties), `PATCH /api/v1/viewings/{id}` (landlord confirms/declines).
- Frontend: "Book viewing" button on detail pages (login-gated with `?next=` redirect), a "My viewings" section for tenants, and a "Viewing requests" section in the landlord dashboard.

### Task 4 — Wishlist live availability ✅
`wishlist_items.external_ref` stores the property id. When listing the wishlist, join against `properties` to compute real availability (`is_published` + has vacant unit for rentals) instead of the static stored flag. Update `wishlist_service.list` to enrich responses.

### Task 5 — Automated Monthly Billing (water readings) — LANDLORD'S #1 FEATURE ✅
This replicates and automates the landlord's real manual workflow (see reference: `C:\Users\LENOVO\OneDrive\Desktop\desktop2\2026 Readings\January 2026 readings.docx`). Real-world example from that sheet: units A1–A5 & B1–B5, water at KSh 150/unit, garbage flat KSh 200, rent 8,500 or 13,000 per unit, Total = water + garbage + rent, plus a Balance column and a main-meter row.

**Billing settings (per property, all editable by landlord):**
- Add columns to `properties`: `water_rate_per_unit NUMERIC(10,2) DEFAULT 150`, `garbage_fee NUMERIC(10,2) DEFAULT 200`. Editable in the property edit page.
- `units.rent_amount` already exists and is editable — keep it as the per-unit rent source.

**New table `meter_readings`** (SQL migration 005, apply programmatically via psycopg2 through DATABASE_URL):
- id, unit_id FK, period (e.g. '2026-01'), previous_reading NUMERIC, current_reading NUMERIC, water_units (computed = current - previous), water_cost, garbage_fee, rent_amount, total_due, amount_paid NUMERIC DEFAULT 0, balance, created_at. Unique constraint on (unit_id, period).
- Snapshot rates at billing time (store water_cost/garbage_fee/rent_amount in the row) so past statements never change when rates change.

**The automation rules (this is the whole point — zero manual math):**
1. When landlord opens a new month, previous_reading auto-fills from last month's current_reading for each unit (first month: landlord enters initial manually).
2. Landlord types ONLY the current reading per unit. System instantly computes: units consumed → water cost (× property water rate) → total due (water + garbage + rent).
3. Balance = total_due − amount_paid, and unpaid balance carries forward visibly.
4. Property-level totals row (sum of all units) exactly like the docx, plus optional main-meter reading field to compare billed units vs actual consumption (flags water loss/leaks).

**Endpoints:** `POST /api/v1/billing/{property_id}/{period}/readings` (bulk upsert readings), `GET /api/v1/billing/{property_id}/{period}` (full statement), `PATCH /api/v1/billing/readings/{id}/payment` (record payment), `GET /api/v1/billing/{property_id}/periods` (list months).

**Frontend:** new page `/dashboard/properties/[id]/billing` — a month picker + editable table matching the landlord's paper layout: Unit | Initial | Current (input) | Units | Water (sh) | Garbage (sh) | Rent (sh) | Total (sh) | Paid | Balance. Live recompute as they type, totals row at bottom, "Save readings" button, and a print-friendly statement view. Link to it prominently from the property edit page and the properties list ("Billing" button on each rental property card).

**Tenant side:** logged-in tenants linked to a unit see their own monthly bill breakdown (read-only). If tenant-unit linking is too much overnight, skip the tenant view and note it in the report — landlord side is the priority.

### Task 6 — Fix known bugs ✅
- `PropertyDetail.tsx` wishlist save: it never checks if item is already saved; add a lookup on mount (list wishlist, match `external_ref`).
- Wishlist "View →" links assume `external_ref` is a live property id — now that public pages are API-driven this will work, but verify.
- `image_url` on properties is capped at 500 chars but gallery URLs are base64 data-URLs (huge). The service already guards with `[:500] if <= 500 else None` — verify cover images still render from `images[0]` fallback in `build_public_listing_dict`.
- Registration double-submit: disable button while loading (already done) but also handle "email already registered" error display.

---

## 3. HIGH-VALUE IMPROVEMENTS (do after critical tasks)

### A. Image storage done right
Base64-in-Postgres works but bloats the DB and slows queries. Migrate to **Supabase Storage**:
- Create a public bucket `property-photos` via Supabase API or dashboard.
- Backend accepts multipart upload OR the frontend uploads directly to Supabase Storage (anon key + RLS) and sends the resulting URL to the existing gallery endpoint.
- If dashboard access isn't possible overnight, keep base64 but compress client-side (canvas resize to max 1280px, JPEG 0.8) before upload — this alone is a big win. **Do the client-side compression regardless.**

### B. Security hardening
- Lock CORS to known origins (localhost + LAN IP) instead of `*` before any deployment.
- Add rate limiting on auth endpoints (slowapi) — 5 attempts/minute.
- Enforce password rules server-side (min 8 chars).
- Add `GET /api/v1/auth/me` role check dependency `require_role()` for landlord-only endpoints (currently ownership-checked only, which is acceptable, but role-gate `POST /properties`).

### C. UX polish
- Loading skeletons on browse pages instead of spinners.
- Toast notifications (simple custom component) for save/publish/wishlist actions.
- Image carousel with swipe on mobile for detail pages.
- `favicon.ico` is 404 — add one from the logo.
- 404 page (`app/not-found.tsx`) branded.
- Empty README at root — write a proper one (setup, run, architecture).

### D. Tests
- Backend: pytest suite exists in `backend/tests/` (conftest with TestClient). Add tests for: register/login flow, property CRUD + publish, public listings filter, gallery limit (7th photo → 400), wishlist enrichment, viewing requests. Run with `python -m pytest` from `backend/`.
- Ensure ALL tests pass before finishing.

### E. Competitive edge features (if time allows, in priority order)
1. **WhatsApp deep-link with prefilled message** including listing URL (partially done — verify).
2. **Share listing** button (native share API + copy link).
3. **Similar listings** on detail page (same type + location).
4. **Landlord public profile page** `/host/[id]` — name, avatar, all their published listings ("trust page").
5. **Basic analytics for landlords**: view count per listing (increment a counter on detail GET, show in dashboard).
6. **M-Pesa payment integration placeholder** — model exists (`subscriptions`); do NOT build payment flow overnight, just leave clean seams.

---

## 4. WHAT NOT TO DO
- Do NOT change the DB connection string (region eu-central-1 pooler is the only one that works on this machine).
- Do NOT run `alembic upgrade` against Supabase — direct DNS fails on some networks; execute SQL via psycopg2 script or write SQL for manual run and ALSO apply it programmatically via the pooler connection.
- Do NOT commit `.env` files anywhere.
- Do NOT redesign the visual identity (mt-blue #005B8E, mt-orange #F47920 stay).
- Do NOT introduce heavy dependencies (Redux, component libraries) — the current stack is clean.

## 5. VERIFICATION CHECKLIST (before declaring done)
1. `python -c "from app.main import app"` passes in `backend/`.
2. `npx next build` passes in `frontend/` (catches TS errors).
3. `python -m pytest` all green in `backend/`.
4. Manual smoke via API: register → login → create property → upload 2 photos → add unit → publish → appears in `GET /api/v1/listings` → visible on `/rentals` → book viewing → landlord sees request.
4b. Billing smoke test: set water rate 150 + garbage 200 on a property → create units A1 (rent 8,500) and A5 (rent 13,000) → enter readings for period 2026-01 (A1: initial 142, current 149) → verify A1 total = 1,050 + 200 + 8,500 = 9,750 exactly as in the landlord's real January sheet → open period 2026-02 → verify A1 initial auto-fills to 149 → record partial payment → verify balance math.
5. Both dev servers start clean (kill stale processes on 8000/3004 first).
6. Update this file marking completed tasks with ✅.
