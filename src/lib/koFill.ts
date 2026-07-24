import type { MatchRow } from './matches'
import { isPlaceholderTeam } from './teams'

/** Match number from openfootball-style external ids (`…-n49`). */
export function matchNumberFromExternalId(
  externalId: string | null | undefined,
): number | null {
  if (!externalId) return null
  const m = externalId.match(/n(\d+)$/i)
  return m ? Number(m[1]) : null
}

function winnerOf(match: MatchRow): string | null {
  if (
    match.status !== 'finished' ||
    match.home_goals === null ||
    match.away_goals === null
  ) {
    return null
  }
  if (match.home_goals > match.away_goals) return match.home_team
  if (match.away_goals > match.home_goals) return match.away_team
  return null
}

function loserOf(match: MatchRow): string | null {
  if (
    match.status !== 'finished' ||
    match.home_goals === null ||
    match.away_goals === null
  ) {
    return null
  }
  if (match.home_goals > match.away_goals) return match.away_team
  if (match.away_goals > match.home_goals) return match.home_team
  return null
}

function resolvePlaceholder(
  name: string,
  byNum: Map<number, MatchRow>,
): string | null {
  if (!isPlaceholderTeam(name)) return null
  const winner =
    name.match(/winner\s+(?:of\s+)?(?:match\s+)?(\d+)/i) ||
    name.match(/^W(\d+)$/i)
  if (winner) {
    const src = byNum.get(Number(winner[1]))
    return src ? winnerOf(src) : null
  }
  const loser =
    name.match(/loser\s+(?:of\s+)?(?:match\s+)?(\d+)/i) ||
    name.match(/^L(\d+)$/i)
  if (loser) {
    const src = byNum.get(Number(loser[1]))
    return src ? loserOf(src) : null
  }
  return null
}

export type KoTeamUpdate = {
  matchId: string
  home_team: string
  away_team: string
}

/**
 * Propose concrete team names for KO slots that still look like placeholders,
 * using finished earlier matches (by openfootball match number).
 */
export function proposedKoFills(matches: MatchRow[]): KoTeamUpdate[] {
  const byNum = new Map<number, MatchRow>()
  for (const m of matches) {
    const n = matchNumberFromExternalId(m.external_id)
    if (n != null) byNum.set(n, m)
  }

  const out: KoTeamUpdate[] = []
  for (const m of matches) {
    if (m.status === 'finished') continue
    const home = resolvePlaceholder(m.home_team, byNum) ?? m.home_team
    const away = resolvePlaceholder(m.away_team, byNum) ?? m.away_team
    if (home !== m.home_team || away !== m.away_team) {
      out.push({ matchId: m.id, home_team: home, away_team: away })
    }
  }
  return out
}
