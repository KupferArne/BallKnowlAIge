# BallKnowlAIge

Multi-tenant tournament prediction leagues (PWA).  
**Backlog:** [BACKLOG.md](./BACKLOG.md) · **Secrets:** [docs/SECRETS.md](./docs/SECRETS.md)

## Stack (MVP, $0)

- Frontend: Vite + React + TypeScript → **GitHub Pages**
- Backend: **Supabase Free** (Auth, Postgres, RLS, Edge Functions later)

## Local setup

```bash
npm install
cp .env.example .env.local
# fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (anon only!)
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
