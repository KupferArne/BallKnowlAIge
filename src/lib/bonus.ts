import { asError } from './errors'
import { supabase } from './supabase'

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export type BonusAnswerType = 'text' | 'choice' | 'number'

export type BonusQuestionRow = {
  id: string
  league_id: string
  prompt: string
  answer_type: BonusAnswerType
  choices: string[] | null
  points: number
  deadline_at: string | null
  correct_answer: string | null
  status: 'open' | 'scored'
  sort_order: number
  created_at?: string
}

export type BonusAnswerRow = {
  id: string
  question_id: string
  user_id: string
  answer_text: string
  created_at?: string
  updated_at?: string
}

export type PendingLeagueTips = {
  league_id: string
  league_name: string
  pending_matches: number
  pending_bonuses: number
}

function parseChoices(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  return raw.map((c) => String(c))
}

export function normalizeBonusQuestion(raw: Record<string, unknown>): BonusQuestionRow {
  return {
    id: String(raw.id),
    league_id: String(raw.league_id),
    prompt: String(raw.prompt ?? ''),
    answer_type: (raw.answer_type as BonusAnswerType) || 'text',
    choices: parseChoices(raw.choices),
    points: Number(raw.points ?? 0),
    deadline_at: (raw.deadline_at as string | null) ?? null,
    correct_answer: (raw.correct_answer as string | null) ?? null,
    status: raw.status === 'scored' ? 'scored' : 'open',
    sort_order: Number(raw.sort_order ?? 0),
    created_at: raw.created_at as string | undefined,
  }
}

export function isBonusLocked(
  q: Pick<BonusQuestionRow, 'status' | 'deadline_at'>,
  now = new Date(),
): boolean {
  if (q.status === 'scored') return true
  if (!q.deadline_at) return false
  return new Date(q.deadline_at).getTime() <= now.getTime()
}

export async function upsertBonusQuestion(input: {
  leagueId: string
  prompt: string
  answerType: BonusAnswerType
  choices?: string[] | null
  points: number
  deadlineAt?: string | null
  sortOrder?: number
  id?: string | null
}): Promise<BonusQuestionRow> {
  const client = requireClient()
  const { data, error } = await client.rpc('upsert_bonus_question', {
    p_league_id: input.leagueId,
    p_prompt: input.prompt,
    p_answer_type: input.answerType,
    p_choices:
      input.answerType === 'choice' && input.choices?.length
        ? input.choices
        : null,
    p_points: input.points,
    p_deadline_at: input.deadlineAt || null,
    p_sort_order: input.sortOrder ?? 0,
    p_id: input.id ?? null,
  })
  if (error) throw asError(error)
  return normalizeBonusQuestion(data as Record<string, unknown>)
}

export async function deleteBonusQuestion(id: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('delete_bonus_question', { p_id: id })
  if (error) throw asError(error)
}

export async function upsertBonusAnswer(
  questionId: string,
  answer: string,
): Promise<BonusAnswerRow> {
  const client = requireClient()
  const { data, error } = await client.rpc('upsert_bonus_answer', {
    p_question_id: questionId,
    p_answer: answer,
  })
  if (error) throw asError(error)
  return data as BonusAnswerRow
}

export async function scoreBonusQuestion(
  questionId: string,
  correctAnswer: string,
): Promise<BonusQuestionRow> {
  const client = requireClient()
  const { data, error } = await client.rpc('score_bonus_question', {
    p_question_id: questionId,
    p_correct_answer: correctAnswer,
  })
  if (error) throw asError(error)
  return normalizeBonusQuestion(data as Record<string, unknown>)
}

export async function listMyPendingTips(): Promise<PendingLeagueTips[]> {
  const client = requireClient()
  const { data, error } = await client.rpc('list_my_pending_tips')
  if (error) throw asError(error)
  return (data ?? []) as PendingLeagueTips[]
}
