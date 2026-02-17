import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveUsageFreshness } from '../src/usage-freshness.js'

test('deriveUsageFreshness marks stale only when age is strictly above threshold', () => {
  const usage = { usageTimestampMs: 1000 }

  const atThreshold = deriveUsageFreshness(usage, 7000, 6000, 4500)
  assert.equal(atThreshold.usageAgeMs, 6000)
  assert.equal(atThreshold.isStale, false)
  assert.equal(atThreshold.isPastStaleThreshold, false)
  assert.equal(atThreshold.isNearStale, true)
  assert.equal(atThreshold.freshnessState, 'aging')

  const overThreshold = deriveUsageFreshness(usage, 7001, 6000, 4500)
  assert.equal(overThreshold.usageAgeMs, 6001)
  assert.equal(overThreshold.isStale, true)
  assert.equal(overThreshold.isPastStaleThreshold, true)
  assert.equal(overThreshold.freshnessState, 'stale')
})

test('deriveUsageFreshness handles invalid or future timestamps safely', () => {
  assert.deepEqual(deriveUsageFreshness({}, 1000, 6000), {
    usageAgeMs: null,
    isStale: false,
    isNearStale: false,
    isPastStaleThreshold: false,
    freshnessState: 'unknown'
  })
  assert.deepEqual(deriveUsageFreshness({ usageTimestampMs: 2000 }, 1000, 6000), {
    usageAgeMs: null,
    isStale: false,
    isNearStale: false,
    isPastStaleThreshold: false,
    freshnessState: 'unknown'
  })
})

test('deriveUsageFreshness disables stale classification for invalid thresholds', () => {
  const usage = { usageTimestampMs: 1000 }
  const result = deriveUsageFreshness(usage, 9000, 0, 5000)
  assert.equal(result.usageAgeMs, 8000)
  assert.equal(result.isStale, false)
  assert.equal(result.isPastStaleThreshold, false)
  assert.equal(result.isNearStale, true)
  assert.equal(result.freshnessState, 'aging')
})

test('deriveUsageFreshness applies grace window before stale classification', () => {
  const usage = { usageTimestampMs: 1000 }

  const duringGrace = deriveUsageFreshness(usage, 7600, 6000, 4500, 2000)
  assert.equal(duringGrace.usageAgeMs, 6600)
  assert.equal(duringGrace.isPastStaleThreshold, true)
  assert.equal(duringGrace.isStale, false)
  assert.equal(duringGrace.freshnessState, 'aging')

  const afterGrace = deriveUsageFreshness(usage, 9001, 6000, 4500, 2000)
  assert.equal(afterGrace.usageAgeMs, 8001)
  assert.equal(afterGrace.isPastStaleThreshold, true)
  assert.equal(afterGrace.isStale, true)
  assert.equal(afterGrace.freshnessState, 'stale')
})
