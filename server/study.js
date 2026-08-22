import { RATING_CATEGORIES } from './rating-scale.js'

const CRITERIA = ['adequacy', 'fluency', 'semantic']

export function seededRandom(seed = 'cosafe') {
  let hash = 2166136261
  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash += 0x6d2b79f5
    let value = hash
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle(values, random) {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

export function balancedSample(items, requestedCount, seed) {
  const count = Math.min(Math.max(1, requestedCount), items.length)
  const grouped = new Map()
  for (const item of items) {
    if (!grouped.has(item.category)) grouped.set(item.category, [])
    grouped.get(item.category).push(item)
  }

  const random = seededRandom(seed)
  const categories = shuffle([...grouped.keys()].sort(), random)
  const queues = new Map(categories.map((category) => [category, shuffle(grouped.get(category), random)]))
  const selected = []

  while (selected.length < count) {
    let added = false
    for (const category of categories) {
      const next = queues.get(category).shift()
      if (next) {
        selected.push(next)
        added = true
      }
      if (selected.length === count) break
    }
    if (!added) break
  }
  return shuffle(selected, random)
}

export function fleissKappa(rows, categories = RATING_CATEGORIES) {
  const completeRows = rows.filter((row) => row.length >= 2)
  if (!completeRows.length) return null

  const n = completeRows[0].length
  const equalRows = completeRows.filter((row) => row.length === n)
  if (!equalRows.length || n < 2) return null

  const categoryTotals = new Map(categories.map((category) => [category, 0]))
  let observedAgreement = 0

  for (const row of equalRows) {
    const counts = new Map(categories.map((category) => [category, 0]))
    for (const rating of row) {
      counts.set(rating, (counts.get(rating) || 0) + 1)
      categoryTotals.set(rating, (categoryTotals.get(rating) || 0) + 1)
    }
    const matchedPairs = [...counts.values()].reduce((sum, value) => sum + value * (value - 1), 0)
    observedAgreement += matchedPairs / (n * (n - 1))
  }

  observedAgreement /= equalRows.length
  const totalRatings = equalRows.length * n
  const expectedAgreement = [...categoryTotals.values()]
    .reduce((sum, value) => sum + (value / totalRatings) ** 2, 0)

  if (expectedAgreement === 1) return observedAgreement === 1 ? 1 : null
  return (observedAgreement - expectedAgreement) / (1 - expectedAgreement)
}

export function calculateAgreement(annotations, annotatorCount) {
  const submitted = annotations.filter((annotation) => annotation.status === 'submitted')
  const byItem = new Map()
  for (const annotation of submitted) {
    if (!byItem.has(annotation.itemId)) byItem.set(annotation.itemId, [])
    byItem.get(annotation.itemId).push(annotation)
  }

  const complete = [...byItem.values()].filter((ratings) => ratings.length === annotatorCount)
  const kappa = Object.fromEntries(CRITERIA.map((criterion) => [
    criterion,
    fleissKappa(complete.map((ratings) => ratings.map((rating) => rating.ratings[criterion]))),
  ]))

  return { completeItems: complete.length, kappa }
}

export { CRITERIA }
