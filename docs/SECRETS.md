# Secrets & Key-Hygiene

Hard rules for BallKnowlAIge (see also Epic S in `BACKLOG.md`).

## Never commit or ship in the PWA bundle

- Supabase **service_role** key
- OpenRouter / any AI API key
- OAuth client secrets, private keys, personal access tokens
- Webhook URLs with embedded tokens

## Allowed in the frontend

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (requires RLS on all tables)

## Where privileged secrets live

| Secret | Store |
|---|---|
| Supabase service role | Supabase dashboard / local CLI only — never in git |
| OpenRouter (later) | Supabase Edge Function secrets |
| Local overrides | `.env` / `.env.local` (gitignored) |

## Rotate on leak

1. Revoke/rotate the key in the provider dashboard immediately  
2. Remove from git history if it was committed (`git filter-repo` / support)  
3. Redeploy Edge Functions / update CI secrets  
4. Do not only delete the file in a new commit  

## AI calls

All OpenRouter traffic must go through a server-side Edge Function. The browser never sees the API key. MVP uses an AI stub with **no** key.
