/** ISO 3166-1 alpha-2 for flagcdn.com — football display names. */
const COUNTRY_ISO: Record<string, string> = {
  afghanistan: 'af',
  albania: 'al',
  algeria: 'dz',
  andorra: 'ad',
  angola: 'ao',
  argentina: 'ar',
  armenia: 'am',
  australia: 'au',
  austria: 'at',
  azerbaijan: 'az',
  bahrain: 'bh',
  bangladesh: 'bd',
  belarus: 'by',
  belgium: 'be',
  belize: 'bz',
  benin: 'bj',
  bolivia: 'bo',
  'bosnia and herzegovina': 'ba',
  bosnia: 'ba',
  botswana: 'bw',
  brazil: 'br',
  bulgaria: 'bg',
  'burkina faso': 'bf',
  burundi: 'bi',
  cameroon: 'cm',
  canada: 'ca',
  'cape verde': 'cv',
  'cabo verde': 'cv',
  chile: 'cl',
  china: 'cn',
  'china pr': 'cn',
  colombia: 'co',
  congo: 'cg',
  'congo dr': 'cd',
  'dr congo': 'cd',
  'democratic republic of the congo': 'cd',
  'costa rica': 'cr',
  croatia: 'hr',
  cuba: 'cu',
  cyprus: 'cy',
  'czech republic': 'cz',
  czechia: 'cz',
  denmark: 'dk',
  ecuador: 'ec',
  egypt: 'eg',
  england: 'gb-eng',
  'equatorial guinea': 'gq',
  estonia: 'ee',
  eswatini: 'sz',
  ethiopia: 'et',
  'faroe islands': 'fo',
  fiji: 'fj',
  finland: 'fi',
  france: 'fr',
  gabon: 'ga',
  gambia: 'gm',
  georgia: 'ge',
  germany: 'de',
  ghana: 'gh',
  gibraltar: 'gi',
  greece: 'gr',
  grenada: 'gd',
  guatemala: 'gt',
  guinea: 'gn',
  'guinea-bissau': 'gw',
  guyana: 'gy',
  haiti: 'ht',
  honduras: 'hn',
  hungary: 'hu',
  iceland: 'is',
  india: 'in',
  indonesia: 'id',
  iran: 'ir',
  'ir iran': 'ir',
  iraq: 'iq',
  ireland: 'ie',
  'republic of ireland': 'ie',
  israel: 'il',
  italy: 'it',
  'ivory coast': 'ci',
  "côte d'ivoire": 'ci',
  "cote d'ivoire": 'ci',
  jamaica: 'jm',
  japan: 'jp',
  jordan: 'jo',
  kazakhstan: 'kz',
  kenya: 'ke',
  kosovo: 'xk',
  kuwait: 'kw',
  kyrgyzstan: 'kg',
  latvia: 'lv',
  lebanon: 'lb',
  lesotho: 'ls',
  liberia: 'lr',
  libya: 'ly',
  liechtenstein: 'li',
  lithuania: 'lt',
  luxembourg: 'lu',
  madagascar: 'mg',
  malawi: 'mw',
  malaysia: 'my',
  maldives: 'mv',
  mali: 'ml',
  malta: 'mt',
  mauritania: 'mr',
  mauritius: 'mu',
  mexico: 'mx',
  moldova: 'md',
  mongolia: 'mn',
  montenegro: 'me',
  morocco: 'ma',
  mozambique: 'mz',
  myanmar: 'mm',
  namibia: 'na',
  nepal: 'np',
  netherlands: 'nl',
  'new zealand': 'nz',
  nicaragua: 'ni',
  niger: 'ne',
  nigeria: 'ng',
  'north korea': 'kp',
  'korea dpr': 'kp',
  'north macedonia': 'mk',
  macedonia: 'mk',
  'northern ireland': 'gb-nir',
  norway: 'no',
  oman: 'om',
  pakistan: 'pk',
  palestine: 'ps',
  panama: 'pa',
  paraguay: 'py',
  peru: 'pe',
  philippines: 'ph',
  poland: 'pl',
  portugal: 'pt',
  qatar: 'qa',
  romania: 'ro',
  russia: 'ru',
  rwanda: 'rw',
  'saudi arabia': 'sa',
  scotland: 'gb-sct',
  senegal: 'sn',
  serbia: 'rs',
  seychelles: 'sc',
  'sierra leone': 'sl',
  singapore: 'sg',
  slovakia: 'sk',
  slovenia: 'si',
  somalia: 'so',
  'south africa': 'za',
  'south korea': 'kr',
  'korea republic': 'kr',
  spain: 'es',
  'sri lanka': 'lk',
  sudan: 'sd',
  suriname: 'sr',
  sweden: 'se',
  switzerland: 'ch',
  syria: 'sy',
  taiwan: 'tw',
  tajikistan: 'tj',
  tanzania: 'tz',
  thailand: 'th',
  togo: 'tg',
  'trinidad and tobago': 'tt',
  tunisia: 'tn',
  turkey: 'tr',
  türkiye: 'tr',
  turkmenistan: 'tm',
  uganda: 'ug',
  ukraine: 'ua',
  'united arab emirates': 'ae',
  uae: 'ae',
  'united states': 'us',
  usa: 'us',
  'united states of america': 'us',
  uruguay: 'uy',
  uzbekistan: 'uz',
  venezuela: 've',
  vietnam: 'vn',
  wales: 'gb-wls',
  yemen: 'ye',
  zambia: 'zm',
  zimbabwe: 'zw',
}

/**
 * Well-known club crest IDs on football-data.org CDN
 * (`https://crests.football-data.org/{id}.svg|png`).
 */
const CLUB_CREST_ID: Record<string, number> = {
  // Bundesliga / Germany
  'bayern munich': 5,
  'fc bayern münchen': 5,
  'fc bayern munchen': 5,
  'bayern münchen': 5,
  'borussia dortmund': 4,
  dortmund: 4,
  'bayer leverkusen': 3,
  leverkusen: 3,
  'rb leipzig': 721,
  'eintracht frankfurt': 19,
  'borussia mönchengladbach': 18,
  'borussia monchengladbach': 18,
  'vfb stuttgart': 10,
  'tsg hoffenheim': 2,
  'sc freiburg': 17,
  'vfl wolfsburg': 11,
  '1. fc union berlin': 28,
  'union berlin': 28,
  '1. fsv mainz 05': 15,
  'mainz 05': 15,
  'fc augsburg': 16,
  augsburg: 16,
  'werder bremen': 12,
  '1. fc heidenheim': 44,
  heidenheim: 44,
  'fc sankt pauli': 20,
  'st. pauli': 20,
  'holstein kiel': 720,
  'hamburger sv': 7,
  '1. fc köln': 1,
  '1. fc koln': 1,
  'fc schalke 04': 6,
  // Premier League sample
  arsenal: 57,
  chelsea: 61,
  liverpool: 64,
  'manchester city': 65,
  'manchester united': 66,
  tottenham: 73,
  'tottenham hotspur': 73,
  // La Liga / Serie A / Ligue 1 sample
  'real madrid': 86,
  barcelona: 81,
  'fc barcelona': 81,
  'atletico madrid': 78,
  'atlético madrid': 78,
  juventus: 109,
  inter: 108,
  'inter milan': 108,
  'ac milan': 98,
  milan: 98,
  napoli: 113,
  'paris saint-germain': 524,
  psg: 524,
  'olympique lyonnais': 523,
  lyon: 523,
  'olympique de marseille': 516,
  marseille: 516,
  ajax: 678,
  'afc ajax': 678,
  'benfica': 1903,
  'sl benfica': 1903,
  porto: 503,
  'fc porto': 503,
}

export type TeamIconKind = 'flag' | 'crest' | 'auto'

export type ResolvedTeamIcon = {
  type: 'flag' | 'crest' | 'fallback'
  src?: string
  initials: string
  label: string
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function countryIso(name: string): string | null {
  const key = normalizeName(name)
  return COUNTRY_ISO[key] ?? null
}

export function flagUrl(iso: string): string {
  // flagcdn supports subdivisions like gb-eng
  return `https://flagcdn.com/w40/${iso.toLowerCase()}.png`
}

export function clubCrestUrl(crestId: number): string {
  return `https://crests.football-data.org/${crestId}.png`
}

export function resolveTeamIcon(
  name: string,
  options?: {
    kind?: TeamIconKind
    crestUrl?: string | null
  },
): ResolvedTeamIcon {
  const label = name.trim() || 'Team'
  const kind = options?.kind ?? 'auto'
  const crest = options?.crestUrl?.trim()

  if (crest) {
    return { type: 'crest', src: crest, initials: initials(label), label }
  }

  const preferFlag = kind === 'flag' || kind === 'auto'
  const preferCrest = kind === 'crest' || kind === 'auto'

  if (preferFlag) {
    const iso = countryIso(label)
    if (iso) {
      return {
        type: 'flag',
        src: flagUrl(iso),
        initials: initials(label),
        label,
      }
    }
  }

  if (preferCrest) {
    const id = CLUB_CREST_ID[normalizeName(label)]
    if (id) {
      return {
        type: 'crest',
        src: clubCrestUrl(id),
        initials: initials(label),
        label,
      }
    }
  }

  // auto: if not a known country, still try crest map already done
  return { type: 'fallback', initials: initials(label), label }
}

export function iconKindForCompetitionCategory(
  category: string | null | undefined,
): TeamIconKind {
  if (category === 'national') return 'flag'
  if (
    category === 'club_europe' ||
    category === 'club_germany' ||
    category === 'club_americas'
  ) {
    return 'crest'
  }
  return 'auto'
}
