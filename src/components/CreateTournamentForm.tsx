import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  COMPETITION_CATEGORIES,
  COMPETITIONS,
  getCompetition,
  searchCompetitions,
  type Competition,
} from '../data/competitions'

export type TournamentFormDefaults = {
  competitionId?: string | null
  competitionName?: string | null
  season?: string | null
  seedDemo?: boolean
}

export function CreateTournamentForm({
  busy,
  submitLabel = 'Create tournament',
  defaults,
  onSubmit,
}: {
  busy?: boolean
  submitLabel?: string
  /** Prefill from the league’s current tournament (e.g. re-seed form). */
  defaults?: TournamentFormDefaults
  onSubmit: (input: {
    competitionId: string
    competitionName: string
    season: string | null
    seedDemo: boolean
  }) => Promise<void>
}) {
  function resolveDefaults(d?: TournamentFormDefaults) {
    const rawId = d?.competitionId?.trim() || 'fifa-wc-men'
    const known = getCompetition(rawId)
    const id = known ? rawId : 'custom'
    return {
      competitionId: id,
      customName:
        id === 'custom'
          ? (d?.competitionName ?? rawId)
          : '',
      season: d?.season ?? known?.defaultSeason ?? '',
      seedDemo: d?.seedDemo ?? true,
    }
  }

  const initial = resolveDefaults(defaults)

  const [query, setQuery] = useState('')
  const [competitionId, setCompetitionId] = useState(initial.competitionId)
  const [customName, setCustomName] = useState(initial.customName)
  const [season, setSeason] = useState(initial.season)
  const [seedDemo, setSeedDemo] = useState(initial.seedDemo)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!defaults) return
    const next = resolveDefaults(defaults)
    setCompetitionId(next.competitionId)
    setCustomName(next.customName)
    setSeason(next.season)
    setSeedDemo(next.seedDemo)
  }, [
    defaults?.competitionId,
    defaults?.competitionName,
    defaults?.season,
    defaults?.seedDemo,
  ])

  const selected = useMemo(
    () => getCompetition(competitionId),
    [competitionId],
  )

  const filtered = useMemo(() => searchCompetitions(query), [query])

  const grouped = useMemo(() => {
    const byCat = new Map<string, Competition[]>()
    for (const c of filtered) {
      const list = byCat.get(c.category) ?? []
      list.push(c)
      byCat.set(c.category, list)
    }
    return COMPETITION_CATEGORIES.map((cat) => ({
      ...cat,
      items: byCat.get(cat.id) ?? [],
    })).filter((g) => g.items.length > 0)
  }, [filtered])

  function pick(c: Competition) {
    setCompetitionId(c.id)
    if (c.defaultSeason) setSeason(c.defaultSeason)
    else if (c.id !== 'custom') setSeason('')
    if (c.id !== 'custom') setCustomName('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const comp = getCompetition(competitionId) ?? COMPETITIONS[0]
    const competitionName =
      comp.id === 'custom' ? customName.trim() : comp.name
    if (!competitionName) {
      setError('Enter a name for the custom competition.')
      return
    }
    try {
      await onSubmit({
        competitionId: comp.id,
        competitionName,
        season: season.trim() || null,
        seedDemo,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create tournament')
    }
  }

  const currentLabel =
    selected?.id === 'custom'
      ? customName || 'Custom'
      : selected?.name ?? competitionId

  return (
    <form className="stack" onSubmit={(e) => void handleSubmit(e)}>
      {defaults && (
        <p className="muted">
          Current:{' '}
          <strong>
            {currentLabel}
            {season ? ` · ${season}` : ''}
          </strong>
        </p>
      )}

      <label className="field">
        <span>Search competitions</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="World Cup, Bundesliga, Champions League…"
          autoComplete="off"
        />
      </label>

      <div className="competition-picker" role="listbox" aria-label="Competitions">
        {grouped.length === 0 ? (
          <p className="muted">No competitions match.</p>
        ) : (
          grouped.map((group) => (
            <div key={group.id} className="competition-group">
              <div className="competition-group-label">{group.label}</div>
              <div className="choice-grid">
                {group.items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={competitionId === c.id}
                    className={
                      competitionId === c.id
                        ? 'tab active choice-btn'
                        : 'tab choice-btn'
                    }
                    onClick={() => pick(c)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {selected?.id === 'custom' && (
        <label className="field">
          <span>Custom name</span>
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            required
            maxLength={80}
            placeholder="Office Cup 2026"
          />
        </label>
      )}

      <label className="field">
        <span>
          Season / edition
          {selected?.seasonHint === 'year'
            ? ' (year, e.g. 2026)'
            : selected?.seasonHint === 'season'
              ? ' (e.g. 2025/26)'
              : ' (optional)'}
        </span>
        <input
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          maxLength={20}
          placeholder={
            selected?.seasonHint === 'year' ? '2026' : '2025/26'
          }
        />
      </label>

      <label className="check-row">
        <input
          type="checkbox"
          checked={seedDemo}
          onChange={(e) => setSeedDemo(e.target.checked)}
        />
        <span>
          Fill with demo fixtures (sample matches to tip immediately)
        </span>
      </label>

      <button className="cta enabled" type="submit" disabled={busy}>
        {busy ? 'Working…' : submitLabel}
      </button>
      {error && <p className="warn-text">{error}</p>}
    </form>
  )
}
