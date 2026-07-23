// Epic 10: sync fixtures via football-data.org (API token server-side only).
// openfootball is handled client-side (no key). Deploy:
//   supabase functions deploy sync-fixtures --project-ref mahevkixlrxdoxtbopoj
// Secrets:
//   FOOTBALL_DATA_API_TOKEN  (from https://www.football-data.org/client/register)
//   SUPABASE_SERVICE_ROLE_KEY (auto in hosted functions)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const FD_BASE = 'https://api.football-data.org/v4'

const COMPETITION_CODES: Record<string, string> = {
  'fifa-wc-men': 'WC',
  'uefa-euro-men': 'EC',
  'bundesliga-men': 'BL1',
  'bundesliga-2': 'BL2',
  ucl: 'CL',
  'premier-league': 'PL',
  'la-liga': 'PD',
  'serie-a': 'SA',
  'ligue-1': 'FL1',
  eredivisie: 'DED',
  'primeira-liga': 'PPL',
  'efl-championship': 'ELC',
  brasileirao: 'BSA',
}

type FdMatch = {
  id: number
  utcDate: string
  status: string
  homeTeam?: { name?: string; shortName?: string; crest?: string }
  awayTeam?: { name?: string; shortName?: string; crest?: string }
  score?: {
    fullTime?: { home?: number | null; away?: number | null }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const fdToken = Deno.env.get('FOOTBALL_DATA_API_TOKEN')

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const leagueId = String(body.leagueId ?? '')
    if (!leagueId) return json({ error: 'leagueId required' }, 400)

    const admin = createClient(supabaseUrl, service)
    const { data: league, error: leagueErr } = await admin
      .from('leagues')
      .select('id, owner_id')
      .eq('id', leagueId)
      .maybeSingle()
    if (leagueErr || !league) return json({ error: 'League not found' }, 404)
    if (league.owner_id !== user.id) {
      return json({ error: 'Only the owner can sync' }, 403)
    }

    const { data: tourney, error: tErr } = await admin
      .from('tournaments')
      .select('id, competition_id, season')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (tErr || !tourney) {
      return json({ error: 'Create a tournament first' }, 400)
    }

    const code = COMPETITION_CODES[String(tourney.competition_id ?? '')]
    if (!code) {
      return json(
        {
          error:
            'No football-data.org mapping for this competition. Use openfootball (WC) or pick a mapped league.',
        },
        400,
      )
    }
    if (!fdToken) {
      return json(
        {
          error:
            'FOOTBALL_DATA_API_TOKEN not set on the Edge Function. Register free at football-data.org and set the secret.',
        },
        503,
      )
    }

    const season =
      body.season ??
      (tourney.season ? Number(String(tourney.season).slice(0, 4)) : undefined)
    const qs = new URLSearchParams()
    if (season && Number.isFinite(season)) qs.set('season', String(season))

    const url = `${FD_BASE}/competitions/${code}/matches${qs.size ? `?${qs}` : ''}`
    const fdRes = await fetch(url, {
      headers: { 'X-Auth-Token': fdToken },
    })
    if (!fdRes.ok) {
      const text = await fdRes.text()
      return json(
        { error: `football-data.org ${fdRes.status}: ${text.slice(0, 200)}` },
        502,
      )
    }

    const payload = await fdRes.json()
    const matches = (payload.matches ?? []) as FdMatch[]
    const fixtures = matches.map((m) => mapFdMatch(m)).filter(Boolean)

    // Call RPC as the user so apply_fixture_sync owner check passes
    const { data, error } = await userClient.rpc('apply_fixture_sync', {
      p_league_id: leagueId,
      p_matches: fixtures,
      p_sync_source: `football-data:${code}`,
    })
    if (error) return json({ error: error.message }, 400)

    return json({
      upserted: data?.upserted ?? fixtures.length,
      source: `football-data:${code}`,
      tournament_id: tourney.id,
    })
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Sync failed' },
      500,
    )
  }
})

function mapFdMatch(m: FdMatch) {
  const home = m.homeTeam?.name || m.homeTeam?.shortName
  const away = m.awayTeam?.name || m.awayTeam?.shortName
  if (!home || !away) return null

  const ftHome = m.score?.fullTime?.home
  const ftAway = m.score?.fullTime?.away
  const finished =
    m.status === 'FINISHED' ||
    (ftHome != null && ftAway != null)

  let status: 'scheduled' | 'live' | 'finished' = 'scheduled'
  if (finished) status = 'finished'
  else if (
    m.status === 'IN_PLAY' ||
    m.status === 'PAUSED' ||
    m.status === 'LIVE'
  ) {
    status = 'live'
  }

  return {
    external_id: `fd-${m.id}`,
    home_team: home,
    away_team: away,
    kickoff_at: m.utcDate ?? null,
    home_goals: finished && ftHome != null ? ftHome : null,
    away_goals: finished && ftAway != null ? ftAway : null,
    status,
    home_crest_url: m.homeTeam?.crest ?? null,
    away_crest_url: m.awayTeam?.crest ?? null,
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
