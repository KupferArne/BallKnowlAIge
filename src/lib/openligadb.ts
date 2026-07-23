import type { SyncedFixture } from './openfootball'

type OldbTeam = {
  teamId?: number
  teamName?: string
  shortName?: string
  teamIconUrl?: string | null
}

type OldbResult = {
  resultName?: string
  resultTypeID?: number
  resultOrderID?: number
  pointsTeam1?: number
  pointsTeam2?: number
}

type OldbMatch = {
  matchID: number
  matchDateTimeUTC?: string
  matchIsFinished?: boolean
  team1?: OldbTeam
  team2?: OldbTeam
  matchResults?: OldbResult[]
}

function finalScore(match: OldbMatch): { home: number; away: number } | null {
  if (!match.matchIsFinished) return null
  const results = [...(match.matchResults ?? [])]
  if (results.length === 0) return null
  const end =
    results.find(
      (r) =>
        r.resultName === 'Endergebnis' ||
        r.resultTypeID === 2 ||
        r.resultTypeID === 5,
    ) ?? results.sort((a, b) => (b.resultOrderID ?? 0) - (a.resultOrderID ?? 0))[0]
  if (
    end?.pointsTeam1 == null ||
    end?.pointsTeam2 == null ||
    !Number.isFinite(end.pointsTeam1) ||
    !Number.isFinite(end.pointsTeam2)
  ) {
    return null
  }
  return { home: end.pointsTeam1, away: end.pointsTeam2 }
}

export function parseOpenLigaDbMatches(matches: OldbMatch[]): SyncedFixture[] {
  const out: SyncedFixture[] = []
  for (const m of matches) {
    const home = (m.team1?.teamName || m.team1?.shortName || '').trim()
    const away = (m.team2?.teamName || m.team2?.shortName || '').trim()
    if (!home || !away) continue

    const score = finalScore(m)
    const kickoff = m.matchDateTimeUTC ?? null
    let status: SyncedFixture['status'] = 'scheduled'
    if (score) status = 'finished'
    else if (kickoff && new Date(kickoff).getTime() <= Date.now()) status = 'live'

    out.push({
      external_id: `oldb-${m.matchID}`,
      home_team: home,
      away_team: away,
      kickoff_at: kickoff,
      home_goals: score?.home ?? null,
      away_goals: score?.away ?? null,
      status,
      home_crest_url: m.team1?.teamIconUrl || null,
      away_crest_url: m.team2?.teamIconUrl || null,
    })
  }
  return out
}

/** Free German football API — no key, CORS-friendly. */
export async function fetchOpenLigaDb(
  shortcut: string,
  seasonYear: number,
): Promise<SyncedFixture[]> {
  const url = `https://api.openligadb.de/getmatchdata/${encodeURIComponent(shortcut)}/${seasonYear}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`OpenLigaDB failed (${res.status}) for ${shortcut}/${seasonYear}`)
  }
  const data = (await res.json()) as OldbMatch[]
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      `OpenLigaDB returned no matches for ${shortcut}/${seasonYear}. Check the season (e.g. 2025 for 2025/26).`,
    )
  }
  return parseOpenLigaDbMatches(data)
}
