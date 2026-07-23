import './App.css'
import { isSupabaseConfigured } from './lib/supabase'

function App() {
  return (
    <div className="app">
      <header className="hero">
        <p className="brand">BallKnowlAIge</p>
        <h1>Tip leagues for any tournament</h1>
        <p className="lede">
          Create a league, invite colleagues with a share link, tip exact scores —
          optional AI players coming later.
        </p>
        <div className="cta-row">
          <button type="button" className="cta" disabled title="Epic 1–2 next">
            Create league (soon)
          </button>
          <a className="link" href="https://github.com/KupferArne/BallKnowlAIge/blob/main/BACKLOG.md">
            View backlog
          </a>
        </div>
      </header>

      <section className="status" aria-label="Setup status">
        <h2>Scaffold status</h2>
        <ul>
          <li>PWA shell: ready</li>
          <li>
            Supabase env:{' '}
            {isSupabaseConfigured ? (
              <span className="ok">configured</span>
            ) : (
              <span className="warn">missing — copy .env.example → .env.local</span>
            )}
          </li>
          <li>Auth / invites / scoring: backlog Epics 1–4</li>
        </ul>
      </section>
    </div>
  )
}

export default App
