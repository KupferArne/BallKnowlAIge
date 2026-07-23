import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { BonusTab } from '../components/BonusTab'
import { CreateTournamentForm } from '../components/CreateTournamentForm'
import { MatchCard } from '../components/MatchCard'
import { useAuth } from '../context/AuthContext'
import type { BonusAnswerRow, BonusQuestionRow } from '../lib/bonus'
import { inviteUrl, listMyLeagues } from '../lib/leagues'
import { groupMatchesByMatchday, playerTipsByMatchday } from '../lib/matchday'
import {
  membersMissingTip,
  pendingOpenBonuses,
  pendingOpenMatches,
  pendingTipsUrl,
} from '../lib/pending'
import { isTipLocked, matchStatusLabel } from '../lib/scoring'
import {
  addStubAiAgent,
  computeStandings,
  createTournament,
  deleteLeague,
  formatSupabaseError,
  getLeaguePlayData,
  kickMember,
  leaveLeague,
  regenerateStubAiTips,
  removeAiAgent,
  renameLeague,
  setMatchResult,
  upsertTip,
  type AiAgentRow,
  type MatchRow,
  type MemberRow,
  type TipRow,
  type TournamentRow,
} from '../lib/matches'
import type { LeagueRow } from '../lib/types'

type Tab = 'matches' | 'standings' | 'bonus' | 'rules' | 'league'
type MatchFilter = 'open' | 'all' | 'done'

const TABS: Tab[] = ['matches', 'standings', 'bonus', 'rules', 'league']
const FILTERS: MatchFilter[] = ['open', 'all', 'done']

function parseTab(value: string | null): Tab | null {
  return value && TABS.includes(value as Tab) ? (value as Tab) : null
}

function parseFilter(value: string | null): MatchFilter | null {
  return value && FILTERS.includes(value as MatchFilter)
    ? (value as MatchFilter)
    : null
}

const FEEDBACK_URL =
  'https://docs.google.com/forms/d/17ucmvY5K2xA2yz9S4nNun8Wb6ulcx_lmWHVjQdlg7GE/viewform'

export function LeaguePage() {
  const { leagueId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { ready, user } = useAuth()
  const [league, setLeague] = useState<LeagueRow | null>(null)
  const [tab, setTab] = useState<Tab>(
    () => parseTab(searchParams.get('tab')) ?? 'matches',
  )
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [tips, setTips] = useState<TipRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [aiAgents, setAiAgents] = useState<AiAgentRow[]>([])
  const [bonusQuestions, setBonusQuestions] = useState<BonusQuestionRow[]>([])
  const [bonusAnswers, setBonusAnswers] = useState<BonusAnswerRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [nudgeCopied, setNudgeCopied] = useState(false)
  const [tournament, setTournament] = useState<TournamentRow | null>(null)
  const [aiName, setAiName] = useState('Stub AI')
  const [leagueNameEdit, setLeagueNameEdit] = useState('')
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [matchFilter, setMatchFilter] = useState<MatchFilter>(
    () => parseFilter(searchParams.get('filter')) ?? 'open',
  )
  const highlightPending = searchParams.get('pending') === '1'

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? '' : t)), 2200)
  }, [])

  const setTabAndUrl = useCallback(
    (next: Tab) => {
      setTab(next)
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', next)
          if (next !== 'matches') {
            p.delete('filter')
            p.delete('pending')
          }
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setFilterAndUrl = useCallback(
    (next: MatchFilter) => {
      setMatchFilter(next)
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', 'matches')
          p.set('filter', next)
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

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
    setTournament(play.tournament)
    setMatches(play.matches)
    setTips(play.tips)
    setBonusQuestions(play.bonus_questions)
    setBonusAnswers(play.bonus_answers)
  }, [user, leagueId])

  const tournamentName = tournament?.name ?? null
  const competitionLabel =
    tournament?.competition_name ||
    tournament?.name ||
    null

  useEffect(() => {
    if (!ready || !user) return
    void reload().catch((err) => setError(formatSupabaseError(err)))
  }, [ready, user, reload])

  useEffect(() => {
    const t = parseTab(searchParams.get('tab'))
    if (t) setTab(t)
    const f = parseFilter(searchParams.get('filter'))
    if (f) setMatchFilter(f)
  }, [searchParams])

  const standings = useMemo(
    () =>
      computeStandings(matches, tips, members, bonusQuestions, bonusAnswers),
    [matches, tips, members, bonusQuestions, bonusAnswers],
  )

  const myPendingMatches = useMemo(
    () => (user ? pendingOpenMatches(matches, tips, user.id) : []),
    [matches, tips, user],
  )
  const myPendingBonuses = useMemo(
    () => (user ? pendingOpenBonuses(bonusQuestions, bonusAnswers, user.id) : []),
    [bonusQuestions, bonusAnswers, user],
  )
  const pendingMatchIds = useMemo(
    () => new Set(myPendingMatches.map((m) => m.id)),
    [myPendingMatches],
  )

  const filteredMatches = useMemo(() => {
    if (matchFilter === 'all') return matches
    return matches.filter((m) => {
      const status = matchStatusLabel(m.status, m.kickoff_at)
      if (matchFilter === 'done') return status === 'finished'
      return status !== 'finished'
    })
  }, [matches, matchFilter])

  const matchGroups = useMemo(
    () => groupMatchesByMatchday(filteredMatches),
    [filteredMatches],
  )

  useEffect(() => {
    if (!highlightPending || !myPendingMatches[0]) return
    const id = myPendingMatches[0].id
    const t = window.setTimeout(() => {
      document
        .getElementById(`match-${id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [highlightPending, myPendingMatches, matchGroups])

  async function onCreateTournament(input: {
    competitionId: string
    competitionName: string
    season: string | null
    seedDemo: boolean
  }) {
    setBusy(true)
    setError('')
    try {
      await createTournament({
        leagueId,
        competitionId: input.competitionId,
        competitionName: input.competitionName,
        season: input.season,
        seedDemo: input.seedDemo,
      })
      setTabAndUrl('matches')
      try {
        await reload()
        showToast('Tournament ready ✓')
      } catch (reloadErr) {
        setError(
          'Tournament was created, but reload failed: ' +
            formatSupabaseError(reloadErr),
        )
      }
    } catch (err) {
      setError(formatSupabaseError(err) || 'Could not create tournament')
      throw err
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
              {competitionLabel ? (
                <>
                  {' · '}
                  <span className="pill">{competitionLabel}</span>
                  {tournament?.season ? ` ${tournament.season}` : ''}
                </>
              ) : null}
            </p>
          </header>

          <nav className="tabs tabs-sticky" aria-label="League sections">
            {(
              [
                ['matches', 'Matches'],
                ['standings', 'Standings'],
                ['bonus', `Bonus${myPendingBonuses.length ? ` (${myPendingBonuses.length})` : ''}`],
                ['rules', 'Rules'],
                ['league', 'League'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? 'tab active' : 'tab'}
                onClick={() => setTabAndUrl(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          {(myPendingMatches.length > 0 || myPendingBonuses.length > 0) && (
            <div className="panel pending-banner">
              <h2>Reminders</h2>
              <p className="muted">
                {myPendingMatches.length > 0 && (
                  <>
                    {myPendingMatches.length} open match
                    {myPendingMatches.length === 1 ? '' : 'es'} without your tip
                  </>
                )}
                {myPendingMatches.length > 0 && myPendingBonuses.length > 0 && ' · '}
                {myPendingBonuses.length > 0 && (
                  <>
                    {myPendingBonuses.length} open bonus question
                    {myPendingBonuses.length === 1 ? '' : 's'}
                  </>
                )}
              </p>
              <div className="row-actions">
                {myPendingMatches.length > 0 && (
                  <button
                    type="button"
                    className="cta enabled"
                    onClick={() => {
                      setMatchFilter('open')
                      setTab('matches')
                      setSearchParams(
                        {
                          tab: 'matches',
                          filter: 'open',
                          pending: '1',
                        },
                        { replace: true },
                      )
                    }}
                  >
                    Tip open matches
                  </button>
                )}
                {myPendingBonuses.length > 0 && (
                  <button
                    type="button"
                    className="cta enabled"
                    onClick={() => setTabAndUrl('bonus')}
                  >
                    Answer bonuses
                  </button>
                )}
              </div>
            </div>
          )}

          {error && <p className="warn-text">{error}</p>}
          {toast && (
            <p className="toast ok-text" role="status">
              {toast}
            </p>
          )}

          {tab === 'matches' && (
            <section className="stack matches-section">
              {!tournamentName && league.my_role === 'owner' && (
                <div className="panel stack">
                  <h2>Create tournament</h2>
                  <p className="muted">
                    Pick the competition (e.g. World Cup, Bundesliga) and
                    optional season. Demo fixtures are sample matches so you can
                    tip immediately — not the real schedule yet.
                  </p>
                  <CreateTournamentForm
                    busy={busy}
                    onSubmit={onCreateTournament}
                  />
                </div>
              )}
              {!tournamentName && league.my_role !== 'owner' && (
                <p className="muted">
                  Waiting for the owner to create a tournament.
                </p>
              )}
              {tournamentName && (
                <div className="tabs filter-tabs" role="group" aria-label="Match filter">
                  {(
                    [
                      ['open', 'Open'],
                      ['all', 'All'],
                      ['done', 'Done'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={matchFilter === id ? 'tab active' : 'tab'}
                      onClick={() => setFilterAndUrl(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {tournamentName && matchGroups.length === 0 && (
                <p className="muted">
                  No matches in this filter.
                  {matchFilter !== 'all' && (
                    <>
                      {' '}
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => setFilterAndUrl('all')}
                      >
                        Show all
                      </button>
                    </>
                  )}
                </p>
              )}
              {matchGroups.map((group) => (
                <div key={group.day} className="matchday-section">
                  <h2 className="matchday-sticky">{group.day}</h2>
                  <div className="stack matchday-cards">
                    {group.matches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        tips={tips.filter((t) => t.match_id === match.id)}
                        members={members}
                        userId={user.id}
                        isOwner={league.my_role === 'owner'}
                        pendingTip={pendingMatchIds.has(match.id)}
                        onSaveTip={onSaveTip}
                        onSetResult={onSetResult}
                      />
                    ))}
                  </div>
                </div>
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
                      matchPoints: 0,
                      bonusPoints: 0,
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
                        {row.bonusPoints
                          ? ` · ${row.bonusPoints} bonus`
                          : ''}
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

          {tab === 'bonus' && (
            <BonusTab
              leagueId={leagueId}
              isOwner={league.my_role === 'owner'}
              userId={user.id}
              questions={bonusQuestions}
              answers={bonusAnswers}
              members={members}
              onChange={({ questions, answers }) => {
                setBonusQuestions(questions)
                setBonusAnswers(answers)
              }}
            />
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
                <li>
                  Bonus questions: owner sets prompt + points weight; correct
                  answer awards that weight in full
                </li>
              </ul>
            </section>
          )}

          {tab === 'league' && (
            <section className="stack">
              <div className="panel stack">
                <h2>Tip reminder link</h2>
                <p className="muted">
                  Share this deep link so players jump straight to open matches
                  that still need a tip.
                </p>
                <button
                  type="button"
                  className="cta enabled"
                  onClick={() => {
                    void navigator.clipboard.writeText(pendingTipsUrl(leagueId))
                    setNudgeCopied(true)
                    window.setTimeout(() => setNudgeCopied(false), 2000)
                  }}
                >
                  {nudgeCopied ? 'Copied!' : 'Copy pending-tips link'}
                </button>
                {league.my_role === 'owner' && (
                  <ul className="league-list">
                    {matches
                      .filter(
                        (m) =>
                          matchStatusLabel(m.status, m.kickoff_at) !==
                            'finished' && !isTipLocked(m.kickoff_at),
                      )
                      .map((m) => {
                        const missing = membersMissingTip(m.id, tips, members)
                        if (missing.length === 0) return null
                        return (
                          <li key={m.id}>
                            <span>
                              {m.home_team} vs {m.away_team}
                            </span>
                            <span className="muted">
                              missing:{' '}
                              {missing.map((x) => x.display_name).join(', ')}
                            </span>
                          </li>
                        )
                      })}
                  </ul>
                )}
              </div>

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
                  <div className="stack">
                    <h3>Change competition / re-seed</h3>
                    <p className="muted">
                      Updates the competition label. Checking “demo fixtures”
                      clears tips and rebuilds sample matches — re-run
                      “Regenerate AI tips” afterwards.
                    </p>
                    <CreateTournamentForm
                      busy={busy}
                      submitLabel="Update tournament"
                      onSubmit={onCreateTournament}
                    />
                  </div>
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

