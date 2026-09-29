# Deploy MT Estates

Stack already uses **Supabase Postgres**. We deploy:

| Piece | Host | Notes |
|-------|------|--------|
| Backend (FastAPI) | **Render** (Docker) | `render.yaml` |
| Frontend (Next.js) | **Vercel** | root = `frontend/` |
| Database | **Supabase** (existing) | set `DATABASE_URL` on Render |

## What you need (one-time)

1. GitHub account logged in (`gh auth login`)
2. Free [Render](https://render.com) account
3. Free [Vercel](https://vercel.com) account (GitHub login works)

## After repo is on GitHub

### Backend (Render)
1. New → Blueprint → select `mt-estates` repo
2. Set env vars when prompted:
   - `DATABASE_URL` = your Supabase pooler URL (same as local `.env`)
   - `CORS_ORIGINS` = your Vercel URL, e.g. `https://mt-estates.vercel.app` (update after frontend exists; can use `*` briefly)
3. Deploy → copy API URL (e.g. `https://mt-estates-api.onrender.com`)

### Frontend (Vercel)
1. Import repo → **Root Directory** = `frontend`
2. Env: `NEXT_PUBLIC_API_URL` = Render API URL (no trailing slash)
3. Deploy
4. Go back to Render and set `CORS_ORIGINS` to the Vercel URL(s)

## Local prep already done
- Root `.gitignore`
- Backend Dockerfile respects `$PORT`
- `render.yaml` + `vercel.json`
