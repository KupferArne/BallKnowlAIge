import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { MatchRow, TipRow } from '../lib/matches'
import { isTipLocked, matchStatusLabel, scoreTip } from '../lib/scoring'

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export function MatchCard({
  match,
  tips,
  members,
  userId,
  isOwner,
  onSaveTip,
  onSetResult,
}: {
  match: MatchRow
  tips: TipRow[]
  members: { user_id: string; display_name: string }[]
  userId: string
  isOwner: boolean
  onSaveTip: (matchId: string, home: number, away: number) => Promise<void>
  onSetResult: (matchId: string, home: number, away: number) => Promise<void>
}) {
  const myTip = tips.find((t) => t.user_id === userId)
  const locked = isTipLocked(match.kickoff_at)
  const status = matchStatusLabel(match.status, match.kickoff_at)
  const [home, setHome] = useState(myTip?.home_goals?.toString() ?? '')
  const [away, setAway] = useState(myTip?.away_goals?.toString() ?? '')
  const [resHome, setResHome] = useState(match.home_goals?.toString() ?? '')
  const [resAway, setResAway] = useState(match.away_goals?.toString() ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState('')
  const [resultBusy, setResultBusy] = useState(false)
  const timer = useRef<number | null>(null)
  const skipNextAuto = useRef(false)

  useEffect(() => {
    skipNextAuto.current = true
    setHome(myTip?.home_goals?.toString() ?? '')
    setAway(myTip?.away_goals?.toString() ?? '')
  }, [myTip?.home_goals, myTip?.away_goals])

  useEffect(() => {
    setResHome(match.home_goals?.toString() ?? '')
    setResAway(match.away_goals?.toString() ?? '')
  }, [match.home_goals, match.away_goals])

  useEffect(() => {
    if (locked) return
    if (skipNextAuto.current) {
      skipNextAuto.current = false
      return
    }
    if (home === '' || away === '') return
    if (!/^\d+$/.test(home) || !/^\d+$/.test(away)) return

    const h = Number(home)
    const a = Number(away)
    if (
      myTip &&
      myTip.home_goals === h &&
      myTip.away_goals === a
    ) {
      return
    }

    setSaveState('pending')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setSaveState('saving')
      setSaveError('')
      void onSaveTip(match.id, h, a)
        .then(() => {
          setSaveState('saved')
          window.setTimeout(() => setSaveState('idle'), 2000)
        })
        .catch((err) => {
          setSaveState('error')
          setSaveError(err instanceof Error ? err.message : 'Save failed')
        })
    }, 650)

    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [home, away, locked, match.id, myTip, onSaveTip])

  async function submitTip(e: FormEvent) {
    e.preventDefault()
    if (timer.current) window.clearTimeout(timer.current)
    setSaveState('saving')
    setSaveError('')
    try {
      await onSaveTip(match.id, Number(home), Number(away))
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 2000)
    } catch (err) {
      setSaveState('error')
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function submitResult(e: FormEvent) {
    e.preventDefault()
    setResultBusy(true)
    try {
      await onSetResult(match.id, Number(resHome), Number(resAway))
    } finally {
      setResultBusy(false)
    }
  }

  const kickoffLabel = match.kickoff_at
    ? new Date(match.kickoff_at).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'TBD'

  const saveLabel =
    saveState === 'pending'
      ? 'Saving soon…'
      : saveState === 'saving'
        ? 'Saving…'
        : saveState === 'saved'
          ? 'Saved ✓'
          : saveState === 'error'
            ? 'Error'
            : 'Auto-saves'

  return (
    <article className="panel match-card">
      <div className="row-between">
        <span className={`pill status-${status}`}>{status}</span>
        <span className="muted">{kickoffLabel}</span>
      </div>
      <h2 className="match-title">
        {match.home_team}{' '}
        <span className="score">
          {match.home_goals ?? '–'}:{match.away_goals ?? '–'}
        </span>{' '}
        {match.away_team}
      </h2>

      {!locked ? (
        <form className="tip-row" onSubmit={submitTip}>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={home}
            onChange={(e) => setHome(e.target.value)}
            aria-label="Home tip"
            required
          />
          <span>:</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={away}
            onChange={(e) => setAway(e.target.value)}
            aria-label="Away tip"
            required
          />
          <button className="cta enabled" type="submit" disabled={saveState === 'saving'}>
            Save now
          </button>
          <span
            className={
              saveState === 'saved'
                ? 'save-status ok-text'
                : saveState === 'error'
                  ? 'save-status warn-text'
                  : 'save-status muted'
            }
            role="status"
          >
            {saveLabel}
          </span>
        </form>
      ) : (
        <p className="muted">
          Your tip:{' '}
          {myTip
            ? `${myTip.home_goals}:${myTip.away_goals}`
            : '— (no tip)'}
          {match.home_goals !== null &&
            match.away_goals !== null &&
            myTip &&
            ` · ${scoreTip(myTip.home_goals, myTip.away_goals, match.home_goals, match.away_goals)} pts`}
        </p>
      )}

      {saveError && <p className="warn-text">{saveError}</p>}

      {locked && (
        <div className="others">
          <h3>Tips</h3>
          <ul className="league-list">
            {members.map((m) => {
              const tip = tips.find((t) => t.user_id === m.user_id)
              const pts =
                tip && match.home_goals !== null && match.away_goals !== null
                  ? scoreTip(
                      tip.home_goals,
                      tip.away_goals,
                      match.home_goals,
                      match.away_goals,
                    )
                  : null
              return (
                <li key={m.user_id}>
                  <span>{m.display_name}</span>
                  <span>
                    {tip ? `${tip.home_goals}:${tip.away_goals}` : '—'}
                    {pts !== null ? ` (${pts})` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {isOwner && status !== 'finished' && locked && (
        <form className="tip-row" onSubmit={submitResult}>
          <span className="muted">Set result</span>
          <input
            inputMode="numeric"
            value={resHome}
            onChange={(e) => setResHome(e.target.value)}
            required
          />
          <span>:</span>
          <input
            inputMode="numeric"
            value={resAway}
            onChange={(e) => setResAway(e.target.value)}
            required
          />
          <button className="cta enabled" type="submit" disabled={resultBusy}>
            Save result
          </button>
        </form>
      )}
    </article>
  )
}
