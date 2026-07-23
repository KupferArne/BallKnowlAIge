import {
  normalizeBonusQuestion,
  type BonusAnswerRow,
  type BonusQuestionRow,
} from './bonus'
import { asError, formatSupabaseError } from './errors'
import { supabase } from './supabase'
import { scoreBonusAnswer, scoreTip } from './scoring'

export { formatSupabaseError }

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
  external_id?: string | null
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
  competition_id?: string | null
  competition_name?: string | null
  season?: string | null
  last_synced_at?: string | null
  sync_source?: string | null
}

export async function listTournaments(leagueId: string): Promise<TournamentRow[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('tournaments')
    .select('id, league_id, name, competition_id, competition_name, season')
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

export async function createTournament(input: {
  leagueId: string
  competitionId: string
  competitionName: string
  season?: string | null
  seedDemo?: boolean
}): Promise<TournamentRow> {
  const client = requireClient()
  const { data, error } = await client.rpc('create_tournament', {
    p_league_id: input.leagueId,
    p_competition_id: input.competitionId,
    p_competition_name: input.competitionName,
    p_season: input.season ?? null,
    p_seed_demo: input.seedDemo ?? false,
  })
  if (error) throw asError(error)
  return data as TournamentRow
}

/** @deprecated Prefer createTournament — kept for one-click Demo Cup. */
export async function seedDemoTournament(leagueId: string): Promise<TournamentRow> {
  return createTournament({
    leagueId,
    competitionId: 'demo-cup',
    competitionName: 'Demo Cup',
    season: null,
    seedDemo: true,
  })
}

export type MemberRow = {
  user_id: string
  role: string
  display_name: string
  kind?: 'human' | 'ai'
}

export type AiAgentRow = {
  id: string
  league_id: string
  name: string
  provider: string
}

export type LeaguePlayData = {
  tournament: TournamentRow | null
  matches: MatchRow[]
  tips: TipRow[]
  members: MemberRow[]
  ai_agents: AiAgentRow[]
  bonus_questions: BonusQuestionRow[]
  bonus_answers: BonusAnswerRow[]
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export async function getLeaguePlayData(leagueId: string): Promise<LeaguePlayData> {
  const client = requireClient()
  const { data, error } = await client.rpc('get_league_play_data', {
    p_league_id: leagueId,
  })
  if (error) throw asError(error)
  const bundle = (data ?? {}) as Record<string, unknown>
  return {
    tournament: (bundle.tournament as TournamentRow) ?? null,
    matches: asArray<MatchRow>(bundle.matches),
    tips: asArray<TipRow>(bundle.tips),
    members: asArray<MemberRow>(bundle.members),
    ai_agents: asArray<AiAgentRow>(bundle.ai_agents),
    bonus_questions: asArray<Record<string, unknown>>(bundle.bonus_questions).map(
      normalizeBonusQuestion,
    ),
    bonus_answers: asArray<BonusAnswerRow>(bundle.bonus_answers),
  }
}

export async function addStubAiAgent(leagueId: string, name: string) {
  const client = requireClient()
  const { data, error } = await client.rpc('add_stub_ai_agent', {
    p_league_id: leagueId,
    p_name: name,
  })
  if (error) throw asError(error)
  return data as AiAgentRow
}

export async function removeAiAgent(agentId: string) {
  const client = requireClient()
  const { error } = await client.rpc('remove_ai_agent', { p_agent_id: agentId })
  if (error) throw asError(error)
}

export async function regenerateStubAiTips(leagueId: string) {
  const client = requireClient()
  const { data, error } = await client.rpc('generate_stub_ai_tips', {
    p_league_id: leagueId,
    p_agent_id: null,
  })
  if (error) throw asError(error)
  return data as number
}

export async function leaveLeague(leagueId: string) {
  const client = requireClient()
  const { error } = await client.rpc('leave_league', { p_league_id: leagueId })
  if (error) throw asError(error)
}

export async function kickMember(leagueId: string, userId: string) {
  const client = requireClient()
  const { error } = await client.rpc('kick_member', {
    p_league_id: leagueId,
    p_user_id: userId,
  })
  if (error) throw asError(error)
}

export async function renameLeague(leagueId: string, name: string) {
  const client = requireClient()
  const { data, error } = await client.rpc('rename_league', {
    p_league_id: leagueId,
    p_name: name,
  })
  if (error) throw asError(error)
  return data
}

export async function deleteLeague(leagueId: string) {
  const client = requireClient()
  const { error } = await client.rpc('delete_league', { p_league_id: leagueId })
  if (error) throw asError(error)
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
  if (error) throw asError(error)
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
  if (error) throw asError(error)
  return data as MatchRow
}

export type StandingsRow = {
  userId: string
  name: string
  points: number
  matchPoints: number
  bonusPoints: number
  exact: number
  tipped: number
}

export function computeStandings(
  matches: MatchRow[],
  tips: TipRow[],
  members: { user_id: string; display_name: string }[],
  bonusQuestions: BonusQuestionRow[] = [],
  bonusAnswers: BonusAnswerRow[] = [],
): StandingsRow[] {
  const finished = matches.filter(
    (m) =>
      m.status === 'finished' &&
      m.home_goals !== null &&
      m.away_goals !== null,
  )
  const scoredBonuses = bonusQuestions.filter(
    (q) => q.status === 'scored' && q.correct_answer,
  )

  return members
    .map((member) => {
      let matchPoints = 0
      let bonusPoints = 0
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
        matchPoints += pts
        if (pts === 4) exact++
      }
      for (const q of scoredBonuses) {
        const ans = bonusAnswers.find(
          (a) => a.question_id === q.id && a.user_id === member.user_id,
        )
        bonusPoints += scoreBonusAnswer(
          ans?.answer_text,
          q.correct_answer,
          q.points,
        )
      }
      return {
        userId: member.user_id,
        name: member.display_name,
        points: matchPoints + bonusPoints,
        matchPoints,
        bonusPoints,
        exact,
        tipped,
      }
    })
    .sort((a, b) => b.points - a.points || b.exact - a.exact || a.name.localeCompare(b.name))
}
