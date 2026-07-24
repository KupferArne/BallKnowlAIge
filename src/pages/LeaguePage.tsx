import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { BonusTab } from '../components/BonusTab'
import { LeagueAdminTab } from '../components/LeagueAdminTab'
import { MatchTable } from '../components/MatchTable'
import { StandingsTable } from '../components/StandingsTable'
import { useAuth } from '../context/AuthContext'
import type { BonusAnswerRow, BonusQuestionRow } from '../lib/bonus'
import { inviteUrl, listMyLeagues } from '../lib/leagues'
import { groupMatchesByMatchday } from '../lib/matchday'
import { getCompetition } from '../data/competitions'
import { syncTournamentFixtures } from '../lib/fixtureSync'
import { proposedKoFills } from '../lib/koFill'
import { iconKindForCompetitionCategory } from '../lib/teamIcons'
import {
  pendingOpenBonuses,
  pendingOpenMatches,
  pendingTipsUrl,
} from '../lib/pending'
import { matchStatusLabel } from '../lib/scoring'
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
  updateMatchTeams,
  upsertTip,
  type AiAgentRow,
  type MatchRow,
  type MemberRow,
  type TipRow,
  type TournamentRow,
} from '../lib/matches'
import type { LeagueRow } from '../lib/types'

type Tab = 'matches' | 'standings' | 'bonus' | 'rules' | 'league' | 'admin'
type MatchFilter = 'open' | 'all' | 'done'

const PLAYER_TABS: Tab[] = ['matches', 'standings', 'bonus', 'rules', 'league']
const OWNER_TABS: Tab[] = [...PLAYER_TABS, 'admin']
const FILTERS: MatchFilter[] = ['open', 'all', 'done']

function parseTab(value: string | null, isOwner: boolean): Tab | null {
  const tabs = isOwner ? OWNER_TABS : PLAYER_TABS
  return value && tabs.includes(value as Tab) ? (value as Tab) : null
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
    () => parseTab(searchParams.get('tab'), true) ?? 'matches',
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
  const teamIconKind = iconKindForCompetitionCategory(
    getCompetition(tournament?.competition_id ?? '')?.category,
  )

  useEffect(() => {
    if (!ready || !user) return
    void reload().catch((err) => setError(formatSupabaseError(err)))
  }, [ready, user, reload])

  const isOwner = league?.my_role === 'owner'

  useEffect(() => {
    const t = parseTab(searchParams.get('tab'), Boolean(isOwner))
    if (t) setTab(t)
    else if (searchParams.get('tab') === 'admin' && league && !isOwner) {
      setTab('matches')
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', 'matches')
          return p
        },
        { replace: true },
      )
    }
    const f = parseFilter(searchParams.get('filter'))
    if (f) setMatchFilter(f)
  }, [searchParams, isOwner, league, setSearchParams])

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

  async function applyKoFillsFrom(current: MatchRow[]) {
    const fills = proposedKoFills(current)
    if (fills.length === 0) return 0
    for (const fill of fills) {
      await updateMatchTeams(fill.matchId, fill.home_team, fill.away_team)
    }
    return fills.length
  }

  async function onSyncFixtures() {
    if (!tournament?.competition_id) {
      setError('Pick a competition before syncing.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await syncTournamentFixtures({
        leagueId,
        competitionId: tournament.competition_id,
        season: tournament.season ?? null,
      })
      let filled = 0
      try {
        const data = await getLeaguePlayData(leagueId)
        filled = await applyKoFillsFrom(data.matches)
      } catch {
        /* KO fill needs 00010 — sync itself still succeeded */
      }
      await reload()
      showToast(
        filled > 0
          ? `Synced ${result.upserted} matches · filled ${filled} KO slot(s)`
          : `Synced ${result.upserted} matches (${result.via})`,
      )
    } catch (err) {
      setError(formatSupabaseError(err) || 'Sync failed')
    } finally {
      setBusy(false)
    }
  }

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
      let filled = 0
      try {
        const data = await getLeaguePlayData(leagueId)
        filled = await applyKoFillsFrom(data.matches)
      } catch {
        /* optional until 00010 applied */
      }
      await reload()
      if (filled > 0) showToast(`Filled ${filled} KO opponent slot(s) ✓`)
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
      {league ? (
        <>
          <header className="hero">
            <p className="brand league-title-brand">{league.name}</p>
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
                ['matches', 'Matches', 'Tips'],
                ['standings', 'Standings', 'Table'],
                [
                  'bonus',
                  `Bonus${myPendingBonuses.length ? ` (${myPendingBonuses.length})` : ''}`,
                  `Bonus${myPendingBonuses.length ? ` ${myPendingBonuses.length}` : ''}`,
                ],
                ['rules', 'Rules', 'Rules'],
                ['league', 'League', 'League'],
                ...(isOwner
                  ? ([['admin', 'Admin', 'Admin']] as const)
                  : []),
              ] as const
            ).map(([id, label, short]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? 'tab active' : 'tab'}
                onClick={() => setTabAndUrl(id)}
                aria-label={label}
              >
                <span className="tab-label-full">{label}</span>
                <span className="tab-label-short">{short}</span>
              </button>
            ))}
          </nav>

          {(myPendingMatches.length > 0 || myPendingBonuses.length > 0) && (
            <div className="panel pending-banner">
              <h2>Reminders</h2>
              <p className="muted">
                {myPendingMatches.length > 0 && (
                  <>
                    {myPendingMatches.length} untipped match
                    {myPendingMatches.length === 1 ? '' : 'es'} kick
                    {myPendingMatches.length === 1 ? 's' : ''} off within 24h
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
              {!tournamentName && (
                <div className="panel stack">
                  <h2>No tournament yet</h2>
                  <p className="muted">
                    {isOwner
                      ? 'Create a tournament and sync fixtures in Admin.'
                      : 'Waiting for the owner to create a tournament.'}
                  </p>
                  {isOwner && (
                    <button
                      type="button"
                      className="cta enabled"
                      onClick={() => setTabAndUrl('admin')}
                    >
                      Open Admin
                    </button>
                  )}
                </div>
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
              {matchGroups.length > 0 && (
                <MatchTable
                  groups={matchGroups}
                  tips={tips}
                  members={members}
                  userId={user.id}
                  isOwner={league.my_role === 'owner'}
                  pendingMatchIds={pendingMatchIds}
                  iconKind={teamIconKind}
                  onSaveTip={onSaveTip}
                  onSetResult={onSetResult}
                />
              )}
            </section>
          )}

          {tab === 'standings' && (
            <section className="panel stack">
              <h2>Leaderboard</h2>
              <p className="muted">
                Next matches show as logo columns. <code>-:-</code> means tipped
                (hidden until kickoff); scores appear after kickoff. Tap a
                player for full tip history.
              </p>
              <StandingsTable
                rows={
                  standings.length
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
                }
                matches={matches}
                tips={tips}
                userId={user.id}
                iconKind={teamIconKind}
              />
            </section>
          )}

          {tab === 'bonus' && (
            <BonusTab
              leagueId={leagueId}
              isOwner={Boolean(isOwner)}
              manage={false}
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
                <li>
                  Other tips show as <code>-:-</code> until kickoff, then the
                  score is revealed
                </li>
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

              <div className="panel stack">
                <h2>Tip reminder link</h2>
                <p className="muted">
                  Jump to matches kicking off within 24 hours that still need a
                  tip.
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
              </div>

              <div className="panel stack">
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
                {!isOwner && (
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
                <a
                  className="cta enabled"
                  href={FEEDBACK_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open feedback form
                </a>
              </div>
            </section>
          )}

          {tab === 'admin' && isOwner && (
            <LeagueAdminTab
              leagueId={leagueId}
              userId={user.id}
              tournament={tournament}
              matches={matches}
              tips={tips}
              members={members}
              aiAgents={aiAgents}
              bonusQuestions={bonusQuestions}
              bonusAnswers={bonusAnswers}
              busy={busy}
              leagueNameEdit={leagueNameEdit}
              aiName={aiName}
              onLeagueNameEdit={setLeagueNameEdit}
              onAiName={setAiName}
              onCreateTournament={onCreateTournament}
              onSyncFixtures={onSyncFixtures}
              onRenameLeague={() =>
                runAdmin(async () => {
                  await renameLeague(leagueId, leagueNameEdit)
                })
              }
              onDeleteLeague={() => {
                if (
                  confirm(
                    'Delete this league and all matches/tips permanently?',
                  )
                ) {
                  void runAdmin(() => deleteLeague(leagueId), true)
                }
              }}
              onAddAi={(e) => {
                e.preventDefault()
                void runAdmin(async () => {
                  await addStubAiAgent(leagueId, aiName)
                  setAiName('Stub AI')
                })
              }}
              onRemoveAi={(id) => {
                void runAdmin(() => removeAiAgent(id))
              }}
              onRegenerateAiTips={() => {
                void runAdmin(async () => {
                  await regenerateStubAiTips(leagueId)
                })
              }}
              onKickMember={(memberId) => {
                void runAdmin(() => kickMember(leagueId, memberId))
              }}
              onBonusChange={({ questions, answers }) => {
                setBonusQuestions(questions)
                setBonusAnswers(answers)
              }}
            />
          )}
        </>
      ) : (
        <p className="warn-text">{error || 'Loading…'}</p>
      )}
    </div>
  )
}

