import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MatchCard } from '../components/MatchCard'
import { useAuth } from '../context/AuthContext'
import { inviteUrl, listMyLeagues } from '../lib/leagues'
import { playerTipsByMatchday } from '../lib/matchday'
import {
  addStubAiAgent,
  computeStandings,
  deleteLeague,
  formatSupabaseError,
  getLeaguePlayData,
  kickMember,
  leaveLeague,
  regenerateStubAiTips,
  removeAiAgent,
  renameLeague,
  seedDemoTournament,
  setMatchResult,
  upsertTip,
  type AiAgentRow,
  type MatchRow,
  type MemberRow,
  type TipRow,
} from '../lib/matches'
import type { LeagueRow } from '../lib/types'

type Tab = 'matches' | 'standings' | 'rules' | 'league'

const FEEDBACK_URL =
  'https://docs.google.com/forms/d/17ucmvY5K2xA2yz9S4nNun8Wb6ulcx_lmWHVjQdlg7GE/viewform'

export function LeaguePage() {
  const { leagueId = '' } = useParams()
  const navigate = useNavigate()
  const { ready, user } = useAuth()
  const [league, setLeague] = useState<LeagueRow | null>(null)
  const [tab, setTab] = useState<Tab>('matches')
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [tips, setTips] = useState<TipRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [aiAgents, setAiAgents] = useState<AiAgentRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tournamentName, setTournamentName] = useState<string | null>(null)
  const [aiName, setAiName] = useState('Stub AI')
  const [leagueNameEdit, setLeagueNameEdit] = useState('')
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? '' : t)), 2200)
  }, [])

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
    setLeagueNameEdit(found.name)
    setMembers(play.members)
    setAiAgents(play.ai_agents)
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

  const onSaveTip = useCallback(
    async (matchId: string, home: number, away: number) => {
      setError('')
      const tip = await upsertTip(matchId, home, away)
      setTips((prev) => {
        const rest = prev.filter(
          (t) => !(t.match_id === matchId && t.user_id === tip.user_id),
        )
        return [...rest, tip]
      })
      showToast('Tip saved ✓')
    },
    [showToast],
  )

  async function onSetResult(matchId: string, home: number, away: number) {
    setBusy(true)
    setError('')
    try {
      await setMatchResult(matchId, home, away)
      await reload()
    } catch (err) {
      setError(formatSupabaseError(err))
    } finally {
      setBusy(false)
    }
  }

  async function runAdmin(action: () => Promise<void>, goHome = false) {
    setBusy(true)
    setError('')
    try {
      await action()
      if (goHome) {
        navigate('/')
        return
      }
      await reload()
    } catch (err) {
      setError(formatSupabaseError(err))
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
          {toast && (
            <p className="toast ok-text" role="status">
              {toast}
            </p>
          )}

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
                  onSaveTip={onSaveTip}
                  onSetResult={onSetResult}
                />
              ))}
            </section>
          )}

          {tab === 'standings' && (
            <section className="panel stack">
              <h2>Leaderboard</h2>
              <p className="muted">
                Tap a player to expand tips by matchday. Others’ tips show after
                kickoff.
              </p>
              <ol className="standings">
                {(standings.length
                  ? standings
                  : members.map((m) => ({
                      userId: m.user_id,
                      name: m.display_name,
                      points: 0,
                      exact: 0,
                      tipped: 0,
                    }))
                ).map((row, i) => {
                  const isYou = row.userId === user.id
                  const open = expandedPlayer === row.userId
                  const groups = open
                    ? playerTipsByMatchday(row.userId, matches, tips, user.id)
                    : []
                  return (
                    <li
                      key={row.userId}
                      className={isYou ? 'standing-row is-you' : 'standing-row'}
                    >
                      <button
                        type="button"
                        className="standing-toggle"
                        onClick={() =>
                          setExpandedPlayer((id) =>
                            id === row.userId ? null : row.userId,
                          )
                        }
                        aria-expanded={open}
                      >
                        <span className="rank">{i + 1}.</span>
                        <span className="name">
                          {row.name}
                          {isYou ? ' (you)' : ''}
                          <span className="chev">{open ? '▾' : '▸'}</span>
                        </span>
                        <span className="pts">{row.points} pts</span>
                      </button>
                      <span className="muted meta">
                        {row.exact} exact · {row.tipped} tipped
                      </span>
                      {open && (
                        <div className="player-detail">
                          {groups.length === 0 ? (
                            <p className="muted">No visible tips yet.</p>
                          ) : (
                            groups.map((g) => (
                              <div key={g.day} className="matchday-block">
                                <div className="matchday-head">
                                  <strong>{g.day}</strong>
                                  <span className="muted">{g.dayPoints} pts</span>
                                </div>
                                <ul className="matchday-lines">
                                  {g.lines.map((line) => (
                                    <li key={line.matchId}>
                                      <span>{line.label}</span>
                                      <span>
                                        tip {line.tipLabel}
                                        {line.points != null
                                          ? ` · ${line.points} pts`
                                          : ''}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
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
            <section className="stack">
              <div className="panel stack">
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
              </div>

              {league.my_role === 'owner' && (
                <div className="panel stack">
                  <h2>AI players (stub)</h2>
                  <p className="muted">
                    Free heuristic tips — no OpenRouter key. Counts on the
                    leaderboard.
                  </p>
                  <form
                    className="stack"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void runAdmin(async () => {
                        await addStubAiAgent(leagueId, aiName)
                        setAiName('Stub AI')
                      })
                    }}
                  >
                    <label className="field">
                      <span>Name</span>
                      <input
                        value={aiName}
                        onChange={(e) => setAiName(e.target.value)}
                        maxLength={40}
                        required
                      />
                    </label>
                    <button className="cta enabled" type="submit" disabled={busy}>
                      Add stub AI
                    </button>
                  </form>
                  {aiAgents.length > 0 && (
                    <>
                      <ul className="league-list">
                        {aiAgents.map((a) => (
                          <li key={a.id}>
                            <span>
                              {a.name} <span className="pill">ai</span>
                            </span>
                            <button
                              type="button"
                              className="linkish"
                              disabled={busy}
                              onClick={() =>
                                void runAdmin(() => removeAiAgent(a.id))
                              }
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="cta enabled"
                        disabled={busy}
                        onClick={() =>
                          void runAdmin(async () => {
                            await regenerateStubAiTips(leagueId)
                          })
                        }
                      >
                        Regenerate AI tips
                      </button>
                    </>
                  )}
                </div>
              )}

              {league.my_role === 'owner' && (
                <div className="panel stack">
                  <h2>Owner tools</h2>
                  <form
                    className="stack"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void runAdmin(async () => {
                        await renameLeague(leagueId, leagueNameEdit)
                      })
                    }}
                  >
                    <label className="field">
                      <span>League name</span>
                      <input
                        value={leagueNameEdit}
                        onChange={(e) => setLeagueNameEdit(e.target.value)}
                        required
                        maxLength={80}
                      />
                    </label>
                    <button className="cta enabled" type="submit" disabled={busy}>
                      Rename league
                    </button>
                  </form>
                  <button
                    type="button"
                    className="cta enabled"
                    disabled={busy}
                    onClick={() => void onSeed()}
                  >
                    {busy ? 'Working…' : 'Re-seed Demo Cup'}
                  </button>
                  <p className="muted">
                    Re-seeding clears human tips for the demo tournament and
                    rebuilds fixtures. Re-run “Regenerate AI tips” afterwards.
                  </p>
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          'Delete this league and all matches/tips permanently?',
                        )
                      ) {
                        void runAdmin(() => deleteLeague(leagueId), true)
                      }
                    }}
                  >
                    Delete league
                  </button>
                </div>
              )}

              <div className="panel stack">
                <h2>Members</h2>
                <ul className="league-list">
                  {members.map((m) => (
                    <li key={m.user_id}>
                      <span>
                        {m.display_name}{' '}
                        <span className="pill">{m.role}</span>
                      </span>
                      {league.my_role === 'owner' &&
                        m.kind !== 'ai' &&
                        m.user_id !== user?.id && (
                          <button
                            type="button"
                            className="linkish"
                            disabled={busy}
                            onClick={() =>
                              void runAdmin(() => kickMember(leagueId, m.user_id))
                            }
                          >
                            Kick
                          </button>
                        )}
                    </li>
                  ))}
                </ul>
                {league.my_role !== 'owner' && (
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={() => {
                      if (confirm('Leave this league?')) {
                        void runAdmin(() => leaveLeague(leagueId), true)
                      }
                    }}
                  >
                    Leave league
                  </button>
                )}
              </div>

              <div className="panel stack">
                <h2>Feedback</h2>
                <a className="cta enabled" href={FEEDBACK_URL} target="_blank" rel="noreferrer">
                  Open feedback form
                </a>
              </div>
            </section>
          )}
        </>
      ) : (
        <p className="warn-text">{error || 'Loading…'}</p>
      )}
    </div>
  )
}

