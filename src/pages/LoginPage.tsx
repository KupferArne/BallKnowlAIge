import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { user, ready, configured, signInWithPassword, signInWithMagicLink } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'working' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (ready && user) {
    return <Navigate to={from} replace />
  }

  async function onPasswordLogin(e: FormEvent) {
    e.preventDefault()
    setStatus('working')
    setMessage('')
    try {
      await signInWithPassword(email, password)
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Sign-in failed')
    }
  }

  async function onMagicLink(e: FormEvent) {
    e.preventDefault()
    setStatus('working')
    setMessage('')
    try {
      await signInWithMagicLink(email)
      setStatus('sent')
      setMessage('Check your email for the magic link.')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Sign-in failed')
    }
  }

  return (
    <div className="panel">
      <h1>Sign in</h1>
      <p className="muted">
        Use email + password for users created in the Supabase dashboard (works
        while Magic Link is rate-limited).
      </p>

      {!configured && (
        <p className="warn-text">Supabase is not configured in this build.</p>
      )}

      <form className="stack" onSubmit={onPasswordLogin}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={!configured || status === 'working'}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!configured || status === 'working'}
          />
        </label>
        <button className="cta enabled" type="submit" disabled={!configured || status === 'working'}>
          {status === 'working' ? 'Signing in…' : 'Sign in with password'}
        </button>
      </form>

      <hr className="divider" />

      <form className="stack" onSubmit={onMagicLink}>
        <p className="muted">Or send a Magic Link (same email field above):</p>
        <button
          className="linkish"
          type="submit"
          disabled={!configured || !email || status === 'working'}
        >
          Send magic link instead
        </button>
      </form>

      {message && (
        <p className={status === 'error' ? 'warn-text' : 'ok-text'}>{message}</p>
      )}

      <p className="muted">
        <Link to="/">← Back</Link>
      </p>
    </div>
  )
}
