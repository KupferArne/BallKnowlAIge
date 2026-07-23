import { normalizeBonusAnswer, scoreBonusAnswer, scoreTip } from './scoring'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(scoreTip(2, 1, 2, 1) === 4, 'exact')
assert(scoreTip(2, 0, 3, 1) === 3, 'goal diff')
assert(scoreTip(1, 0, 3, 1) === 2, 'tendency')
assert(scoreTip(0, 0, 1, 1) === 2, 'draw tendency')
assert(scoreTip(2, 2, 1, 1) === 2, 'draw tendency wrong score')
assert(scoreTip(1, 1, 1, 1) === 4, 'draw exact')
assert(scoreTip(0, 1, 2, 0) === 0, 'wrong tendency')

assert(normalizeBonusAnswer('  Brazil  ') === 'brazil', 'normalize bonus')
assert(scoreBonusAnswer('Brazil', 'brazil', 5) === 5, 'bonus match')
assert(scoreBonusAnswer('France', 'brazil', 5) === 0, 'bonus miss')
assert(scoreBonusAnswer('', 'brazil', 5) === 0, 'bonus empty')

console.log('scoring.test.ts OK')
