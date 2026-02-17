import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OPENCLAW_FLEET_SCHEMA, enrichWithOpenClawFleetTelemetry } from '../src/telemetry-mapping.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'))
}

test('enriches legacy sample with fleet schema envelope while preserving legacy fields', () => {
  const legacy = {
    host: 'mac-mini-1',
    ts: 1771278899999,
    cpuPct: 12.5,
    memPct: 63.2,
    memUsedPct: 63.2,
    memPressurePct: 42,
    memPressureClass: 'normal',
    tokensPerMin: 128.4,
    openclawModel: 'gpt-5.3-codex',
    openclawTotalTokens: 70500,
    openclawSessionId: '90d2a820-6d77-42f0-8db4-12b90f9f7203',
    openclawAgentId: 'main',
    openclawUsageTs: 1771278893678,
    openclawUsageAgeMs: 6321,
    source: {
      usage: 'openclaw',
      usageIntegrationStatus: 'ok',
      usageIngestionStatus: 'ok',
      usageActivityStatus: 'fresh',
      usageFreshnessState: 'fresh',
      usageAlertLevel: 'ok',
      usageAlertReason: 'healthy',
      usageCommand: 'openclaw status --json',
      usageProbeResult: 'ok',
      usageProbeAttempts: 1,
      usageUsedFallbackCache: false,
      usageFallbackCacheSource: null
    }
  }

  const enriched = enrichWithOpenClawFleetTelemetry(legacy, {
    collector: 'idlewatch-agent',
    collectorVersion: '0.1.0'
  })

  assert.equal(enriched.host, legacy.host)
  assert.equal(enriched.openclawSessionId, legacy.openclawSessionId)
  assert.equal(enriched.schemaFamily, OPENCLAW_FLEET_SCHEMA.family)
  assert.equal(enriched.schemaVersion, OPENCLAW_FLEET_SCHEMA.version)
  assert.deepEqual(enriched.schemaCompat, OPENCLAW_FLEET_SCHEMA.backwardCompatibleWith)
  assert.equal(enriched.fleet.usage.tokensPerMin, legacy.tokensPerMin)
  assert.equal(enriched.fleet.usage.totalTokens, legacy.openclawTotalTokens)
  assert.equal(enriched.fleet.provenance.collectorVersion, '0.1.0')
})

test('fixture sample remains aligned with schema metadata', () => {
  const sample = fixture('openclaw-fleet-sample-v1.json')
  assert.equal(sample.schemaFamily, OPENCLAW_FLEET_SCHEMA.family)
  assert.equal(sample.schemaVersion, OPENCLAW_FLEET_SCHEMA.version)
  assert.deepEqual(sample.schemaCompat, OPENCLAW_FLEET_SCHEMA.backwardCompatibleWith)
  assert.equal(sample.fleet.usage.model, sample.openclawModel)
  assert.equal(sample.fleet.usage.sessionId, sample.openclawSessionId)
})
