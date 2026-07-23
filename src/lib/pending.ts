import { absoluteAppPath } from './appUrl'
import type { MatchRow, TipRow } from './matches'
import { isTipLocked } from './scoring'
import type { BonusAnswerRow, BonusQuestionRow } from './bonus'
import { isBonusLocked } from './bonus'

/** Open matches the user can still tip (and has not tipped). */
export function pendingOpenMatches(
  matches: MatchRow[],
  tips: TipRow[],
  userId: string,
): MatchRow[] {
  return matches.filter((m) => {
    if (m.status === 'finished') return false
    if (isTipLocked(m.kickoff_at)) return false
    return !tips.some((t) => t.match_id === m.id && t.user_id === userId)
  })
}

export function pendingOpenBonuses(
  questions: BonusQuestionRow[],
  answers: BonusAnswerRow[],
  userId: string,
): BonusQuestionRow[] {
  return questions.filter((q) => {
    if (isBonusLocked(q)) return false
    return !answers.some((a) => a.question_id === q.id && a.user_id === userId)
  })
}

/** Deep link into a league's open matches / pending tips. */
export function pendingTipsPath(leagueId: string): string {
  return `/league/${leagueId}?tab=matches&filter=open&pending=1`
}

export function pendingTipsUrl(leagueId: string): string {
  return absoluteAppPath(pendingTipsPath(leagueId))
}

export function pendingBonusPath(leagueId: string): string {
  return `/league/${leagueId}?tab=bonus`
}

/** Humans still missing tips for a given open match. */
export function membersMissingTip(
  matchId: string,
  tips: TipRow[],
  members: { user_id: string; display_name: string; kind?: string }[],
): { user_id: string; display_name: string }[] {
  return members
    .filter((m) => m.kind !== 'ai' && !m.user_id.startsWith('ai:'))
    .filter((m) => !tips.some((t) => t.match_id === matchId && t.user_id === m.user_id))
}
