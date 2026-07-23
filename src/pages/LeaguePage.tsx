import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { inviteUrl, listMyLeagues } from '../lib/leagues'
import type { LeagueRow } from '../lib/types'

export function LeaguePage() {
  const { leagueId = '' } = useParams()
  const { ready, user } = useAuth()
  const [league, setLeague] = useState<LeagueRow | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!ready || !user) return
    listMyLeagues()
      .then((rows) => {
        const found = rows.find((r) => r.id === leagueId) ?? null
        setLeague(found)
        if (!found) setError('League not found or you are not a member.')
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load league'),
      )
  }, [ready, user, leagueId])

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
    <div className="panel stack">
      <p>
        <Link to="/">← All leagues</Link>
      </p>
      {league ? (
        <>
          <h1>{league.name}</h1>
          <p className="muted">
            Your role: <span className="pill">{league.my_role}</span>
          </p>
          <button
            type="button"
            className="cta enabled"
            onClick={() => {
              void navigator.clipboard.writeText(inviteUrl(league.invite_token)).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              })
            }}
          >
            {copied ? 'Invite link copied' : 'Copy invite link'}
          </button>
          <p className="muted">
            Matches, tips and leaderboard land in Epics 3–4. For now you can invite
            teammates with the link above.
          </p>
        </>
      ) : (
        <p className="warn-text">{error || 'Loading…'}</p>
      )}
    </div>
  )
}
