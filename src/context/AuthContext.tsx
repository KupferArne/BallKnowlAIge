import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { authEmailRedirectTo } from '../lib/appUrl'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { ensureProfile } from '../lib/leagues'
import type { Profile } from '../lib/types'

type AuthState = {
  ready: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  configured: boolean
  signInWithMagicLink: (email: string) => Promise<void>
  updateDisplayName: (name: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const refreshProfile = useCallback(async () => {
    if (!supabase || !session) {
      setProfile(null)
      return
    }
    try {
      const p = await ensureProfile()
      setProfile(p)
    } catch {
      setProfile(null)
    }
  }, [session])

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }

    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    void refreshProfile()
  }, [ready, session?.user?.id, refreshProfile])

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Supabase is not configured')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: authEmailRedirectTo() },
    })
    if (error) throw error
  }, [])

  const updateDisplayName = useCallback(async (name: string) => {
    const p = await ensureProfile(name)
    setProfile(p)
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      profile,
      configured: isSupabaseConfigured,
      signInWithMagicLink,
      updateDisplayName,
      signOut,
      refreshProfile,
    }),
    [
      ready,
      session,
      profile,
      signInWithMagicLink,
      updateDisplayName,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
