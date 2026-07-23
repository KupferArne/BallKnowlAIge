import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { inviteUrl, listMyLeagues } from '../lib/leagues'
import {
  computeStandings,
  formatSupabaseError,
  getLeaguePlayData,
  seedDemoTournament,
  setMatchResult,
  upsertTip,
  type MatchRow,
  type TipRow,
} from '../lib/matches'
import { isTipLocked, matchStatusLabel, scoreTip } from '../lib/scoring'
import type { LeagueRow } from '../lib/types'

type Tab = 'matches' | 'standings' | 'rules' | 'league'

export function LeaguePage() {
  const { leagueId = '' } = useParams()
  const { ready, user } = useAuth()
  const [league, setLeague] = useState<LeagueRow | null>(null)
  const [tab, setTab] = useState<Tab>('matches')
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [tips, setTips] = useState<TipRow[]>([])
  const [members, setMembers] = useState<
    { user_id: string; role: string; display_name: string }[]
  >([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tournamentName, setTournamentName] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user || !leagueId) return
    setError('')

    const [leagues, play] = await Promise.all([
      listMyLeagues(),
      getLeaguePlayData(leagueId),
    ])

    const found = leagues.find((r) => r.id === leagueId) ?? null
    if (!found) {
      throw new Error(
        `League not found or you are not a member (id=${leagueId}).`,
      )
    }

    setLeague(found)
    setMembers(play.members)
    setTournamentName(play.tournament?.name ?? null)
    setMatches(play.matches)
    setTips(play.tips)
  }, [user, leagueId])

  useEffect(() => {
    if (!ready || !user) return
    void reload().catch((err) => setError(formatSupabaseError(err)))
  }, [ready, user, reload])

  const standings = useMemo(
    () => computeStandings(matches, tips, members),
    [matches, tips, members],
  )

  async function onSeed() {
    setBusy(true)
    setError('')
    try {
      await seedDemoTournament(leagueId)
      setTab('matches')
      try {
        await reload()
      } catch (reloadErr) {
        setError(
          'Demo Cup was seeded, but reload failed: ' +
            formatSupabaseError(reloadErr),
        )
      }
    } catch (err) {
      setError(formatSupabaseError(err) || 'Seed failed')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveTip(matchId: string, home: number, away: number) {
    setBusy(true)
    setError('')
    try {
      await upsertTip(matchId, home, away)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save tip')
    } finally {
      setBusy(false)
    }
  }

  async function onSetResult(matchId: string, home: number, away: number) {
    setBusy(true)
    setError('')
    try {
      await setMatchResult(matchId, home, away)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set result')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <p className="muted">Loading…</p>
  if (!user) {
    return (
      <div className="panel">
        <p>Please sign in.</p>
        <Link to="/login">Sign in</Link>
      </div>
    )
  }

  return (
    <div className="stack-lg">
      <p>
        <Link to="/">← All leagues</Link>
      </p>

      {league ? (
        <>
          <header className="hero">
            <p className="brand" style={{ fontSize: '1.75rem' }}>
              {league.name}
            </p>
            <p className="muted">
              Role <span className="pill">{league.my_role}</span>
              {tournamentName ? ` · ${tournamentName}` : ''}
            </p>
          </header>

          <nav className="tabs" aria-label="League sections">
            {(
              [
                ['matches', 'Matches'],
                ['standings', 'Standings'],
                ['rules', 'Rules'],
                ['league', 'League'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? 'tab active' : 'tab'}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          {error && <p className="warn-text">{error}</p>}

          {tab === 'matches' && (
            <section className="stack">
              {!tournamentName && league.my_role === 'owner' && (
                <div className="panel">
                  <h2>No tournament yet</h2>
                  <p className="muted">
                    Seed a Demo Cup with finished, live and upcoming matches.
                  </p>
                  <button
                    type="button"
                    className="cta enabled"
                    disabled={busy}
                    onClick={() => void onSeed()}
                  >
                    {busy ? 'Seeding…' : 'Seed Demo Cup'}
                  </button>
                </div>
              )}
              {!tournamentName && league.my_role !== 'owner' && (
                <p className="muted">Waiting for the owner to seed the Demo Cup.</p>
              )}
              {matches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  tips={tips.filter((t) => t.match_id === match.id)}
                  members={members}
                  userId={user.id}
                  isOwner={league.my_role === 'owner'}
                  busy={busy}
                  onSaveTip={onSaveTip}
                  onSetResult={onSetResult}
                />
              ))}
            </section>
          )}

          {tab === 'standings' && (
            <section className="panel">
              <h2>Leaderboard</h2>
              {standings.length === 0 ? (
                <p className="muted">No scored matches yet.</p>
              ) : (
                <ol className="standings">
                  {standings.map((row, i) => (
                    <li key={row.userId}>
                      <span className="rank">{i + 1}.</span>
                      <span className="name">
                        {row.name}
                        {row.userId === user.id ? ' (you)' : ''}
                      </span>
                      <span className="pts">{row.points} pts</span>
                      <span className="muted meta">
                        {row.exact} exact · {row.tipped} tipped
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          {tab === 'rules' && (
            <section className="panel stack">
              <h2>Rules</h2>
              <p className="muted">Pick the exact score after 90 minutes (no ET/pens).</p>
              <ul className="rules-list">
                <li>
                  <strong>4 pts</strong> — exact score
                </li>
                <li>
                  <strong>3 pts</strong> — correct winner + goal difference
                </li>
                <li>
                  <strong>2 pts</strong> — correct tendency (incl. draw, wrong score)
                </li>
                <li>Tips lock at kickoff</li>
                <li>Other tips visible after kickoff</li>
              </ul>
            </section>
          )}

          {tab === 'league' && (
            <section className="panel stack">
              <h2>Invite</h2>
              <button
                type="button"
                className="cta enabled"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(inviteUrl(league.invite_token))
                    .then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    })
                }}
              >
                {copied ? 'Invite link copied' : 'Copy invite link'}
              </button>
              {league.my_role === 'owner' && (
                <>
                  <h2>Owner tools</h2>
                  <button
                    type="button"
                    className="cta enabled"
                    disabled={busy}
                    onClick={() => void onSeed()}
                  >
                    {busy ? 'Working…' : 'Re-seed Demo Cup'}
                  </button>
                  <p className="muted">
                    Re-seeding clears tips for the demo tournament and rebuilds
                    fixtures.
                  </p>
                </>
              )}
              <h2>Members</h2>
              <ul className="league-list">
                {members.map((m) => (
                  <li key={m.user_id}>
                    <span>
                      {m.display_name}{' '}
                      <span className="pill">{m.role}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className="warn-text">{error || 'Loading…'}</p>
      )}
    </div>
  )
}

function MatchCard({
  match,
  tips,
  members,
  userId,
  isOwner,
  busy,
  onSaveTip,
  onSetResult,
}: {
  match: MatchRow
  tips: TipRow[]
  members: { user_id: string; display_name: string }[]
  userId: string
  isOwner: boolean
  busy: boolean
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

  useEffect(() => {
    setHome(myTip?.home_goals?.toString() ?? '')
    setAway(myTip?.away_goals?.toString() ?? '')
  }, [myTip?.home_goals, myTip?.away_goals])

  useEffect(() => {
    setResHome(match.home_goals?.toString() ?? '')
    setResAway(match.away_goals?.toString() ?? '')
  }, [match.home_goals, match.away_goals])

  function submitTip(e: FormEvent) {
    e.preventDefault()
    void onSaveTip(match.id, Number(home), Number(away))
  }

  function submitResult(e: FormEvent) {
    e.preventDefault()
    void onSetResult(match.id, Number(resHome), Number(resAway))
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
          <button className="cta enabled" type="submit" disabled={busy}>
            Save tip
          </button>
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
          <button className="cta enabled" type="submit" disabled={busy}>
            Save result
          </button>
        </form>
      )}
    </article>
  )
}
