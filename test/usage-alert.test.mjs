import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveUsageAlert } from '../src/usage-alert.js'

test('returns critical when ingestion is unavailable', () => {
  const result = deriveUsageAlert({ usageIngestionStatus: 'unavailable', usageActivityStatus: 'fresh' })
  assert.deepEqual(result, { level: 'critical', reason: 'ingestion-unavailable' })
})

test('returns warning when activity is stale', () => {
  const result = deriveUsageAlert({ usageIngestionStatus: 'ok', usageActivityStatus: 'stale' })
  assert.deepEqual(result, { level: 'warning', reason: 'activity-stale' })
})

test('returns warning when past stale threshold in grace window', () => {
  const result = deriveUsageAlert({ usageIngestionStatus: 'ok', usageActivityStatus: 'aging', usagePastStaleThreshold: true })
  assert.deepEqual(result, { level: 'warning', reason: 'activity-past-threshold' })
})

test('returns notice when near stale', () => {
  const result = deriveUsageAlert({ usageIngestionStatus: 'ok', usageActivityStatus: 'fresh', usageNearStale: true })
  assert.deepEqual(result, { level: 'notice', reason: 'activity-near-stale' })
})

test('returns off when usage is disabled', () => {
  const result = deriveUsageAlert({ usageIngestionStatus: 'disabled', usageActivityStatus: 'disabled' })
  assert.deepEqual(result, { level: 'off', reason: 'usage-disabled' })
})

test('returns ok when usage is healthy', () => {
  const result = deriveUsageAlert({ usageIngestionStatus: 'ok', usageActivityStatus: 'fresh', usageNearStale: false })
  assert.deepEqual(result, { level: 'ok', reason: 'healthy' })
})
