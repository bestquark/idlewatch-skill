import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(process.cwd())

function runDryRunSchemaWithCommand(commandArgs, envOverrides = {}) {
  const result = spawnSync(process.execPath, [
    path.join(root, 'scripts', 'validate-dry-run-schema.mjs'),
    ...commandArgs
  ], {
    env: {
      ...process.env,
      IDLEWATCH_DRY_RUN_TIMEOUT_MS: '5000',
      ...envOverrides
    },
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, `dry-run schema validation failed: ${(result.stderr || result.stdout).trim()}`)
}

function runDryRunSchemaWithOpenClawMode(mode) {
  runDryRunSchemaWithCommand([
    process.execPath,
    path.join(root, 'bin', 'idlewatch-agent.js'),
    '--dry-run'
  ], {
    IDLEWATCH_OPENCLAW_USAGE: mode,
    IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS: '2500',
    IDLEWATCH_OPENCLAW_PROBE_RETRIES: '1'
  })
}

function runDryRunSchemaWithNoisyMultilineCommand() {
  const commandScript = `
const row = {
  host: 'ci-mock-host',
  ts: Date.now(),
  cpuPct: null,
  memPct: null,
  memUsedPct: null,
  memPressurePct: null,
  memPressureClass: 'unavailable',
  gpuPct: null,
  gpuSource: 'mock',
  gpuConfidence: 'none',
  gpuSampleWindowMs: null,
  tokensPerMin: null,
  openclawModel: null,
  openclawTotalTokens: null,
  openclawSessionId: null,
  openclawAgentId: null,
  openclawUsageTs: null,
  openclawUsageAgeMs: null,
  source: {
    usage: 'disabled',
    usageIntegrationStatus: 'unavailable',
    usageIngestionStatus: 'disabled',
    usageFreshnessState: 'disabled',
    usageActivityStatus: 'disabled',
    usageAlertLevel: 'off',
    usageAlertReason: 'usage-disabled',
    usageNearStale: false,
    usagePastStaleThreshold: false,
    usageRefreshAttempted: false,
    usageRefreshRecovered: false,
    usageRefreshAttempts: 0,
    usageRefreshReprobes: 1,
    usageRefreshDelayMs: 250,
    usageRefreshDurationMs: null,
    usageRefreshOnNearStale: true,
    usageIdle: false,
    usageCommand: null,
    usageProbeResult: 'disabled',
    usageProbeAttempts: 0,
    usageProbeDurationMs: null,
    usageProbeSweeps: 0,
    usageProbeRetries: 0,
    usageProbeTimeoutMs: 4000,
    usageProbeError: null,
    usageUsedFallbackCache: false,
    usageFallbackCacheAgeMs: null,
    usageFallbackCacheSource: null,
    usageStaleMsThreshold: 60000,
    usageNearStaleMsThreshold: 51000,
    usageStaleGraceMs: 10000,
    usageIdleAfterMsThreshold: 21600000,
    memPressureSource: 'mock'
  },
  schemaFamily: 'idlewatch.metric.v1',
  schemaVersion: '1.0.0',
  schemaCompat: ['idlewatch.metric.v1'],
  fleet: {
    host: 'ci-mock-host',
    collectedAtMs: Date.now(),
    resources: {
      cpuPct: null,
      memUsedPct: null,
      memPressurePct: null,
      memPressureClass: 'unavailable'
    },
    usage: {
      model: null,
      totalTokens: null,
      tokensPerMin: null,
      sessionId: null,
      agentId: null,
      usageTimestampMs: null,
      usageAgeMs: null,
      freshnessState: null,
      integrationStatus: 'unavailable',
      ingestionStatus: 'disabled',
      activityStatus: 'disabled',
      alertLevel: 'off'
    },
    provenance: {
      collector: 'idlewatch-agent',
      collectorVersion: null
    }
  }
}

console.log('\x1b[32m[init]\x1b[0m booting')
console.log(JSON.stringify(row, null, 2))
console.log('done')
`

  runDryRunSchemaWithCommand([
    process.execPath,
    '-e',
    commandScript
  ], {
    IDLEWATCH_OPENCLAW_USAGE: 'off',
    IDLEWATCH_DRY_RUN_TIMEOUT_MS: '5000'
  })
}

test('validate dry-run schema passes with OpenClaw usage disabled', () => {
  runDryRunSchemaWithOpenClawMode('off')
})

test('validate dry-run schema accepts noisy multiline JSON rows', () => {
  runDryRunSchemaWithNoisyMultilineCommand()
})
