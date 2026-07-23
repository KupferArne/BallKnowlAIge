# BallKnowlAIge — PWA / Web MVP Backlog

Product working title: **World Cup / tournament prediction leagues** (multi-tenant tippspiel).  
Stack target: **GitHub Pages PWA + Supabase Free** (optional Cloudflare Worker for cron).  
Constraint: **no paid hosting** for the MVP.

Legacy reference implementation (GAS + Sheets): separate workspace `STEP Sammlung` / TippspielApp — port scoring & UX ideas; do **not** keep Apps Script as the product backend.

---

## Product MVP (what we ship)

1. User signs up and creates a **league**
2. Invites colleagues via **share / join link**
3. Players submit **exact-score tips** (90 min FT; ET/pens ignored)
4. **Leaderboard** + tip reveal after kickoff
5. Optional **AI players** (stub first; real OpenRouter later, server-side only)

---

## Hosting map ($0)

| Piece | Host | Why |
|---|---|---|
| Frontend / PWA | GitHub Pages | Static, free, CI via Actions |
| Auth + DB | Supabase Free | Postgres, Auth, RLS |
| Server logic | Supabase Edge Functions | Tip lock, scoring, later AI proxy + secrets |
| Optional fixture cron | Cloudflare Workers (free) or manual admin Sync | Pages cannot schedule jobs |
| Secrets | Platform secret stores only | Never in git / Pages bundle |

---

## Roles & Subagents

Cursor agents live in the planning workspace under `.cursor/agents/` (`picks-*`).  
Orchestration: `.cursor/rules/picks-agent-orchestration.mdc`  
Secrets: `.cursor/rules/secrets-key-hygiene.mdc`

| Role | Subagent | Owns |
|---|---|---|
| Tech Lead / Orchestrator | `picks-tech-lead` | Epic planning, trade-offs, coordination |
| Frontend / PWA | `picks-frontend-pwa` | UI, PWA, Pages client (Epics 0, 2 UI, 4–5) |
| Supabase / Backend | `picks-supabase-backend` | Schema, RLS, Edge Functions (1–4 data) |
| Domain / Scoring | `picks-domain-scoring` | Port scoring & tip-lock rules from legacy GAS |
| Auth & Invite | `picks-auth-invite` | Auth, join links, membership (Epic 2) |
| DevOps / Hosting | `picks-devops-pages` | Pages Actions, $0 infra (Epic 0) |
| Secrets Auditor | `picks-secrets-auditor` | Epic S reviews (read-only) |
| QA / Verifier | `picks-qa-verifier` | Done-when checks (read-only) |

---

## Epic S — Secrets & Key-Hygiene (mandatory, first)

- [x] `.gitignore`: `.env`, `.env.*`, `*.pem`, credential JSON patterns
- [x] `.env.example` with placeholders only (no real values)
- [x] OpenRouter / service-role keys / any webhook URLs **never** in frontend or git
- [x] AI calls only via server-side proxy (Edge Function / Worker); or AI stub with no key
- [x] Public bundle may include Supabase `anon` key only (RLS required)
- [x] Document rotate-on-leak procedure (`docs/SECRETS.md`)

**Done when:** a fresh clone + Pages deploy cannot expose paid API credentials. *(scaffold complete — verify on first deploy)*

---

## Epic 0 — Scaffold

- [x] Vite (+ React/TS preferred) app in this repo
- [x] GitHub Pages deploy (Actions), correct `base` path
- [x] PWA: manifest, service worker, icons
- [x] Supabase SQL migrations folder in repo
- [x] Env wiring per Epic S

**Done when:** installable PWA loads on `*.github.io` (or project Pages URL) with zero secrets in the repo. *(awaiting first push + Pages enable)*

---

## Epic 1 — Multi-Tenant Kern

- [x] Tables: `profiles`, `leagues`, `league_members`, `tournaments`, `matches`, `tips`, `ai_agents` (stub ok)
- [x] RLS: users only see their leagues / tips
- [x] Roles: `owner` / `player`
- [x] Create-league wizard

**Done when:** User A creates a league; User B cannot see it without invite.  
*(Apply `00002_multi_tenant_core.sql` in Supabase, then verify with two accounts.)*

---

## Epic 2 — Auth & Invite

- [x] Supabase Auth (Magic Link — free tier)
- [x] Invite link `/join/{token}`
- [x] Display name
- [ ] Leave league / owner kick *(follow-up)*

**Done when:** share link joins a second user into the same league end-to-end.

---

## Epic 3 — Turnier & Sync

- [x] Tournament template + fixture import (Demo Cup seed RPC)
- [x] Match states: scheduled / live / finished
- [x] Tip lock at kickoff (client UX **and** server/DB enforcement)

**Done when:** a demo league has a real schedule; tips lock correctly at kickoff.

---

## Epic 4 — Tippen & Scoring

- [x] Tips UI
- [x] Port scoring engine from legacy Tippspiel (`berechnePunkte` semantics)
- [x] Leaderboard
- [x] Reveal other players’ tips after kickoff

**Done when:** parity test cases for scoring pass; leaderboard updates after results.

---

## Epic 5 — PWA UX

- [x] Mobile-first tabs: Matches / Standings / Rules / League
- [x] Offline shell (PWA service worker from Epic 0)
- [x] Landing with “Create league” CTA

**Done when:** “Add to Home Screen” works on mobile and core flows are usable.

---

## Epic 6 — AI (feature-flag / later)

- [x] Stub AI players without API cost
- [ ] Later: OpenRouter **only** behind Edge Function + hard budget cap (Epic S)

**Done when:** a league can include an AI seat without requiring a public API key.

---

## Epic 7 — Admin lite

- [x] Owner: rename/delete league, kick members, set match results, seed demo
- [x] Demo seed + stub AI tip generation
- [x] Feedback form link
- [x] Players can leave a league

**Done when:** owner can run a league without using the Supabase dashboard for normal ops.

---

## Epic 8 — User feedback (WC Tippspiel survey)

Source: post-tournament survey (“What should we improve” / “Feature ideas”).

### Must / should (product)

| # | Request | Notes | Status |
|---|---|---|---|
| 8.1 | **Auto-save tips** or “Save all” + **visual confirmation** | Debounced auto-save + “Saved ✓” + toast | [x] |
| 8.2 | **Leaderboard: highlight own row** | Standings tab — stronger “you” styling | [x] |
| 8.3 | **Bonus / special questions scoring** | Cap or rebalance vs match tips (champ + top scorer felt ~20 pts / too heavy) | [ ] (not in app yet — design when bonuses land) |
| 8.4 | **Knockout opponent updates** | Avoid manual placeholder pain; auto-fill from previous results / sync | [ ] (partially future fixtures sync) |
| 8.5 | **Mobile UX polish** | Dense cards, auto-save tip inputs, matchday groups, KO placeholder styling | [x] |
| 8.6 | **Paywall before first tip** | Block tips until entry marked paid (owner/admin or Stripe later) | [ ] |
| 8.10 | **Tip reminders + deep link** | Nudge players who miss matches; email or in-app (not Chat). Link opens pending tips directly | [ ] |
| 8.11 | **Leaderboard player detail** | Expand a row → tips / matches / points **grouped by matchday**; see own + others (after kickoff rules) | [x] |

### Nice to have

| # | Request | Notes | Status |
|---|---|---|---|
| 8.7 | **Dark mode** | App is already dark-ish; add explicit theme toggle / system preference | [ ] |
| 8.8 | **Native / store app** | Out of $0 MVP — PWA “Add to Home Screen” covers hosted app for now | deferred |
| 8.9 | **Better AI on tournament extras** | Real models + calibration; stub is not for champ/scorer quality | deferred (OpenRouter epic) |

### Explicitly not from this feedback

- Chat notifications (already out of scope)

**Suggested next slice:** **8.10** tip reminders + deeplink, then **8.6** paywall/paid flag.

---

## Out of scope for $0 MVP

- App Store / Play Store (PWA instead; see 8.8)
- Stripe checkout (8.6 can start as **manual “paid” flag** without Stripe)
- **Chat notifications** (Google Chat, Slack, Teams, etc.)
- Guaranteed live minute-by-minute scores
- Paid sports data APIs

---

## Suggested sprint order

1. Epic S + 0 — hygiene & scaffold ✅  
2. Epic 1 + 2 — leagues, auth, invites ✅  
3. Epic 3 + 4 — fixtures, tips, scoring ✅  
4. Epic 5–7 — PWA polish, AI stub, admin ✅  
5. **Epic 8** — survey UX (auto-save, standings highlight, mobile, paywall flag)

---

## Decisions

| Topic | Decision |
|---|---|
| UI stack | React + Vite + TS |
| Auth | Magic Link + password |
| First tournament data | Demo Cup seed |
| AI in MVP | Stub heuristics (Epic 6) |
| Supabase | `mahevkixlrxdoxtbopoj` |
| Pages URL | https://kupferarne.github.io/BallKnowlAIge/ |
