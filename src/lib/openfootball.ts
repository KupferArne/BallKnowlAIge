export type SyncedFixture = {
  external_id: string
  home_team: string
  away_team: string
  kickoff_at: string | null
  home_goals: number | null
  away_goals: number | null
  status: 'scheduled' | 'live' | 'finished'
}

type OfMatch = {
  num?: number
  round?: string
  date?: string
  time?: string
  team1?: string
  team2?: string
  group?: string
  score?: { ft?: number[] | null }
}

/** Parse openfootball worldcup.json (and similar) into sync rows. */
export function parseOpenfootballWorldCup(
  data: { matches?: OfMatch[] },
  season: string,
): SyncedFixture[] {
  const matches = Array.isArray(data.matches) ? data.matches : []
  const out: SyncedFixture[] = []

  matches.forEach((m, index) => {
    const home = (m.team1 ?? '').trim()
    const away = (m.team2 ?? '').trim()
    if (!home || !away) return

    const externalId =
      m.num != null
        ? `of-wc-${season}-n${m.num}`
        : `of-wc-${season}-${m.date ?? 'nodate'}-${m.round ?? 'r'}-${home}-${away}-${index}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 120)

    const kickoff = parseOpenfootballKickoff(m.date, m.time)
    const ft = m.score?.ft
    const hasFt =
      Array.isArray(ft) &&
      ft.length >= 2 &&
      Number.isFinite(ft[0]) &&
      Number.isFinite(ft[1])

    let status: SyncedFixture['status'] = 'scheduled'
    if (hasFt) status = 'finished'
    else if (kickoff && new Date(kickoff).getTime() <= Date.now()) status = 'live'

    out.push({
      external_id: externalId,
      home_team: home,
      away_team: away,
      kickoff_at: kickoff,
      home_goals: hasFt ? Number(ft![0]) : null,
      away_goals: hasFt ? Number(ft![1]) : null,
      status,
    })
  })

  return out
}

function parseOpenfootballKickoff(
  date?: string,
  time?: string,
): string | null {
  if (!date) return null
  // Examples: "13:00 UTC-6", "20:00", "16:00 UTC+2"
  const raw = (time ?? '12:00').trim()
  const hm = raw.match(/(\d{1,2}):(\d{2})/)
  if (!hm) return `${date}T12:00:00.000Z`

  const hour = Number(hm[1])
  const minute = Number(hm[2])
  const tz = raw.match(/UTC\s*([+-]\d{1,2})?/i)
  const offsetH = tz?.[1] != null && tz[1] !== '' ? Number(tz[1]) : 0
  const utcMs = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    hour - offsetH,
    minute,
  )
  return new Date(utcMs).toISOString()
}

export async function fetchOpenfootballWorldCup(
  season: string,
  urlTemplate: string,
): Promise<SyncedFixture[]> {
  const url = urlTemplate.replace('{season}', season || '2026')
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`openfootball fetch failed (${res.status}) for ${url}`)
  }
  const data = (await res.json()) as { matches?: OfMatch[] }
  return parseOpenfootballWorldCup(data, season || '2026')
}
