import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Warns when Epic-1 migration has not been applied yet. */
export function DbSetupBanner() {
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .then(({ error }) => {
        if (cancelled) return
        const msg = error?.message ?? ''
        setMissing(
          Boolean(
            error &&
              (msg.includes("Could not find the table") ||
                msg.includes('schema cache') ||
                error.code === 'PGRST205'),
          ),
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!missing) return null

  return (
    <div className="panel warn-panel">
      <h2>Database setup required</h2>
      <p>
        Tables are missing in Supabase. Open the SQL Editor and run the full
        contents of{' '}
        <a
          href="https://github.com/KupferArne/BallKnowlAIge/blob/main/supabase/migrations/00002_multi_tenant_core.sql"
          target="_blank"
          rel="noreferrer"
        >
          00002_multi_tenant_core.sql
        </a>
        , then reload this page.
      </p>
      <ol className="setup-steps">
        <li>Supabase Dashboard → SQL → New query</li>
        <li>Paste the migration file → Run</li>
        <li>Reload the app and try again</li>
      </ol>
    </div>
  )
}
