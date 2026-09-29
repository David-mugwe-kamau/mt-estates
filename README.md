# MT Estates

Kenyan property platform for **rentals**, **Airbnbs**, and **for-sale** listings — with landlord management, free photo galleries, viewing bookings, and automated monthly water/rent billing.

## Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS v4
- **Backend:** FastAPI, SQLAlchemy, JWT
- **Database:** Supabase PostgreSQL (session pooler `eu-central-1`)

## Run locally

### Backend
```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend
```powershell
cd frontend
# Set NEXT_PUBLIC_API_URL in .env.local (http://localhost:8000 for PC)
npx next dev -p 3004
```

Open http://localhost:3004

## Key journeys

1. **Tenant:** browse → listing detail (gallery) → wishlist → book viewing  
2. **Landlord listings:** register → create listing → upload photos → publish  
3. **Landlord billing:** set water rate + garbage fee → add units/rent → enter monthly meter readings → auto totals/balances  

## Migrations

SQL files live in `backend/alembic/versions/`. Apply via Supabase SQL Editor when the pooler is reachable. Latest: `005_viewings_billing.sql`.

## Tests

```powershell
cd backend
python -m pytest
```
