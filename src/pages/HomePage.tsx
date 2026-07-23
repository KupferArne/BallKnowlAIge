import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DbSetupBanner } from '../components/DbSetupBanner'
import { useAuth } from '../context/AuthContext'
import { listMyPendingTips, type PendingLeagueTips } from '../lib/bonus'
import { createLeague, inviteUrl, listMyLeagues } from '../lib/leagues'
import { pendingBonusPath, pendingTipsPath } from '../lib/pending'
import type { LeagueRow } from '../lib/types'

export function HomePage() {
  const { ready, user, profile, configured, updateDisplayName, signOut } = useAuth()
  const [leagues, setLeagues] = useState<LeagueRow[]>([])
  const [pending, setPending] = useState<PendingLeagueTips[]>([])
  const [leagueName, setLeagueName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [needsBonusMigration, setNeedsBonusMigration] = useState(false)

  const reload = useCallback(async () => {
    if (!user) {
      setLeagues([])
      setPending([])
      return
    }
    const rows = await listMyLeagues()
    setLeagues(rows)
    try {
      const p = await listMyPendingTips()
      setPending(p)
      setNeedsBonusMigration(false)
    } catch {
      setPending([])
      setNeedsBonusMigration(true)
    }
  }, [user])

  useEffect(() => {
    if (!ready || !user) return
    setDisplayName(profile?.display_name ?? '')
    void reload().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load leagues'),
    )
  }, [ready, user, profile?.display_name, reload])

  const actionablePending = useMemo(
    () =>
      pending.filter((p) => p.pending_matches > 0 || p.pending_bonuses > 0),
    [pending],
  )

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const league = await createLeague(leagueName)
      setLeagueName('')
      setLeagues((prev) => [league, ...prev.filter((l) => l.id !== league.id)])
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create league')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveName(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await updateDisplayName(displayName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save name')
    } finally {
      setBusy(false)
    }
  }

  async function copyInvite(token: string, id: string) {
    await navigator.clipboard.writeText(inviteUrl(token))
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!ready) {
    return <p className="muted">Loading…</p>
  }

  return (
    <div className="stack-lg">
      <header className="hero">
        <p className="brand">BallKnowlAIge</p>
        <h1>Tip leagues for any tournament</h1>
        <p className="lede">
          Create a league, invite colleagues with a share link, tip exact scores.
        </p>
      </header>

      {!configured && (
        <p className="warn-text">Missing Supabase env — see README.</p>
      )}

      <DbSetupBanner />

      {needsBonusMigration && user && (
        <div className="panel warn-panel">
          <h2>Apply migration 00006</h2>
          <p className="muted">
            Bonus questions and tip reminders need{' '}
            <a
              href="https://github.com/KupferArne/BallKnowlAIge/blob/main/supabase/migrations/00006_bonus_and_pending.sql"
              target="_blank"
              rel="noreferrer"
            >
              00006_bonus_and_pending.sql
            </a>{' '}
            in the Supabase SQL Editor.
          </p>
        </div>
      )}

      {!user ? (
        <div className="panel">
          <p>Sign in to create or join a league.</p>
          <Link className="cta enabled" to="/login">
            Sign in with email
          </Link>
        </div>
      ) : (
        <>
          <section className="panel">
            <div className="row-between">
              <div>
                <h2>You</h2>
                <p className="muted">{user.email}</p>
              </div>
              <button type="button" className="linkish" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
            <form className="stack" onSubmit={onSaveName}>
              <label className="field">
                <span>Display name</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                  required
                />
              </label>
              <button className="cta enabled" type="submit" disabled={busy}>
                Save name
              </button>
            </form>
          </section>

          {actionablePending.length > 0 && (
            <section className="panel pending-banner stack">
              <h2>Open tips</h2>
              <p className="muted">Jump back into leagues that still need your picks.</p>
              <ul className="league-list">
                {actionablePending.map((p) => (
                  <li key={p.league_id}>
                    <div>
                      <span className="league-title">{p.league_name}</span>
                      <span className="muted">
                        {p.pending_matches > 0 &&
                          `${p.pending_matches} match${p.pending_matches === 1 ? '' : 'es'}`}
                        {p.pending_matches > 0 && p.pending_bonuses > 0 && ' · '}
                        {p.pending_bonuses > 0 &&
                          `${p.pending_bonuses} bonus`}
                      </span>
                    </div>
                    <div className="row-actions">
                      {p.pending_matches > 0 && (
                        <Link className="linkish" to={pendingTipsPath(p.league_id)}>
                          Tip matches
                        </Link>
                      )}
                      {p.pending_bonuses > 0 && (
                        <Link className="linkish" to={pendingBonusPath(p.league_id)}>
                          Bonuses
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel">
            <h2>Create league</h2>
            <form className="stack" onSubmit={onCreate}>
              <label className="field">
                <span>League name</span>
                <input
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  placeholder="Office WC picks"
                  required
                  maxLength={80}
                  disabled={busy}
                />
              </label>
              <button className="cta enabled" type="submit" disabled={busy}>
                {busy ? 'Working…' : 'Create league'}
              </button>
            </form>
          </section>

          <section className="panel">
            <h2>Your leagues</h2>
            {leagues.length === 0 ? (
              <p className="muted">No leagues yet — create one or open an invite link.</p>
            ) : (
              <ul className="league-list">
                {leagues.map((l) => (
                  <li key={l.id}>
                    <div>
                      <Link to={`/league/${l.id}`} className="league-title">
                        {l.name}
                      </Link>
                      <span className="pill">{l.my_role}</span>
                    </div>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => void copyInvite(l.invite_token, l.id)}
                    >
                      {copiedId === l.id ? 'Copied!' : 'Copy invite link'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {error && <p className="warn-text">{error}</p>}

      <p className="muted">
        <a href="https://github.com/KupferArne/BallKnowlAIge/blob/main/BACKLOG.md">
          Backlog
        </a>
        {' · '}
        <a
          href="https://docs.google.com/forms/d/17ucmvY5K2xA2yz9S4nNun8Wb6ulcx_lmWHVjQdlg7GE/viewform"
          target="_blank"
          rel="noreferrer"
        >
          Feedback
        </a>
      </p>
    </div>
  )
}
