import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { joinLeagueByToken } from '../lib/leagues'

export function JoinPage() {
  const { token = '' } = useParams()
  const { ready, user } = useAuth()
  const [leagueId, setLeagueId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(true)

  useEffect(() => {
    if (!ready || !user || !token) return

    let cancelled = false
    setPending(true)
    setError('')

    joinLeagueByToken(token)
      .then((league) => {
        if (!cancelled) setLeagueId(league.id)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not join league')
          setPending(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [ready, user, token])

  if (!ready) return <p className="muted">Loading…</p>

  if (!user) {
    return (
      <div className="panel stack">
        <h1>Join league</h1>
        <p className="muted">
          You need an account to accept this invite. Create one with email +
          password, then you’ll return here automatically.
        </p>
        <Link
          className="cta enabled"
          to="/login"
          state={{ from: `/join/${token}` }}
        >
          Sign in or create account
        </Link>
        <p className="muted">
          <Link to="/">← Home</Link>
        </p>
      </div>
    )
  }

  if (leagueId) {
    return <Navigate to={`/league/${leagueId}`} replace />
  }

  return (
    <div className="panel">
      <h1>{pending && !error ? 'Joining league…' : 'Join league'}</h1>
      {error ? (
        <>
          <p className="warn-text">{error}</p>
          <Link to="/">Home</Link>
        </>
      ) : (
        <p className="muted">Hang on — adding you to the league.</p>
      )}
    </div>
  )
}
