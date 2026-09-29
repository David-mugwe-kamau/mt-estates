# Public listings without Render (Phase 1)

Public browse/detail now use **Next.js API routes → Supabase Postgres** (`DATABASE_URL`).
Landlord dashboard, auth, wishlist, viewings, billing still use FastAPI (`NEXT_PUBLIC_API_URL`) until later phases.

## Env (frontend)

In `frontend/.env.local` (and Vercel project env):

```
NEXT_PUBLIC_API_URL=http://localhost:8000
DATABASE_URL=<same Supabase pooler URL as backend>
```

- `DATABASE_URL` is **server-only** (never `NEXT_PUBLIC_`).
- Do not commit `.env.local`.

## Behaviour

Unchanged for users: same cards, filters, detail, Call/WhatsApp (no public email).
