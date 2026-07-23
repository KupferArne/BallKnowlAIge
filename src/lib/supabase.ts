import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when public Supabase env vars are present (still requires RLS). */
export const isSupabaseConfigured = Boolean(url && anon)

/**
 * Browser client — anon key only. Never import a service_role key here.
 * See docs/SECRETS.md.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anon!)
  : null
