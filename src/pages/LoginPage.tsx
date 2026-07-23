import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { user, ready, configured, signInWithMagicLink } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (ready && user) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
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
      <p className="muted">Magic link via email — no password.</p>

      {!configured && (
        <p className="warn-text">Supabase is not configured in this build.</p>
      )}

      <form className="stack" onSubmit={onSubmit}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={!configured || status === 'sending'}
          />
        </label>
        <button className="cta enabled" type="submit" disabled={!configured || status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send magic link'}
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
