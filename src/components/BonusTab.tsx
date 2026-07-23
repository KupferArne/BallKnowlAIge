import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  deleteBonusQuestion,
  isBonusLocked,
  scoreBonusQuestion,
  upsertBonusAnswer,
  upsertBonusQuestion,
  type BonusAnswerRow,
  type BonusAnswerType,
  type BonusQuestionRow,
} from '../lib/bonus'
import { formatSupabaseError } from '../lib/matches'
import { scoreBonusAnswer } from '../lib/scoring'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function BonusAnswerCard({
  question,
  myAnswer,
  answers,
  members,
  userId,
  isOwner,
  onAnswered,
  onScored,
  onDeleted,
}: {
  question: BonusQuestionRow
  myAnswer: BonusAnswerRow | undefined
  answers: BonusAnswerRow[]
  members: { user_id: string; display_name: string }[]
  userId: string
  isOwner: boolean
  onAnswered: (row: BonusAnswerRow) => void
  onScored: (row: BonusQuestionRow) => void
  onDeleted: (id: string) => void
}) {
  const locked = isBonusLocked(question)
  const [value, setValue] = useState(myAnswer?.answer_text ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState('')
  const [correct, setCorrect] = useState(question.correct_answer ?? '')
  const [busy, setBusy] = useState(false)
  const timer = useRef<number | null>(null)
  const skip = useRef(false)

  useEffect(() => {
    skip.current = true
    setValue(myAnswer?.answer_text ?? '')
  }, [myAnswer?.answer_text, question.id])

  useEffect(() => {
    if (locked || question.answer_type === 'choice') return
    if (skip.current) {
      skip.current = false
      return
    }
    const trimmed = value.trim()
    if (!trimmed) return
    if (myAnswer && myAnswer.answer_text === trimmed) return

    setSaveState('saving')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      void upsertBonusAnswer(question.id, trimmed)
        .then((row) => {
          onAnswered(row)
          setSaveState('saved')
          window.setTimeout(() => setSaveState('idle'), 1600)
        })
        .catch((err) => {
          setSaveState('error')
          setError(formatSupabaseError(err))
        })
    }, 650)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [value, locked, question.id, question.answer_type, myAnswer, onAnswered])

  async function saveChoice(answer: string) {
    setBusy(true)
    setError('')
    try {
      const row = await upsertBonusAnswer(question.id, answer)
      setValue(answer)
      onAnswered(row)
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 1600)
    } catch (err) {
      setError(formatSupabaseError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onScore(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const row = await scoreBonusQuestion(question.id, correct)
      onScored(row)
    } catch (err) {
      setError(formatSupabaseError(err))
    } finally {
      setBusy(false)
    }
  }

  const choices = question.choices ?? []
  const reveal = locked || question.status === 'scored'

  return (
    <article className="panel bonus-card">
      <div className="row-between">
        <span className="pill">{question.points} pts</span>
        <span className="muted">
          {question.status === 'scored'
            ? 'Scored'
            : locked
              ? 'Locked'
              : 'Open'}
        </span>
      </div>
      <h3 className="bonus-prompt">{question.prompt}</h3>

      {!locked ? (
        question.answer_type === 'choice' ? (
          <div className="choice-grid">
            {choices.map((c) => (
              <button
                key={c}
                type="button"
                className={
                  value === c ? 'tab active choice-btn' : 'tab choice-btn'
                }
                disabled={busy}
                onClick={() => void saveChoice(c)}
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <label className="field">
            <span>
              Your answer
              {saveState === 'saved'
                ? ' · Saved ✓'
                : saveState === 'saving'
                  ? ' · Saving…'
                  : ''}
            </span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode={question.answer_type === 'number' ? 'numeric' : 'text'}
              placeholder={
                question.answer_type === 'number' ? 'e.g. 3' : 'Your pick'
              }
            />
          </label>
        )
      ) : (
        <p className="muted">
          Your answer: <strong>{myAnswer?.answer_text ?? '—'}</strong>
          {question.status === 'scored' && myAnswer && (
            <>
              {' '}
              ·{' '}
              {scoreBonusAnswer(
                myAnswer.answer_text,
                question.correct_answer,
                question.points,
              )}{' '}
              pts
            </>
          )}
        </p>
      )}

      {reveal && (
        <div className="others">
          {question.status === 'scored' && (
            <p className="ok-text">
              Correct: <strong>{question.correct_answer}</strong>
            </p>
          )}
          <ul className="league-list tip-list">
            {members.map((m) => {
              const ans = answers.find(
                (a) => a.question_id === question.id && a.user_id === m.user_id,
              )
              const pts =
                question.status === 'scored'
                  ? scoreBonusAnswer(
                      ans?.answer_text,
                      question.correct_answer,
                      question.points,
                    )
                  : null
              return (
                <li key={m.user_id}>
                  <span>
                    {m.display_name}
                    {m.user_id === userId ? ' (you)' : ''}
                  </span>
                  <span>
                    {ans?.answer_text ?? '—'}
                    {pts != null ? ` (${pts})` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {isOwner && question.status === 'open' && (
        <form className="stack" onSubmit={onScore}>
          <label className="field">
            <span>Set correct answer & score</span>
            {question.answer_type === 'choice' ? (
              <select
                value={correct}
                onChange={(e) => setCorrect(e.target.value)}
                required
              >
                <option value="">Choose…</option>
                {choices.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={correct}
                onChange={(e) => setCorrect(e.target.value)}
                required
                inputMode={
                  question.answer_type === 'number' ? 'numeric' : 'text'
                }
              />
            )}
          </label>
          <div className="row-actions">
            <button className="cta enabled" type="submit" disabled={busy}>
              Score question
            </button>
            <button
              type="button"
              className="linkish"
              disabled={busy}
              onClick={() => {
                if (confirm('Delete this bonus question?')) {
                  void deleteBonusQuestion(question.id)
                    .then(() => onDeleted(question.id))
                    .catch((err) => setError(formatSupabaseError(err)))
                }
              }}
            >
              Delete
            </button>
          </div>
        </form>
      )}

      {error && <p className="warn-text">{error}</p>}
    </article>
  )
}

export function BonusTab({
  leagueId,
  isOwner,
  userId,
  questions,
  answers,
  members,
  onChange,
}: {
  leagueId: string
  isOwner: boolean
  userId: string
  questions: BonusQuestionRow[]
  answers: BonusAnswerRow[]
  members: { user_id: string; display_name: string; kind?: string }[]
  onChange: (next: {
    questions: BonusQuestionRow[]
    answers: BonusAnswerRow[]
  }) => void
}) {
  const humans = useMemo(
    () => members.filter((m) => m.kind !== 'ai' && !m.user_id.startsWith('ai:')),
    [members],
  )

  const [prompt, setPrompt] = useState('')
  const [answerType, setAnswerType] = useState<BonusAnswerType>('text')
  const [choicesText, setChoicesText] = useState('')
  const [points, setPoints] = useState(2)
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const choices =
        answerType === 'choice'
          ? choicesText
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : null
      const row = await upsertBonusQuestion({
        leagueId,
        prompt,
        answerType,
        choices,
        points,
        deadlineAt: deadline ? new Date(deadline).toISOString() : null,
        sortOrder: questions.length,
      })
      onChange({ questions: [...questions, row], answers })
      setPrompt('')
      setChoicesText('')
      setPoints(2)
      setDeadline('')
    } catch (err) {
      setError(formatSupabaseError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="stack">
      <div className="panel">
        <h2>Bonus questions</h2>
        <p className="muted">
          Owner-defined extras with custom points. Answers lock at the deadline
          (or when scored). Correct answers award the full point weight.
        </p>
      </div>

      {isOwner && (
        <form className="panel stack" onSubmit={onCreate}>
          <h2>Add bonus question</h2>
          <label className="field">
            <span>Question</span>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              maxLength={280}
              placeholder="Who wins the tournament?"
            />
          </label>
          <label className="field">
            <span>Answer type</span>
            <select
              value={answerType}
              onChange={(e) => setAnswerType(e.target.value as BonusAnswerType)}
            >
              <option value="text">Free text</option>
              <option value="choice">Multiple choice</option>
              <option value="number">Number</option>
            </select>
          </label>
          {answerType === 'choice' && (
            <label className="field">
              <span>Choices (one per line)</span>
              <textarea
                value={choicesText}
                onChange={(e) => setChoicesText(e.target.value)}
                rows={4}
                required
                placeholder={'Brazil\nFrance\nArgentina'}
              />
            </label>
          )}
          <label className="field">
            <span>Points weight (1–50)</span>
            <input
              type="number"
              min={1}
              max={50}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              required
            />
          </label>
          <label className="field">
            <span>Deadline (optional)</span>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <button className="cta enabled" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Create question'}
          </button>
          {error && <p className="warn-text">{error}</p>}
        </form>
      )}

      {questions.length === 0 ? (
        <p className="muted">No bonus questions yet.</p>
      ) : (
        questions.map((q) => (
          <BonusAnswerCard
            key={q.id}
            question={q}
            myAnswer={answers.find(
              (a) => a.question_id === q.id && a.user_id === userId,
            )}
            answers={answers}
            members={humans}
            userId={userId}
            isOwner={isOwner}
            onAnswered={(row) => {
              const rest = answers.filter(
                (a) =>
                  !(a.question_id === row.question_id && a.user_id === row.user_id),
              )
              onChange({ questions, answers: [...rest, row] })
            }}
            onScored={(row) => {
              onChange({
                questions: questions.map((x) => (x.id === row.id ? row : x)),
                answers,
              })
            }}
            onDeleted={(id) => {
              onChange({
                questions: questions.filter((x) => x.id !== id),
                answers: answers.filter((a) => a.question_id !== id),
              })
            }}
          />
        ))
      )}
    </section>
  )
}
