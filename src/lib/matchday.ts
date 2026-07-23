import type { MatchRow, TipRow } from './matches'
import { isTipLocked, scoreTip } from './scoring'

export function matchdayKey(kickoffAt: string | null): string {
  if (!kickoffAt) return 'TBD'
  const d = new Date(kickoffAt)
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function matchdaySortKey(kickoffAt: string | null): number {
  if (!kickoffAt) return Number.MAX_SAFE_INTEGER
  return new Date(kickoffAt).getTime()
}

export type MatchdayTipLine = {
  matchId: string
  label: string
  tipLabel: string
  points: number | null
  kickoffAt: string | null
}

export type MatchdayGroup = {
  day: string
  sortKey: number
  dayPoints: number
  lines: MatchdayTipLine[]
}

/** Tips for one player, grouped by matchday (only matches with tips visible). */
export function playerTipsByMatchday(
  playerId: string,
  matches: MatchRow[],
  tips: TipRow[],
  viewerId: string,
): MatchdayGroup[] {
  const groups = new Map<string, MatchdayGroup>()

  for (const match of matches) {
    const locked = isTipLocked(match.kickoff_at)
    const isSelf = playerId === viewerId
    // Same visibility as match cards: own tip always; others after kickoff
    if (!isSelf && !locked) continue

    const tip = tips.find((t) => t.match_id === match.id && t.user_id === playerId)
    if (!tip && !locked) continue

    const day = matchdayKey(match.kickoff_at)
    const sortKey = matchdaySortKey(match.kickoff_at)
    let group = groups.get(day)
    if (!group) {
      group = { day, sortKey, dayPoints: 0, lines: [] }
      groups.set(day, group)
    }

    const hasResult =
      match.home_goals !== null && match.away_goals !== null && match.status === 'finished'
    const points =
      tip && hasResult
        ? scoreTip(tip.home_goals, tip.away_goals, match.home_goals!, match.away_goals!)
        : null

    if (points != null) group.dayPoints += points

    group.lines.push({
      matchId: match.id,
      label: `${match.home_team} ${match.home_goals ?? '–'}:${match.away_goals ?? '–'} ${match.away_team}`,
      tipLabel: tip ? `${tip.home_goals}:${tip.away_goals}` : '— (no tip)',
      points,
      kickoffAt: match.kickoff_at,
    })
  }

  return [...groups.values()]
    .map((g) => ({
      ...g,
      lines: g.lines.sort(
        (a, b) => matchdaySortKey(a.kickoffAt) - matchdaySortKey(b.kickoffAt),
      ),
    }))
    .sort((a, b) => a.sortKey - b.sortKey)
}
