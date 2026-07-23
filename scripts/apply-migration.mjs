#!/usr/bin/env node
/**
 * Applies supabase/migrations/00002_multi_tenant_core.sql via Management API.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-migration.mjs
 *
 * Create a token: https://supabase.com/dashboard/account/tokens
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_REF = 'mahevkixlrxdoxtbopoj'
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sql = readFileSync(
  resolve(root, 'supabase/migrations/00002_multi_tenant_core.sql'),
  'utf8',
)

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  },
)

const body = await res.text()
if (!res.ok) {
  console.error('Migration failed:', res.status, body)
  process.exit(1)
}

console.log('Migration applied OK')
console.log(body.slice(0, 500))
