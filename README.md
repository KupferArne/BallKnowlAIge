# BallKnowlAIge

Multi-tenant tournament prediction leagues (PWA).  
**Backlog:** [BACKLOG.md](./BACKLOG.md) · **Secrets:** [docs/SECRETS.md](./docs/SECRETS.md)

## Stack (MVP, $0)

- Frontend: Vite + React + TypeScript → **GitHub Pages**
- Backend: **Supabase Free** (Auth, Postgres, RLS, Edge Functions later)

## One-time: apply database migration

In [Supabase SQL Editor](https://supabase.com/dashboard) → **SQL** → New query, paste and run:

Run these in order in the SQL Editor (paste each file fully):

1. `supabase/migrations/00002_multi_tenant_core.sql`
2. `supabase/migrations/00003_tips_scoring_demo.sql`
3. `supabase/migrations/00004_league_play_bundle.sql`
4. `supabase/migrations/00005_ai_stub_admin.sql`
5. `supabase/migrations/00006_bonus_and_pending.sql` (bonus questions + tip reminders)
6. `supabase/migrations/00007_competition_catalog.sql` (competition picker on tournament create)
7. `supabase/migrations/00008_fixture_sync.sql` (fixture sync upsert + external ids)
8. `supabase/migrations/00009_team_crests.sql` (crest/flag URLs on matches)
9. Later files under `supabase/migrations/` (`00010+`: tip reminders, tip presence on leaderboard, …)

### Fixture sync (optional)

- **World Cup (Men):** Owner → Matches → **Sync fixtures now** (openfootball, no API key).
- **Bundesliga / 2. Liga / 3. Liga:** same button via **OpenLigaDB** (no API key; season e.g. `2025/26`).
- **PL / UCL / … (optional):** Deploy Edge Function `sync-fixtures` + `FOOTBALL_DATA_API_TOKEN` — see [docs/SECRETS.md](./docs/SECRETS.md).

Also under **Authentication → URL configuration**:

| Setting | Value |
|---|---|
| **Site URL** | `https://kupferarne.github.io/BallKnowlAIge/` |
| **Redirect URLs** | `https://kupferarne.github.io/BallKnowlAIge/**` and `http://localhost:5173/**` |

**Recommended for tippspiels:** Auth → Providers → **Email** → disable **Confirm email**, so invitees can register with email + password and join immediately. Magic Link stays optional (often rate-limited on free tier).

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
