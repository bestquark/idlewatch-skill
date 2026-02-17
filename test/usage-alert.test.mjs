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

test('downgrades stale to notice when refresh attempts could not recover fresher usage', () => {
  const result = deriveUsageAlert({
    usageIngestionStatus: 'ok',
    usageActivityStatus: 'stale',
    usageRefreshAttempted: true,
    usageRefreshRecovered: false
  })
  assert.deepEqual(result, { level: 'notice', reason: 'activity-no-new-usage' })
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

test('downgrades stale to idle notice when usage age exceeds idle threshold', () => {
  const result = deriveUsageAlert(
    { usageIngestionStatus: 'ok', usageActivityStatus: 'stale' },
    { usageAgeMs: 3600000, idleAfterMs: 1800000 }
  )
  assert.deepEqual(result, { level: 'notice', reason: 'activity-idle' })
})

test('does not emit idle notice when ingestion is unavailable', () => {
  const result = deriveUsageAlert(
    { usageIngestionStatus: 'unavailable', usageActivityStatus: 'stale' },
    { usageAgeMs: 3600000, idleAfterMs: 1800000 }
  )
  assert.deepEqual(result, { level: 'critical', reason: 'ingestion-unavailable' })
})
