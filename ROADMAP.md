# MT Estates — Full Completion Roadmap

**Project:** Property management SaaS + real estate marketplace for Kenya  
**Stack:** FastAPI (Python) · PostgreSQL · Next.js 14 (TypeScript) · Tailwind CSS  
**Current state:** ~35–40% complete — backend is strong, frontend needs connecting  

---

## How to use this document

Work through each phase in order. Each task has a clear scope.  
Check off tasks as they are completed. Do not skip phases.

---

## PHASE 1 — Make the backend run locally

**Goal:** The FastAPI server starts and connects to a real database.  
**Estimated time:** 2–4 hours

### Tasks

- [ ] **1.1** Create a Python virtual environment inside `backend/`
  ```
  cd backend
  python -m venv venv
  venv\Scripts\activate   (Windows)
  ```

- [ ] **1.2** Install all Python dependencies
  ```
  pip install -r requirements.txt
  ```

- [ ] **1.3** Set up PostgreSQL (choose one):
  - Option A: Install PostgreSQL locally and run `createdb mt_estates`
  - Option B: Run via Docker: `docker run -d --name mt-estates-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mt_estates -p 5432:5432 postgres:15`

- [ ] **1.4** Fix `.env` — replace the placeholder `SECRET_KEY` with a real 32+ character random string
  ```
  SECRET_KEY=replace-this-with-a-real-secret-key-at-least-32-chars
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mt_estates
  ```

- [ ] **1.5** Run Alembic database migrations
  ```
  cd backend
  alembic upgrade head
  ```

- [ ] **1.6** Start the FastAPI server
  ```
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  ```

- [ ] **1.7** Verify it works — open `http://localhost:8000/docs` in a browser and confirm the Swagger UI loads

- [ ] **1.8** Run existing tests to confirm nothing is broken
  ```
  pytest
  ```

**Phase 1 done when:** The backend starts, `/health` returns `{"status": "ok"}`, and the docs page loads.

---

## PHASE 2 — Make the frontend run locally

**Goal:** The Next.js app starts and the homepage loads correctly in a browser.  
**Estimated time:** 30 minutes

### Tasks

- [ ] **2.1** Install frontend dependencies
  ```
  cd frontend
  npm install
  ```

- [ ] **2.2** Start the frontend dev server
  ```
  npm run dev
  ```
  (Runs on port 3004 as configured in `package.json`)

- [ ] **2.3** Open `http://localhost:3004` and confirm the homepage loads with the hero section, HeroSlider, and category cards

- [ ] **2.4** Create a `.env.local` file inside `frontend/` for the API URL
  ```
  NEXT_PUBLIC_API_URL=http://localhost:8000
  ```

**Phase 2 done when:** The homepage loads, images show, nav links work, and no console errors appear.

---

## PHASE 3 — Frontend auth pages (Login + Register)

**Goal:** Users can register and log in. The nav "Login" button works. JWT token is stored.  
**Estimated time:** 4–6 hours

### Tasks

- [ ] **3.1** Create `frontend/lib/api.ts` — a typed API client that wraps `fetch` calls to the backend

- [ ] **3.2** Create `frontend/app/auth/register/page.tsx` — registration form
  - Fields: Name, Email, Phone, Password
  - On submit: POST to `/api/v1/auth/register`
  - On success: redirect to `/auth/login`
  - Show error messages inline

- [ ] **3.3** Create `frontend/app/auth/login/page.tsx` — login form
  - Fields: Email, Password
  - On submit: POST to `/api/v1/auth/login`
  - On success: store JWT token in `localStorage` and redirect to `/dashboard`
  - Show error messages inline

- [ ] **3.4** Create `frontend/lib/auth.ts` — auth utilities
  - `getToken()` — reads JWT from localStorage
  - `isLoggedIn()` — checks if token exists and is not expired
  - `logout()` — clears token and redirects to `/auth/login`

- [ ] **3.5** Update the nav in `frontend/app/layout.tsx`
  - Show "Login / Register" buttons when logged out
  - Show user name + "Dashboard" + "Logout" when logged in

- [ ] **3.6** Test the full flow: register → login → see dashboard link in nav

**Phase 3 done when:** A new user can register, log in, and see their name in the nav bar.

---

## PHASE 4 — Landlord dashboard (core management UI)

**Goal:** A logged-in landlord can see their stats, add properties, manage units and tenants, and record payments.  
**Estimated time:** 1–2 weeks

### 4a — Dashboard home

- [ ] **4a.1** Create `frontend/app/dashboard/page.tsx` — protected page (redirect to login if not authenticated)
- [ ] **4a.2** Fetch from `GET /api/v1/dashboard` and display:
  - Total properties
  - Total units / occupied / vacant
  - Total rent collected (KSh)
- [ ] **4a.3** Create a sidebar/nav layout component for all dashboard pages

### 4b — Properties

- [ ] **4b.1** Create `frontend/app/dashboard/properties/page.tsx`
  - List all landlord's properties (from `GET /api/v1/properties`)
  - "Add property" button
- [ ] **4b.2** Create `frontend/app/dashboard/properties/new/page.tsx`
  - Form: property name, address, city, description
  - POST to `/api/v1/properties`
- [ ] **4b.3** Add delete property button (calls `DELETE /api/v1/properties/{id}`)

### 4c — Units

- [ ] **4c.1** Create `frontend/app/dashboard/units/page.tsx`
  - List all units (from `GET /api/v1/units`)
  - Show unit number, rent amount, status (vacant/occupied)
- [ ] **4c.2** Create `frontend/app/dashboard/units/new/page.tsx`
  - Form: property (dropdown), unit number, rent amount
  - POST to `/api/v1/units`
- [ ] **4c.3** Add edit unit button (PATCH `/api/v1/units/{id}`) to change status or rent

### 4d — Tenants

- [ ] **4d.1** Create `frontend/app/dashboard/tenants/page.tsx`
  - List all tenants (from `GET /api/v1/tenants`)
  - Show name, unit, phone, lease dates
- [ ] **4d.2** Create `frontend/app/dashboard/tenants/new/page.tsx`
  - Form: name, email, phone, unit (dropdown), lease start/end
  - POST to `/api/v1/tenants`

### 4e — Payments

- [ ] **4e.1** Create `frontend/app/dashboard/payments/page.tsx`
  - List all rent payments (from `GET /api/v1/payments`)
  - Show tenant name, amount, date, status (paid/pending/overdue)
- [ ] **4e.2** Create `frontend/app/dashboard/payments/new/page.tsx`
  - Form: tenant (dropdown), amount, date, payment method
  - POST to `/api/v1/payments`

**Phase 4 done when:** A landlord can log in, add a property, add units, add tenants, and record rent payments — all through the UI.

---

## PHASE 5 — Public listings (real data)

**Goal:** The rentals, airbnbs, and for-sale pages show real listings from the database, not hardcoded mock data.  
**Estimated time:** 3–5 days

### Tasks

- [ ] **5.1** Add a `public_listings` endpoint to the backend
  - `GET /api/v1/listings` — no auth required, returns all published properties with their units
  - Add a `is_published` boolean field to the `Property` model (new Alembic migration)

- [ ] **5.2** Add property image support to the backend
  - Add `image_url` field to the `Property` model (new Alembic migration)
  - Add `POST /api/v1/properties/{id}/upload-image` endpoint using FastAPI's `UploadFile`
  - Store images locally (or on a cloud bucket like Cloudinary / AWS S3)

- [ ] **5.3** Add publish/unpublish toggle in the landlord dashboard (4b) so landlords control visibility

- [ ] **5.4** Replace hardcoded `RENTALS` array in `frontend/app/rentals/page.tsx` with a real fetch from the listings API

- [ ] **5.5** Replace hardcoded `AIRBNBS` array in `frontend/app/airbnbs/page.tsx` with a real fetch

- [ ] **5.6** Replace hardcoded `FOR_SALE` array in `frontend/app/for-sale/page.tsx` with a real fetch

- [ ] **5.7** Create `frontend/app/rentals/[id]/page.tsx` — individual property detail page
  - Show images, description, location, price, landlord contact
  - "Add to wishlist" button (for logged-in users)

- [ ] **5.8** Wire up the "Quick search" form on the homepage to filter listings by category and location

**Phase 5 done when:** A real property listed by a landlord appears on the public rentals page with images and detail page.

---

## PHASE 6 — Wishlist feature

**Goal:** Logged-in tenants can save properties to a wishlist.  
**Estimated time:** 1 day (backend already built)

### Tasks

- [ ] **6.1** The backend already has wishlist routes and models — verify `GET/POST/DELETE /api/v1/wishlist` work via Swagger

- [ ] **6.2** Create `frontend/app/dashboard/wishlist/page.tsx`
  - List saved properties
  - Remove from wishlist button

- [ ] **6.3** Add "Save to wishlist" button on property detail pages (Phase 5.7)

**Phase 6 done when:** A tenant can save a property and see it in their wishlist.

---

## PHASE 7 — M-Pesa payment integration (Daraja API)

**Goal:** Landlords can trigger M-Pesa STK push prompts for rent collection. Tenants pay via M-Pesa.  
**Estimated time:** 1 week

### Tasks

- [ ] **7.1** Register on Safaricom Developer Portal (`developer.safaricom.co.ke`) and get sandbox credentials

- [ ] **7.2** Create `backend/app/services/mpesa_service.py`
  - `get_access_token()` — calls Safaricom OAuth endpoint
  - `stk_push(phone, amount, reference)` — initiates STK push
  - `handle_callback(payload)` — processes Safaricom's payment confirmation webhook

- [ ] **7.3** Add M-Pesa routes to backend
  - `POST /api/v1/payments/mpesa/stk-push` — landlord triggers payment request to tenant's phone
  - `POST /api/v1/payments/mpesa/callback` — Safaricom calls this to confirm payment (must be public URL)

- [ ] **7.4** Add M-Pesa payment button in the dashboard payments page (Phase 4e)
  - Enter tenant phone number, amount
  - Trigger STK push → tenant sees prompt on their phone → payment confirmed automatically

- [ ] **7.5** Update payment records automatically when M-Pesa callback is received (set status to "paid")

- [ ] **7.6** Test in Safaricom sandbox, then switch to production credentials

**Phase 7 done when:** A landlord can send a payment request from the dashboard and the tenant receives a prompt on their phone.

---

## PHASE 8 — Subscription / paywall

**Goal:** Landlords pay a monthly fee to use the management tools. The subscription model is already built in the database — wire it up to a payment gateway.  
**Estimated time:** 3–5 days

### Tasks

- [ ] **8.1** Define subscription tiers and pricing (e.g. Free: list only · Pro KSh 999/mo: full management tools)

- [ ] **8.2** Add subscription check middleware/dependency in backend
  - Gate the dashboard APIs (units, tenants, payments) behind an active subscription check

- [ ] **8.3** Implement subscription purchase via M-Pesa (recommended for Kenya) or Stripe
  - `POST /api/v1/subscriptions/activate` — creates a subscription record after payment confirmed

- [ ] **8.4** Create `frontend/app/pricing/page.tsx` — pricing page showing tiers

- [ ] **8.5** Show upgrade prompt in the landlord dashboard when user is on free tier

- [ ] **8.6** Handle subscription expiry — downgrade access automatically

**Phase 8 done when:** A landlord on the free tier sees an upgrade prompt, pays via M-Pesa, and gains access to management features.

---

## PHASE 9 — Notifications (email + SMS)

**Goal:** Automated rent reminders and payment confirmations.  
**Estimated time:** 3–5 days

### Tasks

- [ ] **9.1** Choose notification providers:
  - Email: SendGrid or Resend (both have free tiers)
  - SMS: Africa's Talking (Kenyan provider, supports local numbers)

- [ ] **9.2** Create `backend/app/services/notification_service.py`
  - `send_email(to, subject, body)`
  - `send_sms(phone, message)`

- [ ] **9.3** Send rent reminder SMS/email 3 days before rent is due
  - Create a background task or scheduled job (use APScheduler or FastAPI background tasks)

- [ ] **9.4** Send payment confirmation SMS/email when a payment is recorded

- [ ] **9.5** Send welcome email when a new user registers

- [ ] **9.6** Add notification preferences to user profile (opt-in/out of SMS, email)

**Phase 9 done when:** A tenant receives an SMS/email reminder before rent is due and a confirmation after paying.

---

## PHASE 10 — Mobile-friendly UI improvements

**Goal:** The app looks and works great on mobile (most Kenyan users are on mobile).  
**Estimated time:** 2–3 days

### Tasks

- [ ] **10.1** Add a mobile hamburger menu to the site nav (currently hidden on mobile)

- [ ] **10.2** Audit all pages on a 375px screen width (iPhone SE) — fix any overflow or layout issues

- [ ] **10.3** Make the dashboard sidebar collapsible on mobile

- [ ] **10.4** Optimise images — use Next.js `<Image>` component instead of `<img>` for automatic WebP + lazy loading

- [ ] **10.5** Add a "Back to top" behaviour and smooth scroll

**Phase 10 done when:** The app is fully usable on a mobile phone browser.

---

## PHASE 11 — Testing

**Goal:** Protect the codebase from regressions as features grow.  
**Estimated time:** 3–5 days (can be done in parallel with other phases)

### Tasks

- [ ] **11.1** Write backend tests for all routes (currently only auth is tested)
  - `tests/test_properties.py`
  - `tests/test_units.py`
  - `tests/test_tenants.py`
  - `tests/test_payments.py`
  - `tests/test_dashboard.py`

- [ ] **11.2** Add `pytest-cov` and enforce minimum 80% coverage

- [ ] **11.3** Add frontend tests using Playwright or Cypress
  - Test: register → login → create property → view dashboard

- [ ] **11.4** Set up a GitHub Actions CI workflow that runs tests on every push

**Phase 11 done when:** All backend routes have tests and CI passes automatically on every commit.

---

## PHASE 12 — Production deployment

**Goal:** The app is live on a real URL that anyone can access.  
**Estimated time:** 1–2 days

### Tasks

- [ ] **12.1** Choose a hosting provider:
  - Backend: Railway, Render, or a DigitalOcean VPS
  - Frontend: Vercel (free, best for Next.js)
  - Database: Railway PostgreSQL or Supabase (free tier)

- [ ] **12.2** Set production environment variables (never commit real secrets to git)
  - `DATABASE_URL` pointing to production database
  - `SECRET_KEY` — a strong, unique value
  - `CORS_ORIGINS` — set to your real frontend domain

- [ ] **12.3** Run `alembic upgrade head` against the production database

- [ ] **12.4** Deploy the backend and confirm `/health` returns `{"status": "ok"}`

- [ ] **12.5** Deploy the frontend to Vercel with `NEXT_PUBLIC_API_URL` pointing to the live backend

- [ ] **12.6** Set up a custom domain (e.g. `mtestates.co.ke`)

- [ ] **12.7** Enable HTTPS (automatic on Vercel and Railway)

- [ ] **12.8** Set up basic uptime monitoring (e.g. UptimeRobot — free)

**Phase 12 done when:** The app is live at a real domain with HTTPS, and a real user can register and use it.

---

## Summary table

| Phase | Description | Effort | Status |
|-------|-------------|--------|--------|
| 1 | Backend runs locally | 2–4 hrs | Not started |
| 2 | Frontend runs locally | 30 min | Not started |
| 3 | Auth pages (login/register) | 4–6 hrs | Not started |
| 4 | Landlord dashboard UI | 1–2 weeks | Not started |
| 5 | Public listings (real data + images) | 3–5 days | Not started |
| 6 | Wishlist feature | 1 day | Not started |
| 7 | M-Pesa integration | 1 week | Not started |
| 8 | Subscriptions / paywall | 3–5 days | Not started |
| 9 | Email + SMS notifications | 3–5 days | Not started |
| 10 | Mobile UI polish | 2–3 days | Not started |
| 11 | Testing + CI | 3–5 days | Not started |
| 12 | Production deployment | 1–2 days | Not started |

**Total estimated effort: 6–10 weeks** (working full-time) or **10–16 weeks** (part-time)

---

## First action

Start with **Phase 1, Task 1.1** — get the backend running.  
Every other phase depends on this.
