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
  assert.ok(source.usageFreshnessState === null || ['fresh', 'aging', 'stale', 'unknown'].includes(source.usageFreshnessState), 'source.usageFreshnessState invalid')
  assert.equal(typeof source.usageNearStale, 'boolean', 'source.usageNearStale must be boolean')
  assert.equal(typeof source.usagePastStaleThreshold, 'boolean', 'source.usagePastStaleThreshold must be boolean')
  assert.ok(source.usageCommand === null || typeof source.usageCommand === 'string', 'source.usageCommand must be string or null')
  assert.ok(Number.isFinite(source.usageStaleMsThreshold), 'source.usageStaleMsThreshold must be number')
  assert.ok(Number.isFinite(source.usageNearStaleMsThreshold), 'source.usageNearStaleMsThreshold must be number')
  assert.ok(Number.isFinite(source.usageStaleGraceMs), 'source.usageStaleGraceMs must be number')
  assert.ok(typeof source.memPressureSource === 'string', 'source.memPressureSource must be string')

  if (source.usage === 'openclaw') {
    assert.ok(row.openclawSessionId, 'openclawSessionId required when source.usage=openclaw')
    assert.ok(row.openclawUsageTs, 'openclawUsageTs required when source.usage=openclaw')
    assert.ok(source.usageFreshnessState, 'usageFreshnessState required when source.usage=openclaw')
  }
}

try {
  run()
} catch (err) {
  console.error(`dry-run schema validation failed: ${err.message}`)
  process.exit(1)
}
