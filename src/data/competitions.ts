export type CompetitionCategory =
  | 'national'
  | 'club_europe'
  | 'club_germany'
  | 'club_americas'
  | 'other'

/** How the season field is typically filled for this competition. */
export type SeasonHint = 'year' | 'season'

export type Competition = {
  id: string
  name: string
  category: CompetitionCategory
  seasonHint?: SeasonHint
  /** Suggested default for new tournaments (UI only). */
  defaultSeason?: string
}

export const COMPETITION_CATEGORIES: {
  id: CompetitionCategory
  label: string
}[] = [
  { id: 'national', label: 'National teams' },
  { id: 'club_germany', label: 'Germany' },
  { id: 'club_europe', label: 'Europe (club)' },
  { id: 'club_americas', label: 'Americas & other' },
  { id: 'other', label: 'Other' },
]

/** Curated v1 catalog — stable ids for sync later. */
export const COMPETITIONS: Competition[] = [
  // National
  {
    id: 'fifa-wc-men',
    name: 'FIFA World Cup (Men)',
    category: 'national',
    seasonHint: 'year',
    defaultSeason: '2026',
  },
  {
    id: 'fifa-wc-women',
    name: 'FIFA World Cup (Women)',
    category: 'national',
    seasonHint: 'year',
    defaultSeason: '2027',
  },
  {
    id: 'uefa-euro-men',
    name: 'UEFA European Championship (Men)',
    category: 'national',
    seasonHint: 'year',
    defaultSeason: '2028',
  },
  {
    id: 'uefa-euro-women',
    name: 'UEFA European Championship (Women)',
    category: 'national',
    seasonHint: 'year',
  },
  {
    id: 'copa-america',
    name: 'Copa América',
    category: 'national',
    seasonHint: 'year',
  },
  {
    id: 'afcon',
    name: 'Africa Cup of Nations (AFCON)',
    category: 'national',
    seasonHint: 'year',
  },
  {
    id: 'afc-asian-cup',
    name: 'AFC Asian Cup',
    category: 'national',
    seasonHint: 'year',
  },
  {
    id: 'concacaf-gold-cup',
    name: 'CONCACAF Gold Cup',
    category: 'national',
    seasonHint: 'year',
  },
  {
    id: 'uefa-nations-league',
    name: 'UEFA Nations League',
    category: 'national',
    seasonHint: 'season',
    defaultSeason: '2026/27',
  },
  {
    id: 'uefa-wc-qualifiers',
    name: 'UEFA World Cup Qualifiers',
    category: 'national',
    seasonHint: 'season',
  },
  {
    id: 'conmebol-wc-qualifiers',
    name: 'CONMEBOL World Cup Qualifiers',
    category: 'national',
    seasonHint: 'season',
  },
  {
    id: 'olympics-men',
    name: 'Olympic Football (Men)',
    category: 'national',
    seasonHint: 'year',
  },
  {
    id: 'olympics-women',
    name: 'Olympic Football (Women)',
    category: 'national',
    seasonHint: 'year',
  },
  {
    id: 'fifa-confederations',
    name: 'FIFA Confederations Cup',
    category: 'national',
    seasonHint: 'year',
  },

  // Germany
  {
    id: 'bundesliga-men',
    name: 'Bundesliga (Herren)',
    category: 'club_germany',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'bundesliga-2',
    name: '2. Bundesliga',
    category: 'club_germany',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: '3-liga',
    name: '3. Liga',
    category: 'club_germany',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'frauen-bundesliga',
    name: 'Frauen-Bundesliga',
    category: 'club_germany',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'dfb-pokal-men',
    name: 'DFB-Pokal (Herren)',
    category: 'club_germany',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'dfb-pokal-women',
    name: 'DFB-Pokal (Frauen)',
    category: 'club_germany',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'dfl-supercup',
    name: 'DFL-Supercup',
    category: 'club_germany',
    seasonHint: 'year',
    defaultSeason: '2025',
  },

  // Europe club
  {
    id: 'ucl',
    name: 'UEFA Champions League',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'uel',
    name: 'UEFA Europa League',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'uecl',
    name: 'UEFA Conference League',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'uefa-super-cup',
    name: 'UEFA Super Cup',
    category: 'club_europe',
    seasonHint: 'year',
  },
  {
    id: 'premier-league',
    name: 'Premier League',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'la-liga',
    name: 'La Liga',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'serie-a',
    name: 'Serie A',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'ligue-1',
    name: 'Ligue 1',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'eredivisie',
    name: 'Eredivisie',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'primeira-liga',
    name: 'Primeira Liga',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'scottish-premiership',
    name: 'Scottish Premiership',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'efl-championship',
    name: 'EFL Championship',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'fa-cup',
    name: 'FA Cup',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'efl-cup',
    name: 'EFL Cup',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'copa-del-rey',
    name: 'Copa del Rey',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'coppa-italia',
    name: 'Coppa Italia',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'coupe-de-france',
    name: 'Coupe de France',
    category: 'club_europe',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },

  // Americas & other
  {
    id: 'mls',
    name: 'Major League Soccer',
    category: 'club_americas',
    seasonHint: 'year',
    defaultSeason: '2026',
  },
  {
    id: 'liga-mx',
    name: 'Liga MX',
    category: 'club_americas',
    seasonHint: 'season',
  },
  {
    id: 'brasileirao',
    name: 'Brasileirão Série A',
    category: 'club_americas',
    seasonHint: 'year',
  },
  {
    id: 'argentina-primera',
    name: 'Argentine Primera División',
    category: 'club_americas',
    seasonHint: 'year',
  },
  {
    id: 'copa-libertadores',
    name: 'Copa Libertadores',
    category: 'club_americas',
    seasonHint: 'year',
  },
  {
    id: 'copa-sudamericana',
    name: 'Copa Sudamericana',
    category: 'club_americas',
    seasonHint: 'year',
  },
  {
    id: 'saudi-pro-league',
    name: 'Saudi Pro League',
    category: 'club_americas',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },
  {
    id: 'a-league',
    name: 'A-League Men',
    category: 'club_americas',
    seasonHint: 'season',
    defaultSeason: '2025/26',
  },

  // Other
  {
    id: 'friendly',
    name: 'Friendly / invitational',
    category: 'other',
  },
  {
    id: 'demo-cup',
    name: 'Demo Cup',
    category: 'other',
  },
  {
    id: 'custom',
    name: 'Custom competition',
    category: 'other',
  },
]

export function getCompetition(id: string): Competition | undefined {
  return COMPETITIONS.find((c) => c.id === id)
}

export function formatTournamentTitle(
  competitionName: string,
  season?: string | null,
): string {
  const s = season?.trim()
  return s ? `${competitionName} · ${s}` : competitionName
}

export function searchCompetitions(query: string): Competition[] {
  const q = query.trim().toLowerCase()
  if (!q) return COMPETITIONS
  return COMPETITIONS.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.id.includes(q) ||
      c.category.replace('_', ' ').includes(q),
  )
}
