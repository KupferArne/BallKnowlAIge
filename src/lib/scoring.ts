/** Legacy Tippspiel points: exact 4, goal-diff 3, tendency 2 (draws: exact 4 or tendency 2). */
export const POINTS = {
  EXACT: 4,
  GOAL_DIFF: 3,
  TENDENCY: 2,
} as const

export function scoreTip(
  tipHome: number,
  tipAway: number,
  resultHome: number,
  resultAway: number,
): number {
  if (
    [tipHome, tipAway, resultHome, resultAway].some(
      (n) => !Number.isFinite(n),
    )
  ) {
    return 0
  }

  if (tipHome === resultHome && tipAway === resultAway) return POINTS.EXACT

  const tipTrend = tipHome > tipAway ? 1 : tipHome < tipAway ? -1 : 0
  const realTrend = resultHome > resultAway ? 1 : resultHome < resultAway ? -1 : 0
  if (tipTrend !== realTrend) return 0

  // Draw: only exact (4) or tendency (2) — no goal-diff bonus
  if (realTrend === 0) return POINTS.TENDENCY

  if (tipHome - tipAway === resultHome - resultAway) return POINTS.GOAL_DIFF
  return POINTS.TENDENCY
}

export function isTipLocked(kickoffAt: string | null, now = new Date()): boolean {
  if (!kickoffAt) return false
  return new Date(kickoffAt).getTime() <= now.getTime()
}

export function matchStatusLabel(
  status: string,
  kickoffAt: string | null,
  now = new Date(),
): 'scheduled' | 'live' | 'finished' {
  if (status === 'finished') return 'finished'
  if (!kickoffAt) return 'scheduled'
  const ko = new Date(kickoffAt).getTime()
  if (ko > now.getTime()) return 'scheduled'
  // treat open results after kickoff as live until owner sets score
  if (status === 'live') return 'live'
  return 'live'
}
