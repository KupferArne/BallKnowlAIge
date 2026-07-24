import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import type { MatchRow, TipRow } from '../lib/matches'
import type { MatchdayMatches } from '../lib/matchday'
import { isTipLocked, matchStatusLabel, scoreTip } from '../lib/scoring'
import type { TeamIconKind } from '../lib/teamIcons'
import { ScoreInput } from './ScoreInput'
import { TeamBadge } from './TeamBadge'

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

function MatchTipsDialog({
  match,
  tips,
  members,
  userId,
  open,
  onClose,
}: {
  match: MatchRow
  tips: TipRow[]
  members: { user_id: string; display_name: string }[]
  userId: string
  open: boolean
  onClose: () => void
}) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="tips-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="tips-dialog panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-between">
          <h2 id={titleId}>
            {match.home_team} vs {match.away_team}
          </h2>
          <button type="button" className="linkish" onClick={onClose}>
            Close
          </button>
        </div>
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
      </div>
    </div>
  )
}

function MatchTableRow({
  match,
  tips,
  userId,
  isOwner,
  pendingTip,
  iconKind,
  onSaveTip,
  onSetResult,
  onUpdateTeams,
  onOpenTips,
}: {
  match: MatchRow
  tips: TipRow[]
  userId: string
  isOwner: boolean
  pendingTip: boolean
  iconKind: TeamIconKind
  onSaveTip: (matchId: string, home: number, away: number) => Promise<void>
  onSetResult: (matchId: string, home: number, away: number) => Promise<void>
  onUpdateTeams?: (
    matchId: string,
    homeTeam: string,
    awayTeam: string,
  ) => Promise<void>
  onOpenTips: () => void
}) {
  const myTip = tips.find((t) => t.user_id === userId)
  const locked = isTipLocked(match.kickoff_at)
  const status = matchStatusLabel(match.status, match.kickoff_at)
  const [home, setHome] = useState(myTip?.home_goals?.toString() ?? '')
  const [away, setAway] = useState(myTip?.away_goals?.toString() ?? '')
  const [resHome, setResHome] = useState(match.home_goals?.toString() ?? '')
  const [resAway, setResAway] = useState(match.away_goals?.toString() ?? '')
  const [editTeams, setEditTeams] = useState(false)
  const [editHome, setEditHome] = useState(match.home_team)
  const [editAway, setEditAway] = useState(match.away_team)
  const [teamsBusy, setTeamsBusy] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
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
    setEditHome(match.home_team)
    setEditAway(match.away_team)
  }, [match.home_team, match.away_team])

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
    if (myTip && myTip.home_goals === h && myTip.away_goals === a) return

    setSaveState('pending')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setSaveState('saving')
      void onSaveTip(match.id, h, a)
        .then(() => {
          setSaveState('saved')
          window.setTimeout(() => setSaveState('idle'), 1600)
        })
        .catch(() => setSaveState('error'))
    }, 650)

    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [home, away, locked, match.id, myTip, onSaveTip])

  async function submitResult(e: FormEvent) {
    e.preventDefault()
    setResultBusy(true)
    try {
      await onSetResult(match.id, Number(resHome), Number(resAway))
    } finally {
      setResultBusy(false)
    }
  }

  async function submitTeams(e: FormEvent) {
    e.preventDefault()
    if (!onUpdateTeams) return
    setTeamsBusy(true)
    try {
      await onUpdateTeams(match.id, editHome, editAway)
      setEditTeams(false)
    } finally {
      setTeamsBusy(false)
    }
  }

  const timeLabel = match.kickoff_at
    ? new Date(match.kickoff_at).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'TBD'

  const kickoffFull = match.kickoff_at
    ? new Date(match.kickoff_at).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'TBD'

  const myPts =
    myTip && match.home_goals !== null && match.away_goals !== null
      ? scoreTip(
          myTip.home_goals,
          myTip.away_goals,
          match.home_goals,
          match.away_goals,
        )
      : null

  const saveHint =
    saveState === 'saved'
      ? '✓'
      : saveState === 'saving' || saveState === 'pending'
        ? '…'
        : saveState === 'error'
          ? '!'
          : ''

  return (
    <Fragment>
      <tr
        id={`match-${match.id}`}
        className={`match-tr status-${status}${pendingTip ? ' is-pending' : ''}`}
      >
        <td className="col-time" title={kickoffFull}>
          <span className="time-text">{timeLabel}</span>
          <span className={`pill status-${status} status-mini`}>{status}</span>
        </td>
        <td className="col-home">
          <TeamBadge
            name={match.home_team}
            crestUrl={match.home_crest_url}
            kind={iconKind}
            align="start"
          />
        </td>
        <td className="col-score">
          {!locked ? (
            <div className="table-tip">
              <ScoreInput
                value={home}
                onChange={setHome}
                ariaLabel={`${match.home_team} tip`}
                disabled={saveState === 'saving'}
              />
              <span className="score-colon">:</span>
              <ScoreInput
                value={away}
                onChange={setAway}
                ariaLabel={`${match.away_team} tip`}
                disabled={saveState === 'saving'}
              />
              {saveHint && (
                <span
                  className={
                    saveState === 'saved'
                      ? 'save-status ok-text'
                      : saveState === 'error'
                        ? 'save-status warn-text'
                        : 'save-status muted'
                  }
                  aria-live="polite"
                >
                  {saveHint}
                </span>
              )}
            </div>
          ) : (
            <div className="table-result-block">
              <span className="result-score table-result">
                {match.home_goals ?? '–'}:{match.away_goals ?? '–'}
              </span>
              <span className="muted table-my-tip">
                tip {myTip ? `${myTip.home_goals}:${myTip.away_goals}` : '—'}
              </span>
              {isOwner && status !== 'finished' && (
                <form className="table-set-result" onSubmit={submitResult}>
                  <ScoreInput
                    value={resHome}
                    onChange={setResHome}
                    ariaLabel="Home result"
                    disabled={resultBusy}
                  />
                  <span className="score-colon">:</span>
                  <ScoreInput
                    value={resAway}
                    onChange={setResAway}
                    ariaLabel="Away result"
                    disabled={resultBusy}
                  />
                  <button
                    className="linkish"
                    type="submit"
                    disabled={resultBusy}
                  >
                    Set
                  </button>
                </form>
              )}
            </div>
          )}
        </td>
        <td className="col-away">
          <TeamBadge
            name={match.away_team}
            crestUrl={match.away_crest_url}
            kind={iconKind}
            align="end"
          />
        </td>
        <td className="col-pts">
          {myPts != null ? <strong>{myPts}</strong> : <span className="muted">—</span>}
        </td>
        <td className="col-actions">
          <div className="row-actions">
            {locked ? (
              <button type="button" className="linkish" onClick={onOpenTips}>
                Tips
              </button>
            ) : pendingTip ? (
              <span className="pill pending-pill">Tip</span>
            ) : null}
            {isOwner && onUpdateTeams && status !== 'finished' && (
              <button
                type="button"
                className="linkish"
                onClick={() => setEditTeams((v) => !v)}
              >
                {editTeams ? 'Cancel' : 'Teams'}
              </button>
            )}
          </div>
        </td>
      </tr>
      {editTeams && isOwner && onUpdateTeams && (
        <tr className="match-edit-tr">
          <td colSpan={6}>
            <form className="match-edit-teams" onSubmit={(e) => void submitTeams(e)}>
              <input
                value={editHome}
                onChange={(e) => setEditHome(e.target.value)}
                aria-label="Home team"
                required
                disabled={teamsBusy}
              />
              <span className="muted">vs</span>
              <input
                value={editAway}
                onChange={(e) => setEditAway(e.target.value)}
                aria-label="Away team"
                required
                disabled={teamsBusy}
              />
              <button className="linkish" type="submit" disabled={teamsBusy}>
                Save teams
              </button>
            </form>
          </td>
        </tr>
      )}
    </Fragment>
  )
}

export function MatchTable({
  groups,
  tips,
  members,
  userId,
  isOwner,
  pendingMatchIds,
  iconKind,
  onSaveTip,
  onSetResult,
  onUpdateTeams,
}: {
  groups: MatchdayMatches[]
  tips: TipRow[]
  members: { user_id: string; display_name: string }[]
  userId: string
  isOwner: boolean
  pendingMatchIds: Set<string>
  iconKind: TeamIconKind
  onSaveTip: (matchId: string, home: number, away: number) => Promise<void>
  onSetResult: (matchId: string, home: number, away: number) => Promise<void>
  onUpdateTeams?: (
    matchId: string,
    homeTeam: string,
    awayTeam: string,
  ) => Promise<void>
}) {
  const [tipsMatchId, setTipsMatchId] = useState<string | null>(null)
  const tipsMatch = groups
    .flatMap((g) => g.matches)
    .find((m) => m.id === tipsMatchId)

  return (
    <>
      <div className="match-table-wrap">
        <table className="match-table">
          <thead>
            <tr>
              <th scope="col" className="col-time">
                Time
              </th>
              <th scope="col" className="col-home">
                Home
              </th>
              <th scope="col" className="col-score">
                Tip
              </th>
              <th scope="col" className="col-away">
                Away
              </th>
              <th scope="col" className="col-pts">
                Pts
              </th>
              <th scope="col" className="col-actions">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.day}>
                <tr className="matchday-tr">
                  <td colSpan={6}>{group.day}</td>
                </tr>
                {group.matches.map((match) => (
                  <MatchTableRow
                    key={match.id}
                    match={match}
                    tips={tips.filter((t) => t.match_id === match.id)}
                    userId={userId}
                    isOwner={isOwner}
                    pendingTip={pendingMatchIds.has(match.id)}
                    iconKind={iconKind}
                    onSaveTip={onSaveTip}
                    onSetResult={onSetResult}
                    onUpdateTeams={onUpdateTeams}
                    onOpenTips={() => setTipsMatchId(match.id)}
                  />
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {tipsMatch && (
        <MatchTipsDialog
          match={tipsMatch}
          tips={tips.filter((t) => t.match_id === tipsMatch.id)}
          members={members}
          userId={userId}
          open={Boolean(tipsMatchId)}
          onClose={() => setTipsMatchId(null)}
        />
      )}
    </>
  )
}
