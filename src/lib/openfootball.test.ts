import { parseOpenfootballWorldCup } from './openfootball'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const sample = {
  matches: [
    {
      num: 1,
      round: 'Matchday 1',
      date: '2026-06-11',
      time: '13:00 UTC-6',
      team1: 'Mexico',
      team2: 'South Africa',
      score: { ft: [2, 0] },
    },
    {
      round: 'Matchday 2',
      date: '2026-12-20',
      time: '20:00 UTC',
      team1: 'Germany',
      team2: 'France',
    },
  ],
}

const rows = parseOpenfootballWorldCup(sample, '2026')
assert(rows.length === 2, 'two matches')
assert(rows[0].status === 'finished', 'ft finished')
assert(rows[0].home_goals === 2 && rows[0].away_goals === 0, 'score')
assert(rows[0].external_id === 'of-wc-2026-n1', 'external id')
assert(rows[1].status === 'scheduled', 'future scheduled')
assert(Boolean(rows[0].kickoff_at), 'kickoff parsed')

console.log('openfootball.test.ts OK')
