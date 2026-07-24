import { useState, type FormEvent } from 'react'
import { BonusTab } from './BonusTab'
import { CreateTournamentForm } from './CreateTournamentForm'
import type { BonusAnswerRow, BonusQuestionRow } from '../lib/bonus'
import {
  isWithinReminderWindow,
  membersMissingTip,
} from '../lib/pending'
import { isTipLocked, matchStatusLabel } from '../lib/scoring'
import { canSyncCompetition, syncSourcesFor } from '../lib/syncSources'
import type {
  AiAgentRow,
  MatchRow,
  MemberRow,
  TipRow,
  TournamentRow,
} from '../lib/matches'

export function LeagueAdminTab({
  leagueId,
  userId,
  tournament,
  matches,
  tips,
  members,
  aiAgents,
  bonusQuestions,
  bonusAnswers,
  busy,
  leagueNameEdit,
  aiName,
  onLeagueNameEdit,
  onAiName,
  onCreateTournament,
  onSyncFixtures,
  onRenameLeague,
  onDeleteLeague,
  onAddAi,
  onRemoveAi,
  onRegenerateAiTips,
  onKickMember,
  onBonusChange,
}: {
  leagueId: string
  userId: string
  tournament: TournamentRow | null
  matches: MatchRow[]
  tips: TipRow[]
  members: MemberRow[]
  aiAgents: AiAgentRow[]
  bonusQuestions: BonusQuestionRow[]
  bonusAnswers: BonusAnswerRow[]
  busy: boolean
  leagueNameEdit: string
  aiName: string
  onLeagueNameEdit: (v: string) => void
  onAiName: (v: string) => void
  onCreateTournament: (input: {
    competitionId: string
    competitionName: string
    season: string | null
    seedDemo: boolean
  }) => Promise<void>
  onSyncFixtures: () => Promise<void>
  onRenameLeague: () => Promise<void>
  onDeleteLeague: () => void
  onAddAi: (e: FormEvent) => void
  onRemoveAi: (id: string) => void
  onRegenerateAiTips: () => void
  onKickMember: (userId: string) => void
  onBonusChange: (next: {
    questions: BonusQuestionRow[]
    answers: BonusAnswerRow[]
  }) => void
}) {
  const [section, setSection] = useState<
    'tournament' | 'bonus' | 'ai' | 'league'
  >('tournament')

  return (
    <section className="stack">
      <div className="panel stack">
        <h2>Admin</h2>
        <p className="muted">
          Owner-only tools: fixtures, bonus questions, AI players, and league
          settings.
        </p>
        <div className="tabs filter-tabs" role="group" aria-label="Admin sections">
          {(
            [
              ['tournament', 'Tournament'],
              ['bonus', 'Bonus'],
              ['ai', 'AI'],
              ['league', 'League'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={section === id ? 'tab active' : 'tab'}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {section === 'tournament' && (
        <>
          {!tournament && (
            <div className="panel stack">
              <h2>Create tournament</h2>
              <p className="muted">
                Pick the competition and optional season. Demo fixtures are
                sample matches so you can tip immediately.
              </p>
              <CreateTournamentForm busy={busy} onSubmit={onCreateTournament} />
            </div>
          )}

          {tournament && canSyncCompetition(tournament.competition_id) && (
            <div className="panel stack sync-panel">
              <h2>Fixture sync</h2>
              <p className="muted">
                Pull schedule + results from free sources (
                {syncSourcesFor(tournament.competition_id)
                  .map((s) => s.label)
                  .join(' · ')}
                ). Re-sync after KO rounds to refresh opponents.
              </p>
              {tournament.last_synced_at && (
                <p className="muted">
                  Last sync:{' '}
                  {new Date(tournament.last_synced_at).toLocaleString()}
                  {tournament.sync_source ? ` · ${tournament.sync_source}` : ''}
                </p>
              )}
              <button
                type="button"
                className="cta enabled"
                disabled={busy}
                onClick={() => void onSyncFixtures()}
              >
                {busy ? 'Syncing…' : 'Sync fixtures now'}
              </button>
            </div>
          )}

          {tournament && (
            <div className="panel stack">
              <h2>Change competition / re-seed</h2>
              <p className="muted">
                Updates the competition label. Checking “demo fixtures” clears
                tips and rebuilds sample matches — re-run “Regenerate AI tips”
                afterwards.
              </p>
              <CreateTournamentForm
                busy={busy}
                submitLabel="Update tournament"
                defaults={{
                  competitionId: tournament.competition_id,
                  competitionName: tournament.competition_name,
                  season: tournament.season,
                  seedDemo: false,
                }}
                onSubmit={onCreateTournament}
              />
            </div>
          )}

          <div className="panel stack">
            <h2>Missing tips (next 24h)</h2>
            <p className="muted">
              Who still needs a tip for matches kicking off soon.
            </p>
            <ul className="league-list">
              {matches
                .filter(
                  (m) =>
                    matchStatusLabel(m.status, m.kickoff_at) !== 'finished' &&
                    !isTipLocked(m.kickoff_at) &&
                    isWithinReminderWindow(m.kickoff_at),
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
                        missing: {missing.map((x) => x.display_name).join(', ')}
                      </span>
                    </li>
                  )
                })}
            </ul>
          </div>
        </>
      )}

      {section === 'bonus' && (
        <BonusTab
          leagueId={leagueId}
          isOwner
          manage
          userId={userId}
          questions={bonusQuestions}
          answers={bonusAnswers}
          members={members}
          onChange={onBonusChange}
        />
      )}

      {section === 'ai' && (
        <div className="panel stack">
          <h2>AI players (stub)</h2>
          <p className="muted">
            Free heuristic tips — no OpenRouter key. Counts on the leaderboard.
          </p>
          <form className="stack" onSubmit={onAddAi}>
            <label className="field">
              <span>Name</span>
              <input
                value={aiName}
                onChange={(e) => onAiName(e.target.value)}
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
                      onClick={() => onRemoveAi(a.id)}
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
                onClick={onRegenerateAiTips}
              >
                Regenerate AI tips
              </button>
            </>
          )}
        </div>
      )}

      {section === 'league' && (
        <>
          <div className="panel stack">
            <h2>League settings</h2>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault()
                void onRenameLeague()
              }}
            >
              <label className="field">
                <span>League name</span>
                <input
                  value={leagueNameEdit}
                  onChange={(e) => onLeagueNameEdit(e.target.value)}
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
              className="danger"
              disabled={busy}
              onClick={onDeleteLeague}
            >
              Delete league
            </button>
          </div>

          <div className="panel stack">
            <h2>Members</h2>
            <ul className="league-list">
              {members.map((m) => (
                <li key={m.user_id}>
                  <span>
                    {m.display_name} <span className="pill">{m.role}</span>
                  </span>
                  {m.kind !== 'ai' && m.user_id !== userId && (
                    <button
                      type="button"
                      className="linkish"
                      disabled={busy}
                      onClick={() => onKickMember(m.user_id)}
                    >
                      Kick
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}
