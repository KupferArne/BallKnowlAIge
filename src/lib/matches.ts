import { supabase } from './supabase'
import { scoreTip } from './scoring'

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export type MatchRow = {
  id: string
  tournament_id: string
  home_team: string
  away_team: string
  kickoff_at: string | null
  home_goals: number | null
  away_goals: number | null
  status: string
}

export type TipRow = {
  id: string
  match_id: string
  user_id: string
  home_goals: number
  away_goals: number
}

export type TournamentRow = {
  id: string
  league_id: string
  name: string
}

export async function listTournaments(leagueId: string): Promise<TournamentRow[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('tournaments')
    .select('id, league_id, name')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as TournamentRow[]
}

export async function listMatches(tournamentId: string): Promise<MatchRow[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('kickoff_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as MatchRow[]
}

export async function listTipsForMatches(matchIds: string[]): Promise<TipRow[]> {
  if (matchIds.length === 0) return []
  const client = requireClient()
  const { data, error } = await client
    .from('tips')
    .select('*')
    .in('match_id', matchIds)
  if (error) throw error
  return (data ?? []) as TipRow[]
}

export async function listLeagueMembers(
  leagueId: string,
): Promise<{ user_id: string; role: string; display_name: string }[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('league_members')
    .select('user_id, role')
    .eq('league_id', leagueId)
  if (error) throw error
  const rows = data ?? []
  const ids = rows.map((r) => r.user_id)
  const { data: profiles, error: pErr } = await client
    .from('profiles')
    .select('id, display_name')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  if (pErr) throw pErr
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]))
  return rows.map((row) => ({
    user_id: row.user_id,
    role: row.role,
    display_name: nameById.get(row.user_id) || 'Player',
  }))
}

export async function seedDemoTournament(leagueId: string): Promise<TournamentRow> {
  const client = requireClient()
  const { data, error } = await client.rpc('seed_demo_tournament', {
    p_league_id: leagueId,
  })
  if (error) throw error
  return data as TournamentRow
}

export async function upsertTip(
  matchId: string,
  homeGoals: number,
  awayGoals: number,
): Promise<TipRow> {
  const client = requireClient()
  const { data, error } = await client.rpc('upsert_tip', {
    p_match_id: matchId,
    p_home_goals: homeGoals,
    p_away_goals: awayGoals,
  })
  if (error) throw error
  return data as TipRow
}

export async function setMatchResult(
  matchId: string,
  homeGoals: number,
  awayGoals: number,
): Promise<MatchRow> {
  const client = requireClient()
  const { data, error } = await client.rpc('set_match_result', {
    p_match_id: matchId,
    p_home_goals: homeGoals,
    p_away_goals: awayGoals,
  })
  if (error) throw error
  return data as MatchRow
}

export type StandingsRow = {
  userId: string
  name: string
  points: number
  exact: number
  tipped: number
}

export function computeStandings(
  matches: MatchRow[],
  tips: TipRow[],
  members: { user_id: string; display_name: string }[],
): StandingsRow[] {
  const finished = matches.filter(
    (m) =>
      m.status === 'finished' &&
      m.home_goals !== null &&
      m.away_goals !== null,
  )

  return members
    .map((member) => {
      let points = 0
      let exact = 0
      let tipped = 0
      for (const match of finished) {
        const tip = tips.find(
          (t) => t.match_id === match.id && t.user_id === member.user_id,
        )
        if (!tip) continue
        tipped++
        const pts = scoreTip(
          tip.home_goals,
          tip.away_goals,
          match.home_goals!,
          match.away_goals!,
        )
        points += pts
        if (pts === 4) exact++
      }
      return {
        userId: member.user_id,
        name: member.display_name,
        points,
        exact,
        tipped,
      }
    })
    .sort((a, b) => b.points - a.points || b.exact - a.exact || a.name.localeCompare(b.name))
}
