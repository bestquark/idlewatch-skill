#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const tempDir = mkdtempSync(join(tmpdir(), 'idlewatch-openclaw-mock-'))
const mockBinPath = join(tempDir, 'openclaw-mock.sh')

function writeMockOpenClaw(binPath) {
  const script = `#!/usr/bin/env bash
set -euo pipefail
age_ms="\${MOCK_OPENCLAW_AGE_MS:-500}"
now_ms=$(node -p 'Date.now()')
updated_at=$((now_ms - age_ms))
cat <<JSON
{"sessions":{"defaults":{"model":"gpt-5.3-codex"},"recent":[{"sessionId":"sess-e2e","agentId":"main","model":"gpt-5.3-codex","totalTokens":12345,"updatedAt":\${updated_at},"totalTokensFresh":true}]},"ts":\${now_ms}}
JSON
`
  writeFileSync(binPath, script, 'utf8')
  chmodSync(binPath, 0o755)
}

function readRow(stdout) {
  const lines = String(stdout).trim().split('\n').map((line) => line.trim()).filter(Boolean)
  const jsonLine = [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'))
  assert.ok(jsonLine, 'did not find telemetry JSON line in dry-run output')
  return JSON.parse(jsonLine)
}

function runSample(ageMs) {
  const env = {
    ...process.env,
    IDLEWATCH_OPENCLAW_BIN: mockBinPath,
    IDLEWATCH_USAGE_STALE_MS: '2000',
    IDLEWATCH_USAGE_NEAR_STALE_MS: '1000',
    IDLEWATCH_USAGE_STALE_GRACE_MS: '500',
    IDLEWATCH_INTERVAL_MS: '1000',
    MOCK_OPENCLAW_AGE_MS: String(ageMs)
  }

  const out = execFileSync('node', ['bin/idlewatch-agent.js', '--dry-run'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  return readRow(out)
}

try {
  writeMockOpenClaw(mockBinPath)

  const fresh = runSample(500)
  assert.equal(fresh.source.usageIntegrationStatus, 'ok')
  assert.equal(fresh.source.usageFreshnessState, 'fresh')
  assert.equal(fresh.source.usageNearStale, false)
  assert.equal(fresh.source.usagePastStaleThreshold, false)

  const aging = runSample(1200)
  assert.equal(aging.source.usageIntegrationStatus, 'ok')
  assert.equal(aging.source.usageFreshnessState, 'aging')
  assert.equal(aging.source.usageNearStale, true)
  assert.equal(aging.source.usagePastStaleThreshold, false)

  const postThresholdGrace = runSample(2200)
  assert.equal(postThresholdGrace.source.usageIntegrationStatus, 'ok')
  assert.equal(postThresholdGrace.source.usageFreshnessState, 'aging')
  assert.equal(postThresholdGrace.source.usagePastStaleThreshold, true)

  const stale = runSample(2600)
  assert.equal(stale.source.usageIntegrationStatus, 'stale')
  assert.equal(stale.source.usageFreshnessState, 'stale')
  assert.equal(stale.source.usageNearStale, true)
  assert.equal(stale.source.usagePastStaleThreshold, true)

  console.log('usage-freshness-e2e: ok (fresh -> aging -> post-threshold-in-grace -> stale)')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
