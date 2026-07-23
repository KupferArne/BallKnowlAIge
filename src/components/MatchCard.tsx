import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { MatchRow, TipRow } from '../lib/matches'
import { teamNameClass } from '../lib/teams'
import { isTipLocked, matchStatusLabel, scoreTip } from '../lib/scoring'
import { ScoreStepper } from './ScoreStepper'

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
  const [tipsOpen, setTipsOpen] = useState(status === 'live')
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
    if (myTip && myTip.home_goals === h && myTip.away_goals === a) {
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
    if (home === '' || away === '') return
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

  const timeOnly = match.kickoff_at
    ? new Date(match.kickoff_at).toLocaleTimeString(undefined, {
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

  const myPts =
    myTip && match.home_goals !== null && match.away_goals !== null
      ? scoreTip(
          myTip.home_goals,
          myTip.away_goals,
          match.home_goals,
          match.away_goals,
        )
      : null

  return (
    <article className={`panel match-card status-${status}`}>
      <div className="match-meta">
        <span className={`pill status-${status}`}>{status}</span>
        <span className="muted match-time" title={kickoffLabel}>
          <span className="time-full">{kickoffLabel}</span>
          <span className="time-short">{timeOnly}</span>
        </span>
      </div>

      <div className="match-grid">
        <div className={teamNameClass(match.home_team)} title={match.home_team}>
          {match.home_team}
        </div>
        <div className="match-center" aria-hidden={false}>
          {locked ? (
            <div className="result-score">
              <span>{match.home_goals ?? '–'}</span>
              <span className="score-colon">:</span>
              <span>{match.away_goals ?? '–'}</span>
            </div>
          ) : (
            <form className="tip-form" onSubmit={submitTip}>
              <div className="tip-steppers">
                <ScoreStepper
                  value={home}
                  onChange={setHome}
                  ariaLabel={`${match.home_team} tip`}
                  disabled={saveState === 'saving'}
                />
                <span className="score-colon">:</span>
                <ScoreStepper
                  value={away}
                  onChange={setAway}
                  ariaLabel={`${match.away_team} tip`}
                  disabled={saveState === 'saving'}
                />
              </div>
              <div className="tip-actions">
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
                <button
                  className="cta enabled tip-save-btn"
                  type="submit"
                  disabled={saveState === 'saving' || home === '' || away === ''}
                >
                  Save
                </button>
              </div>
            </form>
          )}
        </div>
        <div className={teamNameClass(match.away_team)} title={match.away_team}>
          {match.away_team}
        </div>
      </div>

      {locked && (
        <p className="my-tip-line muted">
          Your tip:{' '}
          <strong>
            {myTip ? `${myTip.home_goals}:${myTip.away_goals}` : '—'}
          </strong>
          {myPts != null ? ` · ${myPts} pts` : ''}
        </p>
      )}

      {saveError && <p className="warn-text">{saveError}</p>}

      {locked && (
        <div className="others">
          <button
            type="button"
            className="others-toggle"
            aria-expanded={tipsOpen}
            onClick={() => setTipsOpen((o) => !o)}
          >
            Tips ({members.length})
            <span className="chev">{tipsOpen ? '▾' : '▸'}</span>
          </button>
          {tipsOpen && (
            <ul className="league-list tip-list">
              {members.map((m) => {
                const tip = tips.find((t) => t.user_id === m.user_id)
                const pts =
                  tip &&
                  match.home_goals !== null &&
                  match.away_goals !== null
                    ? scoreTip(
                        tip.home_goals,
                        tip.away_goals,
                        match.home_goals,
                        match.away_goals,
                      )
                    : null
                return (
                  <li key={m.user_id}>
                    <span className={m.user_id === userId ? 'is-you-name' : undefined}>
                      {m.display_name}
                      {m.user_id === userId ? ' (you)' : ''}
                    </span>
                    <span>
                      {tip ? `${tip.home_goals}:${tip.away_goals}` : '—'}
                      {pts !== null ? ` (${pts})` : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {isOwner && status !== 'finished' && locked && (
        <form className="tip-row result-row" onSubmit={submitResult}>
          <span className="muted">Set result</span>
          <ScoreStepper
            value={resHome}
            onChange={setResHome}
            ariaLabel="Home result"
            disabled={resultBusy}
          />
          <span className="score-colon">:</span>
          <ScoreStepper
            value={resAway}
            onChange={setResAway}
            ariaLabel="Away result"
            disabled={resultBusy}
          />
          <button className="cta enabled" type="submit" disabled={resultBusy}>
            Save result
          </button>
        </form>
      )}
    </article>
  )
}
