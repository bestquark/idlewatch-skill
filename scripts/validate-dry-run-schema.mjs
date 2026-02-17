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
  assert.ok(['openclaw', 'disabled', 'unavailable'].includes(source.usage), 'source.usage invalid')
  assert.ok(['ok', 'stale', 'disabled', 'unavailable'].includes(source.usageIntegrationStatus), 'source.usageIntegrationStatus invalid')
  assert.ok(['ok', 'disabled', 'unavailable'].includes(source.usageIngestionStatus), 'source.usageIngestionStatus invalid')
  assert.ok(['fresh', 'aging', 'stale', 'unknown', 'disabled', 'unavailable'].includes(source.usageActivityStatus), 'source.usageActivityStatus invalid')
  assert.ok(source.usageFreshnessState === null || ['fresh', 'aging', 'stale', 'unknown'].includes(source.usageFreshnessState), 'source.usageFreshnessState invalid')
  assert.equal(typeof source.usageNearStale, 'boolean', 'source.usageNearStale must be boolean')
  assert.equal(typeof source.usagePastStaleThreshold, 'boolean', 'source.usagePastStaleThreshold must be boolean')
  assert.equal(typeof source.usageRefreshAttempted, 'boolean', 'source.usageRefreshAttempted must be boolean')
  assert.equal(typeof source.usageRefreshRecovered, 'boolean', 'source.usageRefreshRecovered must be boolean')
  assert.ok(source.usageCommand === null || typeof source.usageCommand === 'string', 'source.usageCommand must be string or null')
  assert.ok(['ok', 'fallback-cache', 'disabled', 'command-missing', 'command-error', 'parse-error', 'unavailable'].includes(source.usageProbeResult), 'source.usageProbeResult invalid')
  assert.ok(Number.isInteger(source.usageProbeAttempts) && source.usageProbeAttempts >= 0, 'source.usageProbeAttempts must be integer >= 0')
  assert.ok(Number.isInteger(source.usageProbeSweeps) && source.usageProbeSweeps >= 0, 'source.usageProbeSweeps must be integer >= 0')
  assert.ok(Number.isInteger(source.usageProbeRetries) && source.usageProbeRetries >= 0, 'source.usageProbeRetries must be integer >= 0')
  assert.ok(Number.isFinite(source.usageProbeTimeoutMs) && source.usageProbeTimeoutMs > 0, 'source.usageProbeTimeoutMs must be number > 0')
  assert.ok(source.usageProbeError === null || typeof source.usageProbeError === 'string', 'source.usageProbeError must be string or null')
  assert.equal(typeof source.usageUsedFallbackCache, 'boolean', 'source.usageUsedFallbackCache must be boolean')
  assertNumberOrNull(source.usageFallbackCacheAgeMs, 'source.usageFallbackCacheAgeMs')
  assert.ok(Number.isFinite(source.usageStaleMsThreshold), 'source.usageStaleMsThreshold must be number')
  assert.ok(Number.isFinite(source.usageNearStaleMsThreshold), 'source.usageNearStaleMsThreshold must be number')
  assert.ok(Number.isFinite(source.usageStaleGraceMs), 'source.usageStaleGraceMs must be number')
  assert.ok(typeof source.memPressureSource === 'string', 'source.memPressureSource must be string')

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

  if (source.usage === 'unavailable') {
    assert.ok(!['ok', 'fallback-cache'].includes(source.usageProbeResult), 'usageProbeResult must explain unavailable usage')
    assert.ok(source.usageProbeAttempts > 0 || source.usageProbeResult === 'disabled', 'usageProbeAttempts should be > 0 when unavailable')
    assert.equal(source.usageIngestionStatus, 'unavailable', 'usageIngestionStatus must be unavailable when source.usage=unavailable')
    assert.equal(source.usageActivityStatus, 'unavailable', 'usageActivityStatus must be unavailable when source.usage=unavailable')
  }

  if (source.usageProbeResult === 'fallback-cache') {
    assert.equal(source.usageUsedFallbackCache, true, 'usageUsedFallbackCache must be true for fallback-cache')
    assert.ok(Number.isFinite(source.usageFallbackCacheAgeMs), 'usageFallbackCacheAgeMs required for fallback-cache')
  } else {
    assert.equal(source.usageUsedFallbackCache, false, 'usageUsedFallbackCache must be false unless fallback-cache')
    assert.equal(source.usageFallbackCacheAgeMs, null, 'usageFallbackCacheAgeMs must be null unless fallback-cache')
  }

  if (REQUIRE_OPENCLAW_USAGE) {
    assert.equal(source.usage, 'openclaw', 'IDLEWATCH_REQUIRE_OPENCLAW_USAGE=1 requires source.usage=openclaw')
    assert.notEqual(source.usageIntegrationStatus, 'unavailable', 'OpenClaw usage must not be unavailable in strict mode')
  }
}

try {
  run()
} catch (err) {
  console.error(`dry-run schema validation failed: ${err.message}`)
  process.exit(1)
}
