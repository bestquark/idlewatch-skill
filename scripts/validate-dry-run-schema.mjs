#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const command = process.argv[2] || 'node'
const args = process.argv.slice(3)

function run() {
  const out = execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const lines = out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const jsonLine = [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'))
  assert.ok(jsonLine, 'No telemetry JSON row found in dry-run output')

  const row = JSON.parse(jsonLine)
  validateRow(row)
  console.log(`dry-run schema ok (${command} ${args.join(' ')})`)
}

function assertNumberOrNull(value, field) {
  assert.ok(value === null || Number.isFinite(value), `${field} must be a finite number or null`)
}

const REQUIRE_OPENCLAW_USAGE = process.env.IDLEWATCH_REQUIRE_OPENCLAW_USAGE === '1'
const MAX_OPENCLAW_USAGE_AGE_MS_RAW = process.env.IDLEWATCH_MAX_OPENCLAW_USAGE_AGE_MS
const MAX_OPENCLAW_USAGE_AGE_MS = MAX_OPENCLAW_USAGE_AGE_MS_RAW
  ? Number(MAX_OPENCLAW_USAGE_AGE_MS_RAW)
  : null

if (MAX_OPENCLAW_USAGE_AGE_MS_RAW) {
  assert.ok(Number.isFinite(MAX_OPENCLAW_USAGE_AGE_MS) && MAX_OPENCLAW_USAGE_AGE_MS > 0, 'IDLEWATCH_MAX_OPENCLAW_USAGE_AGE_MS must be a number > 0 when set')
}

function validateRow(row) {
  assert.equal(typeof row.host, 'string', 'host must be a string')
  assert.ok(Number.isFinite(row.ts), 'ts must be a finite number')

  assertNumberOrNull(row.cpuPct, 'cpuPct')
  assertNumberOrNull(row.memPct, 'memPct')
  assertNumberOrNull(row.memUsedPct, 'memUsedPct')
  assertNumberOrNull(row.memPressurePct, 'memPressurePct')
  assert.ok(['normal', 'warning', 'critical', 'unavailable'].includes(row.memPressureClass), 'memPressureClass invalid')

  assertNumberOrNull(row.gpuPct, 'gpuPct')
  assert.equal(typeof row.gpuSource, 'string', 'gpuSource must be string')
  assert.ok(['high', 'medium', 'low', 'none'].includes(row.gpuConfidence), 'gpuConfidence invalid')
  assertNumberOrNull(row.gpuSampleWindowMs, 'gpuSampleWindowMs')

  assertNumberOrNull(row.tokensPerMin, 'tokensPerMin')
  assert.ok(row.openclawModel === null || typeof row.openclawModel === 'string', 'openclawModel must be string or null')
  assertNumberOrNull(row.openclawTotalTokens, 'openclawTotalTokens')
  assert.ok(row.openclawSessionId === null || typeof row.openclawSessionId === 'string', 'openclawSessionId must be string or null')
  assert.ok(row.openclawAgentId === null || typeof row.openclawAgentId === 'string', 'openclawAgentId must be string or null')
  assertNumberOrNull(row.openclawUsageTs, 'openclawUsageTs')
  assertNumberOrNull(row.openclawUsageAgeMs, 'openclawUsageAgeMs')

  assert.equal(typeof row.source, 'object', 'source must exist')
  const source = row.source

  assert.equal(typeof row.schemaFamily, 'string', 'schemaFamily must be string')
  assert.equal(typeof row.schemaVersion, 'string', 'schemaVersion must be string')
  assert.ok(Array.isArray(row.schemaCompat), 'schemaCompat must be array')
  assert.equal(typeof row.fleet, 'object', 'fleet must exist')
  assert.equal(typeof row.fleet.host, 'string', 'fleet.host must be string')
  assert.ok(Number.isFinite(row.fleet.collectedAtMs), 'fleet.collectedAtMs must be number')
  assert.equal(typeof row.fleet.resources, 'object', 'fleet.resources must exist')
  assertNumberOrNull(row.fleet.resources.cpuPct, 'fleet.resources.cpuPct')
  assertNumberOrNull(row.fleet.resources.memUsedPct, 'fleet.resources.memUsedPct')
  assertNumberOrNull(row.fleet.resources.memPressurePct, 'fleet.resources.memPressurePct')
  assert.ok(['normal', 'warning', 'critical', 'unavailable'].includes(row.fleet.resources.memPressureClass), 'fleet.resources.memPressureClass invalid')
  assert.equal(typeof row.fleet.usage, 'object', 'fleet.usage must exist')
  assert.ok(row.fleet.usage.model === null || typeof row.fleet.usage.model === 'string', 'fleet.usage.model invalid')
  assertNumberOrNull(row.fleet.usage.totalTokens, 'fleet.usage.totalTokens')
  assertNumberOrNull(row.fleet.usage.tokensPerMin, 'fleet.usage.tokensPerMin')
  assert.ok(row.fleet.usage.sessionId === null || typeof row.fleet.usage.sessionId === 'string', 'fleet.usage.sessionId invalid')
  assert.ok(row.fleet.usage.agentId === null || typeof row.fleet.usage.agentId === 'string', 'fleet.usage.agentId invalid')
  assertNumberOrNull(row.fleet.usage.usageTimestampMs, 'fleet.usage.usageTimestampMs')
  assertNumberOrNull(row.fleet.usage.usageAgeMs, 'fleet.usage.usageAgeMs')
  assert.ok(row.fleet.usage.freshnessState === null || ['fresh', 'aging', 'stale', 'unknown'].includes(row.fleet.usage.freshnessState), 'fleet.usage.freshnessState invalid')
  assert.ok(['ok', 'stale', 'disabled', 'unavailable'].includes(row.fleet.usage.integrationStatus), 'fleet.usage.integrationStatus invalid')
  assert.ok(['ok', 'disabled', 'unavailable'].includes(row.fleet.usage.ingestionStatus), 'fleet.usage.ingestionStatus invalid')
  assert.ok(['fresh', 'aging', 'stale', 'unknown', 'disabled', 'unavailable'].includes(row.fleet.usage.activityStatus), 'fleet.usage.activityStatus invalid')
  assert.ok(['ok', 'notice', 'warning', 'critical', 'off'].includes(row.fleet.usage.alertLevel), 'fleet.usage.alertLevel invalid')
  assert.equal(typeof row.fleet.provenance, 'object', 'fleet.provenance must exist')
  assert.equal(typeof row.fleet.provenance.collector, 'string', 'fleet.provenance.collector must be string')
  assert.ok(row.fleet.provenance.collectorVersion === null || typeof row.fleet.provenance.collectorVersion === 'string', 'fleet.provenance.collectorVersion invalid')
  assert.ok(['openclaw', 'disabled', 'unavailable'].includes(source.usage), 'source.usage invalid')
  assert.ok(['ok', 'stale', 'disabled', 'unavailable'].includes(source.usageIntegrationStatus), 'source.usageIntegrationStatus invalid')
  assert.ok(['ok', 'disabled', 'unavailable'].includes(source.usageIngestionStatus), 'source.usageIngestionStatus invalid')
  assert.ok(['fresh', 'aging', 'stale', 'unknown', 'disabled', 'unavailable'].includes(source.usageActivityStatus), 'source.usageActivityStatus invalid')
  assert.ok(source.usageFreshnessState === null || ['fresh', 'aging', 'stale', 'unknown'].includes(source.usageFreshnessState), 'source.usageFreshnessState invalid')
  assert.equal(typeof source.usageNearStale, 'boolean', 'source.usageNearStale must be boolean')
  assert.equal(typeof source.usagePastStaleThreshold, 'boolean', 'source.usagePastStaleThreshold must be boolean')
  assert.equal(typeof source.usageRefreshAttempted, 'boolean', 'source.usageRefreshAttempted must be boolean')
  assert.equal(typeof source.usageRefreshRecovered, 'boolean', 'source.usageRefreshRecovered must be boolean')
  assert.ok(Number.isInteger(source.usageRefreshAttempts) && source.usageRefreshAttempts >= 0, 'source.usageRefreshAttempts must be integer >= 0')
  assert.ok(Number.isInteger(source.usageRefreshReprobes) && source.usageRefreshReprobes >= 0, 'source.usageRefreshReprobes must be integer >= 0')
  assert.ok(Number.isFinite(source.usageRefreshDelayMs) && source.usageRefreshDelayMs >= 0, 'source.usageRefreshDelayMs must be number >= 0')
  assert.equal(typeof source.usageRefreshOnNearStale, 'boolean', 'source.usageRefreshOnNearStale must be boolean')
  assert.equal(typeof source.usageIdle, 'boolean', 'source.usageIdle must be boolean')
  assert.ok(source.usageCommand === null || typeof source.usageCommand === 'string', 'source.usageCommand must be string or null')
  assert.ok(['ok', 'fallback-cache', 'disabled', 'command-missing', 'command-error', 'parse-error', 'unavailable'].includes(source.usageProbeResult), 'source.usageProbeResult invalid')
  assert.ok(Number.isInteger(source.usageProbeAttempts) && source.usageProbeAttempts >= 0, 'source.usageProbeAttempts must be integer >= 0')
  assert.ok(Number.isInteger(source.usageProbeSweeps) && source.usageProbeSweeps >= 0, 'source.usageProbeSweeps must be integer >= 0')
  assert.ok(Number.isInteger(source.usageProbeRetries) && source.usageProbeRetries >= 0, 'source.usageProbeRetries must be integer >= 0')
  assert.ok(Number.isFinite(source.usageProbeTimeoutMs) && source.usageProbeTimeoutMs > 0, 'source.usageProbeTimeoutMs must be number > 0')
  assert.ok(source.usageProbeError === null || typeof source.usageProbeError === 'string', 'source.usageProbeError must be string or null')
  assert.equal(typeof source.usageUsedFallbackCache, 'boolean', 'source.usageUsedFallbackCache must be boolean')
  assert.ok(source.usageFallbackCacheSource === null || ['memory', 'disk'].includes(source.usageFallbackCacheSource), 'source.usageFallbackCacheSource must be memory|disk|null')
  assert.ok(['ok', 'notice', 'warning', 'critical', 'off'].includes(source.usageAlertLevel), 'source.usageAlertLevel invalid')
  assert.ok(['healthy', 'activity-idle', 'activity-near-stale', 'activity-past-threshold', 'activity-stale', 'activity-no-new-usage', 'ingestion-unavailable', 'usage-disabled'].includes(source.usageAlertReason), 'source.usageAlertReason invalid')
  assertNumberOrNull(source.usageFallbackCacheAgeMs, 'source.usageFallbackCacheAgeMs')
  assert.ok(Number.isFinite(source.usageStaleMsThreshold), 'source.usageStaleMsThreshold must be number')
  assert.ok(Number.isFinite(source.usageNearStaleMsThreshold), 'source.usageNearStaleMsThreshold must be number')
  assert.ok(Number.isFinite(source.usageStaleGraceMs), 'source.usageStaleGraceMs must be number')
  assert.ok(Number.isFinite(source.usageIdleAfterMsThreshold), 'source.usageIdleAfterMsThreshold must be number')
  assert.ok(typeof source.memPressureSource === 'string', 'source.memPressureSource must be string')

  assert.equal(row.fleet.usage.tokensPerMin, row.tokensPerMin, 'fleet usage tokensPerMin must mirror legacy field')
  assert.equal(row.fleet.usage.totalTokens, row.openclawTotalTokens, 'fleet usage totalTokens must mirror legacy field')
  assert.equal(row.fleet.usage.model, row.openclawModel, 'fleet usage model must mirror legacy field')
  assert.equal(row.fleet.usage.sessionId, row.openclawSessionId, 'fleet usage sessionId must mirror legacy field')
  assert.equal(row.fleet.usage.agentId, row.openclawAgentId, 'fleet usage agentId must mirror legacy field')

  if (source.usage === 'openclaw') {
    assert.ok(row.openclawSessionId, 'openclawSessionId required when source.usage=openclaw')
    assert.ok(row.openclawUsageTs, 'openclawUsageTs required when source.usage=openclaw')
    assert.ok(source.usageFreshnessState, 'usageFreshnessState required when source.usage=openclaw')
    assert.ok(['ok', 'fallback-cache'].includes(source.usageProbeResult), 'usageProbeResult must be ok or fallback-cache when source.usage=openclaw')
    assert.equal(source.usageIngestionStatus, 'ok', 'usageIngestionStatus must be ok when source.usage=openclaw')
    assert.ok(['fresh', 'aging', 'stale', 'unknown'].includes(source.usageActivityStatus), 'usageActivityStatus must reflect freshness when source.usage=openclaw')
  }

  if (source.usage === 'disabled') {
    assert.equal(source.usageProbeResult, 'disabled', 'usageProbeResult must be disabled when source.usage=disabled')
    assert.equal(source.usageIngestionStatus, 'disabled', 'usageIngestionStatus must be disabled when source.usage=disabled')
    assert.equal(source.usageActivityStatus, 'disabled', 'usageActivityStatus must be disabled when source.usage=disabled')
    assert.equal(source.usageAlertLevel, 'off', 'usageAlertLevel must be off when source.usage=disabled')
    assert.equal(source.usageAlertReason, 'usage-disabled', 'usageAlertReason must be usage-disabled when source.usage=disabled')
  }

  if (source.usageProbeAttempts === 0) {
    assert.equal(source.usageProbeSweeps, 0, 'usageProbeSweeps must be 0 when no probe attempts ran')
  } else {
    assert.ok(source.usageProbeSweeps >= 1, 'usageProbeSweeps must be >= 1 when probe attempts run')
  }
  assert.ok(source.usageProbeSweeps <= source.usageProbeRetries + 1, 'usageProbeSweeps cannot exceed configured retries + 1')
  if (source.usageRefreshRecovered) {
    assert.equal(source.usageRefreshAttempted, true, 'usageRefreshRecovered implies usageRefreshAttempted')
  }
  if (source.usageRefreshAttempted) {
    assert.ok(source.usageRefreshAttempts >= 1, 'usageRefreshAttempts must be >= 1 when refresh attempted')
    assert.ok(source.usageRefreshAttempts <= source.usageRefreshReprobes + 1, 'usageRefreshAttempts cannot exceed configured reprobes + 1')
  } else {
    assert.equal(source.usageRefreshAttempts, 0, 'usageRefreshAttempts must be 0 when refresh not attempted')
  }

  if (source.usageAlertReason === 'activity-no-new-usage') {
    assert.equal(source.usageIngestionStatus, 'ok', 'activity-no-new-usage requires ingestionStatus=ok')
    assert.equal(source.usageActivityStatus, 'stale', 'activity-no-new-usage requires activityStatus=stale')
    assert.equal(source.usageRefreshAttempted, true, 'activity-no-new-usage requires usageRefreshAttempted=true')
    assert.equal(source.usageRefreshRecovered, false, 'activity-no-new-usage requires usageRefreshRecovered=false')
  }

  if (source.usage === 'unavailable') {
    assert.ok(!['ok', 'fallback-cache'].includes(source.usageProbeResult), 'usageProbeResult must explain unavailable usage')
    assert.ok(source.usageProbeAttempts > 0 || source.usageProbeResult === 'disabled', 'usageProbeAttempts should be > 0 when unavailable')
    assert.equal(source.usageIngestionStatus, 'unavailable', 'usageIngestionStatus must be unavailable when source.usage=unavailable')
    assert.equal(source.usageActivityStatus, 'unavailable', 'usageActivityStatus must be unavailable when source.usage=unavailable')
    assert.equal(source.usageAlertLevel, 'critical', 'usageAlertLevel must be critical when source.usage=unavailable')
    assert.equal(source.usageAlertReason, 'ingestion-unavailable', 'usageAlertReason must be ingestion-unavailable when source.usage=unavailable')
  }

  if (source.usageProbeResult === 'fallback-cache') {
    assert.equal(source.usageUsedFallbackCache, true, 'usageUsedFallbackCache must be true for fallback-cache')
    assert.ok(Number.isFinite(source.usageFallbackCacheAgeMs), 'usageFallbackCacheAgeMs required for fallback-cache')
    assert.ok(['memory', 'disk'].includes(source.usageFallbackCacheSource), 'usageFallbackCacheSource required for fallback-cache')
  } else {
    assert.equal(source.usageUsedFallbackCache, false, 'usageUsedFallbackCache must be false unless fallback-cache')
    assert.equal(source.usageFallbackCacheAgeMs, null, 'usageFallbackCacheAgeMs must be null unless fallback-cache')
    assert.equal(source.usageFallbackCacheSource, null, 'usageFallbackCacheSource must be null unless fallback-cache')
  }

  if (source.usageIngestionStatus === 'ok') {
    assert.ok(['ok', 'notice', 'warning'].includes(source.usageAlertLevel), 'ingestion ok cannot emit critical/off alert level')
  }

  if (REQUIRE_OPENCLAW_USAGE) {
    assert.equal(source.usage, 'openclaw', 'IDLEWATCH_REQUIRE_OPENCLAW_USAGE=1 requires source.usage=openclaw')
    assert.notEqual(source.usageIntegrationStatus, 'unavailable', 'OpenClaw usage must not be unavailable in strict mode')
  }

  if (MAX_OPENCLAW_USAGE_AGE_MS !== null && source.usage === 'openclaw') {
    assert.ok(Number.isFinite(row.openclawUsageAgeMs), 'openclawUsageAgeMs must be present when enforcing max age')
    assert.ok(
      row.openclawUsageAgeMs <= MAX_OPENCLAW_USAGE_AGE_MS,
      `openclawUsageAgeMs (${row.openclawUsageAgeMs}) exceeds max allowed ${MAX_OPENCLAW_USAGE_AGE_MS}`
    )
  }
}

try {
  run()
} catch (err) {
  console.error(`dry-run schema validation failed: ${err.message}`)
  process.exit(1)
}
