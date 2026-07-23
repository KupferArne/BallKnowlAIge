# BallKnowlAIge

Multi-tenant tournament prediction leagues (PWA).  
**Backlog:** [BACKLOG.md](./BACKLOG.md) · **Secrets:** [docs/SECRETS.md](./docs/SECRETS.md)

## Stack (MVP, $0)

- Frontend: Vite + React + TypeScript → **GitHub Pages**
- Backend: **Supabase Free** (Auth, Postgres, RLS, Edge Functions later)

## One-time: apply database migration

In [Supabase SQL Editor](https://supabase.com/dashboard) → **SQL** → New query, paste and run:

`supabase/migrations/00002_multi_tenant_core.sql`  
then `supabase/migrations/00003_tips_scoring_demo.sql`

Also under **Authentication → URL configuration**:

| Setting | Value |
|---|---|
| **Site URL** | `https://kupferarne.github.io/BallKnowlAIge/` |
| **Redirect URLs** | `https://kupferarne.github.io/BallKnowlAIge/**` and `http://localhost:5173/**` |

If **Site URL** stays on `http://localhost:...`, Magic Links open localhost and fail unless `npm run dev` is running. After changing Site URL, request a **new** Magic Link (old emails stay wrong).

## Local setup

```bash
npm install
cp .env.example .env.local
# fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (anon/publishable only!)
npm run dev
```

For a production-like preview with the Pages base path:

```bash
VITE_BASE=/BallKnowlAIge/ npm run build
npx vite preview --base /BallKnowlAIge/
```

## Deploy

Push to `main` runs [.github/workflows/deploy-pages.yml](./.github/workflows/deploy-pages.yml).

One-time in the GitHub repo:

1. **Settings → Pages → Source:** GitHub Actions  
2. **Settings → Variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public anon values only)

## Do not

- Commit `.env` / service_role / OpenRouter keys  
- Put privileged secrets in the frontend  
