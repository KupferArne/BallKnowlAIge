import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listMyLeagues } from '../lib/leagues'
import {
  getThemePreference,
  resolveTheme,
  toggleLightDark,
} from '../lib/theme'
import type { LeagueRow } from '../lib/types'
import { IconClose, IconMenu, IconMoon, IconSun } from './icons'

export function AppHeader() {
  const { ready, user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const menuId = useId()
  const menuRef = useRef<HTMLDivElement>(null)
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
    function onPointer(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  function onToggleTheme() {
    setResolved(toggleLightDark())
  }

  async function onSignOut() {
    setMenuOpen(false)
    await signOut()
    navigate('/')
  }

  const showMenu = ready && Boolean(user)
  const activeLeagueId = location.pathname.startsWith('/league/')
    ? location.pathname.split('/')[2]
    : null

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="topbar-brand" to="/">
          BallKnowlAIge
        </Link>

        <div className="topbar-actions" ref={menuRef}>
          <button
            type="button"
            className="ghost-btn"
            onClick={onToggleTheme}
            aria-label={
              resolved === 'dark'
                ? 'Switch to light mode'
                : 'Switch to dark mode'
            }
            title={resolved === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {resolved === 'dark' ? <IconSun /> : <IconMoon />}
          </button>

          {showMenu ? (
            <>
              <button
                type="button"
                className="ghost-btn"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? <IconClose /> : <IconMenu />}
              </button>

              {menuOpen && (
                <div id={menuId} className="account-menu" role="menu">
                  <div className="account-menu-head">
                    <p className="account-menu-label">Signed in</p>
                    <p className="account-menu-email">{user?.email}</p>
                  </div>

                  <p className="account-menu-label">Your leagues</p>
                  {leagues.length === 0 ? (
                    <p className="muted account-menu-empty">No leagues yet.</p>
                  ) : (
                    <ul className="account-menu-list">
                      {leagues.map((league) => (
                        <li key={league.id}>
                          <Link
                            to={`/league/${league.id}`}
                            role="menuitem"
                            className={
                              league.id === activeLeagueId
                                ? 'is-active'
                                : undefined
                            }
                            onClick={() => setMenuOpen(false)}
                          >
                            <span>{league.name}</span>
                            <span className="pill">{league.my_role}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="account-menu-foot">
                    <Link
                      to="/"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      Manage leagues
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="account-menu-danger"
                      onClick={() => void onSignOut()}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            ready && (
              <Link className="ghost-btn ghost-btn-text" to="/login">
                Sign in
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  )
}
