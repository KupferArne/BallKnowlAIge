export type SyncProvider = 'openfootball' | 'football-data'

export type SyncSource = {
  provider: SyncProvider
  /** football-data.org competition code, or openfootball edition key */
  code: string
  /** Human label for UI */
  label: string
  /** openfootball JSON URL template; `{season}` replaced */
  openfootballUrl?: string
}

/**
 * Maps our competition_id → free data sources.
 * football-data.org free tier codes: https://www.football-data.org/documentation/api
 */
export const COMPETITION_SYNC_SOURCES: Record<string, SyncSource[]> = {
  'fifa-wc-men': [
    {
      provider: 'openfootball',
      code: 'worldcup',
      label: 'openfootball World Cup JSON',
      openfootballUrl:
        'https://raw.githubusercontent.com/openfootball/worldcup.json/master/{season}/worldcup.json',
    },
    {
      provider: 'football-data',
      code: 'WC',
      label: 'football-data.org World Cup',
    },
  ],
  'uefa-euro-men': [
    { provider: 'football-data', code: 'EC', label: 'football-data.org European Championship' },
  ],
  'bundesliga-men': [
    { provider: 'football-data', code: 'BL1', label: 'football-data.org Bundesliga' },
  ],
  'bundesliga-2': [
    { provider: 'football-data', code: 'BL2', label: 'football-data.org 2. Bundesliga' },
  ],
  ucl: [
    { provider: 'football-data', code: 'CL', label: 'football-data.org Champions League' },
  ],
  'premier-league': [
    { provider: 'football-data', code: 'PL', label: 'football-data.org Premier League' },
  ],
  'la-liga': [
    { provider: 'football-data', code: 'PD', label: 'football-data.org La Liga' },
  ],
  'serie-a': [
    { provider: 'football-data', code: 'SA', label: 'football-data.org Serie A' },
  ],
  'ligue-1': [
    { provider: 'football-data', code: 'FL1', label: 'football-data.org Ligue 1' },
  ],
  eredivisie: [
    { provider: 'football-data', code: 'DED', label: 'football-data.org Eredivisie' },
  ],
  'primeira-liga': [
    { provider: 'football-data', code: 'PPL', label: 'football-data.org Primeira Liga' },
  ],
  'efl-championship': [
    { provider: 'football-data', code: 'ELC', label: 'football-data.org Championship' },
  ],
  brasileirao: [
    { provider: 'football-data', code: 'BSA', label: 'football-data.org Brasileirão' },
  ],
}

export function syncSourcesFor(competitionId: string | null | undefined): SyncSource[] {
  if (!competitionId) return []
  return COMPETITION_SYNC_SOURCES[competitionId] ?? []
}

export function canSyncCompetition(competitionId: string | null | undefined): boolean {
  return syncSourcesFor(competitionId).length > 0
}

/** Prefer client-safe openfootball when present; else football-data via Edge Function. */
export function preferredSyncSource(
  competitionId: string | null | undefined,
): SyncSource | null {
  const sources = syncSourcesFor(competitionId)
  return (
    sources.find((s) => s.provider === 'openfootball') ??
    sources.find((s) => s.provider === 'football-data') ??
    null
  )
}

export function footballDataSeason(season: string | null | undefined): number | null {
  if (!season) return null
  const m = season.trim().match(/^(\d{4})/)
  return m ? Number(m[1]) : null
}
