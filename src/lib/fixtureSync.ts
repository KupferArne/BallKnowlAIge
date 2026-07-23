import { asError } from './errors'
import { fetchOpenfootballWorldCup, type SyncedFixture } from './openfootball'
import { fetchOpenLigaDb } from './openligadb'
import {
  footballDataSeason,
  preferredSyncSource,
  syncSourcesFor,
} from './syncSources'
import { supabase } from './supabase'

export type ApplySyncResult = {
  upserted: number
  source: string
  tournament_id: string
}

export async function applyFixtureSync(
  leagueId: string,
  fixtures: SyncedFixture[],
  syncSource: string,
): Promise<ApplySyncResult> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.rpc('apply_fixture_sync', {
    p_league_id: leagueId,
    p_matches: fixtures,
    p_sync_source: syncSource,
  })
  if (error) throw asError(error)
  return data as ApplySyncResult
}

/** Client-safe sync (no API key): openfootball for supported comps. */
export async function syncViaOpenfootball(input: {
  leagueId: string
  competitionId: string
  season: string | null
}): Promise<ApplySyncResult> {
  const source = syncSourcesFor(input.competitionId).find(
    (s) => s.provider === 'openfootball',
  )
  if (!source?.openfootballUrl) {
    throw new Error('No openfootball source for this competition')
  }
  const season = input.season?.trim() || '2026'
  const fixtures = await fetchOpenfootballWorldCup(season, source.openfootballUrl)
  if (fixtures.length === 0) {
    throw new Error('openfootball returned no matches')
  }
  return applyFixtureSync(input.leagueId, fixtures, `openfootball:${source.code}`)
}

/** Client-safe sync for German leagues via OpenLigaDB (no key, no Edge Function). */
export async function syncViaOpenLigaDb(input: {
  leagueId: string
  competitionId: string
  season: string | null
}): Promise<ApplySyncResult> {
  const source = syncSourcesFor(input.competitionId).find(
    (s) => s.provider === 'openligadb',
  )
  if (!source) {
    throw new Error('No OpenLigaDB source for this competition')
  }
  const year =
    footballDataSeason(input.season) ??
    // Default to current European season start year
    (new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1)

  const fixtures = await fetchOpenLigaDb(source.code, year)
  return applyFixtureSync(input.leagueId, fixtures, `openligadb:${source.code}:${year}`)
}

/**
 * Prefer keyless client sync; football-data.org only via Edge Function (optional).
 */
export async function syncTournamentFixtures(input: {
  leagueId: string
  competitionId: string | null
  season: string | null
}): Promise<ApplySyncResult & { via: string }> {
  if (!supabase) throw new Error('Supabase is not configured')
  if (!input.competitionId) throw new Error('Tournament has no competition')

  const preferred = preferredSyncSource(input.competitionId)
  if (!preferred) {
    throw new Error('This competition has no free sync source yet')
  }

  if (preferred.provider === 'openfootball') {
    const result = await syncViaOpenfootball({
      leagueId: input.leagueId,
      competitionId: input.competitionId,
      season: input.season,
    })
    return { ...result, via: 'openfootball' }
  }

  if (preferred.provider === 'openligadb') {
    const result = await syncViaOpenLigaDb({
      leagueId: input.leagueId,
      competitionId: input.competitionId,
      season: input.season,
    })
    return { ...result, via: 'openligadb' }
  }

  const { data, error } = await supabase.functions.invoke('sync-fixtures', {
    body: {
      leagueId: input.leagueId,
      provider: 'football-data',
      season: footballDataSeason(input.season),
    },
  })
  if (error) {
    const msg = error.message || 'Edge Function request failed'
    throw new Error(
      `${msg}. For Bundesliga use OpenLigaDB (set season like 2025/26). ` +
        'football-data.org needs a deployed Edge Function + FOOTBALL_DATA_API_TOKEN — see docs/SECRETS.md.',
    )
  }
  if (data?.error) throw new Error(String(data.error))
  return {
    upserted: Number(data?.upserted ?? 0),
    source: String(data?.source ?? 'football-data'),
    tournament_id: String(data?.tournament_id ?? ''),
    via: 'edge:football-data',
  }
}
