import { supabase } from './supabase'
import type { LeagueRow, Profile } from './types'

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export async function ensureProfile(displayName?: string): Promise<Profile> {
  const client = requireClient()
  const { data, error } = await client.rpc('ensure_profile', {
    p_display_name: displayName ?? null,
  })
  if (error) throw error
  return data as Profile
}

export async function listMyLeagues(): Promise<LeagueRow[]> {
  const client = requireClient()
  const { data, error } = await client.rpc('list_my_leagues')
  if (error) throw error
  return (data ?? []) as LeagueRow[]
}

export async function createLeague(name: string): Promise<LeagueRow> {
  const client = requireClient()
  const { data, error } = await client.rpc('create_league', { p_name: name })
  if (error) throw error
  const league = data as Omit<LeagueRow, 'my_role'>
  return { ...league, my_role: 'owner' }
}

export async function joinLeagueByToken(token: string): Promise<LeagueRow> {
  const client = requireClient()
  const { data, error } = await client.rpc('join_league_by_token', {
    p_token: token,
  })
  if (error) throw error
  const league = data as Omit<LeagueRow, 'my_role'>
  return { ...league, my_role: 'player' }
}

export function inviteUrl(token: string): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/?$/, '/')
  return `${base}join/${token}`
}
