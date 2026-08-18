import test from 'node:test'
import assert from 'node:assert/strict'
import { balancedSample, fleissKappa } from './study.js'

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
  assert.equal(fleissKappa([[5, 5, 5], [2, 2, 2], [4, 4, 4]]), 1)
})
