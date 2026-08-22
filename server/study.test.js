import test from 'node:test'
import assert from 'node:assert/strict'
import { balancedSample, fleissKappa } from './study.js'
import { mapRatingToThreePoint, mapRatingsToThreePoint } from './rating-scale.js'

test('balancedSample is deterministic and balances categories', () => {
  const items = ['a', 'b', 'c'].flatMap((category) =>
    Array.from({ length: 10 }, (_, index) => ({ id: `${category}-${index}`, category })),
  )
  const first = balancedSample(items, 12, 'thesis-1')
  const second = balancedSample(items, 12, 'thesis-1')
  assert.deepEqual(first, second)
  const counts = Object.groupBy(first, (item) => item.category)
  assert.deepEqual(Object.values(counts).map((values) => values.length).sort(), [4, 4, 4])
})

test('fleissKappa returns one for perfect agreement', () => {
  assert.equal(fleissKappa([[3, 3, 3], [1, 1, 1], [2, 2, 2]]), 1)
})

test('mapRatingToThreePoint applies the approved contiguous collapse', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(mapRatingToThreePoint), [1, 1, 2, 3, 3])
  assert.equal(mapRatingToThreePoint(null), null)
})

test('mapRatingsToThreePoint preserves null draft values', () => {
  assert.deepEqual(mapRatingsToThreePoint({ adequacy: 5, fluency: 3, semantic: null }), {
    adequacy: 3,
    fluency: 2,
    semantic: null,
  })
})
