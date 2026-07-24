import { useCallback, useEffect, useId, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listMyLeagues } from '../lib/leagues'
import {
  getThemePreference,
  resolveTheme,
  toggleLightDark,
} from '../lib/theme'
import type { LeagueRow } from '../lib/types'

function ThemeIcon({ mode }: { mode: 'light' | 'dark' }) {
  if (mode === 'dark') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"
        />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 4.5a1 1 0 0 1 1 1V7a1 1 0 1 1-2 0V5.5a1 1 0 0 1 1-1Zm0 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.5-4.5a1 1 0 0 1-1 1H17a1 1 0 1 1 0-2h1.5a1 1 0 0 1 1 1ZM7 12a1 1 0 0 1-1 1H4.5a1 1 0 1 1 0-2H6a1 1 0 0 1 1 1Zm9.95 5.45a1 1 0 0 1-1.4 1.4l-1.1-1.1a1 1 0 1 1 1.4-1.4l1.1 1.1Zm-9.9 0 1.1-1.1a1 1 0 0 1 1.4 1.4l-1.1 1.1a1 1 0 1 1-1.4-1.4Zm9.9-10.9-1.1 1.1a1 1 0 1 1-1.4-1.4l1.1-1.1a1 1 0 0 1 1.4 1.4ZM8.55 6.55a1 1 0 0 1-1.4-1.4l1.1-1.1a1 1 0 0 1 1.4 1.4l-1.1 1.1ZM12 17a1 1 0 0 1 1 1v1.5a1 1 0 1 1-2 0V18a1 1 0 0 1 1-1Z"
      />
    </svg>
  )
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      {open ? (
        <path
          fill="currentColor"
          d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M4 7h16v2H4V7Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z"
        />
      )}
    </svg>
  )
}

export function AppHeader() {
  const { ready, user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const menuId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    resolveTheme(getThemePreference()),
  )
  const [leagues, setLeagues] = useState<LeagueRow[]>([])

  const refreshThemeIcon = useCallback(() => {
    setResolved(resolveTheme(getThemePreference()))
  }, [])

  useEffect(() => {
    refreshThemeIcon()
  }, [location.pathname, refreshThemeIcon])

  useEffect(() => {
    if (!menuOpen || !user) return
    let cancelled = false
    void listMyLeagues()
      .then((rows) => {
        if (!cancelled) setLeagues(rows)
      })
      .catch(() => {
        if (!cancelled) setLeagues([])
      })
    return () => {
      cancelled = true
    }
  }, [menuOpen, user])

  useEffect(() => {
    if (!menuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  function onToggleTheme() {
    const next = toggleLightDark()
    setResolved(next)
  }

  async function onSignOut() {
    setMenuOpen(false)
    await signOut()
    navigate('/')
  }

  const showMenu = ready && Boolean(user)

  return (
    <>
      <header className="app-header">
        <div className="app-header-left">
          {showMenu ? (
            <button
              type="button"
              className="icon-btn"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MenuIcon open={menuOpen} />
            </button>
          ) : (
            <span className="icon-btn-spacer" aria-hidden />
          )}
          <Link className="app-header-brand" to="/">
            BallKnowlAIge
          </Link>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={
            resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
          }
          title={resolved === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          <ThemeIcon mode={resolved} />
        </button>
      </header>

      {menuOpen && showMenu && (
        <div
          className="app-menu-backdrop"
          role="presentation"
          onClick={() => setMenuOpen(false)}
        >
          <nav
            id={menuId}
            className="app-menu panel"
            aria-label="App menu"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="muted app-menu-email">{user?.email}</p>

            <p className="app-menu-heading">Leagues</p>
            {leagues.length === 0 ? (
              <p className="muted">No leagues yet.</p>
            ) : (
              <ul className="app-menu-list">
                {leagues.map((league) => (
                  <li key={league.id}>
                    <Link
                      to={`/league/${league.id}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      {league.name}
                      <span className="pill">{league.my_role}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="app-menu-actions">
              <Link
                className="cta enabled"
                to="/"
                onClick={() => setMenuOpen(false)}
              >
                All leagues
              </Link>
              <button
                type="button"
                className="danger"
                onClick={() => void onSignOut()}
              >
                Sign out
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
