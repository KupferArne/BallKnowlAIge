import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type Mode = 'signin' | 'signup'

export function LoginPage() {
  const {
    user,
    ready,
    configured,
    signInWithPassword,
    signUpWithPassword,
    signInWithMagicLink,
  } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'working' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (ready && user) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('working')
    setMessage('')
    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password)
      } else {
        const hasSession = await signUpWithPassword(email, password)
        if (!hasSession) {
          setStatus('sent')
          setMessage(
            'Account created. Confirm your email if required, then sign in. ' +
              '(For tippspiels: in Supabase Auth → Providers → Email, turn off “Confirm email”.)',
          )
          setMode('signin')
          return
        }
      }
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Auth failed')
    } finally {
      setStatus((s) => (s === 'working' ? 'idle' : s))
    }
  }

  async function onMagicLink() {
    setStatus('working')
    setMessage('')
    try {
      await signInWithMagicLink(email)
      setStatus('sent')
      setMessage('Magic link sent — check your inbox (often rate-limited on free tier).')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Magic link failed')
    }
  }

  const joining = from.startsWith('/join/')

  return (
    <div className="panel stack">
      <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
      <p className="muted">
        {joining
          ? 'Sign in or create an account to join the league invite.'
          : 'Email + password is the recommended way (Magic Link is optional).'}
      </p>

      {!configured && (
        <p className="warn-text">Supabase is not configured in this build.</p>
      )}

      <div className="tabs filter-tabs" role="group" aria-label="Auth mode">
        <button
          type="button"
          className={mode === 'signin' ? 'tab active' : 'tab'}
          onClick={() => {
            setMode('signin')
            setMessage('')
            setStatus('idle')
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === 'signup' ? 'tab active' : 'tab'}
          onClick={() => {
            setMode('signup')
            setMessage('')
            setStatus('idle')
          }}
        >
          Create account
        </button>
      </div>

      <form className="stack" onSubmit={(e) => void onSubmit(e)}>
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
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!configured || status === 'working'}
          />
        </label>
        <button
          className="cta enabled"
          type="submit"
          disabled={!configured || status === 'working'}
        >
          {status === 'working'
            ? 'Working…'
            : mode === 'signin'
              ? 'Sign in'
              : 'Create account'}
        </button>
      </form>

      <details className="auth-advanced">
        <summary className="muted">Magic link (optional)</summary>
        <p className="muted">
          Often fails on free Supabase (rate limits / email). Prefer password.
        </p>
        <button
          className="linkish"
          type="button"
          disabled={!configured || !email || status === 'working'}
          onClick={() => void onMagicLink()}
        >
          Send magic link to this email
        </button>
      </details>

      {message && (
        <p className={status === 'error' ? 'warn-text' : 'ok-text'}>{message}</p>
      )}

      <p className="muted">
        <Link to="/">← Back</Link>
      </p>
    </div>
  )
}
