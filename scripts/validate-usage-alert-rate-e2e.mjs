#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const tempDir = mkdtempSync(join(tmpdir(), 'idlewatch-openclaw-alert-rate-'))
const mockBinPath = join(tempDir, 'openclaw-mock.sh')

function writeMockOpenClaw(binPath) {
  const script = `#!/usr/bin/env bash
set -euo pipefail
age_ms="\${MOCK_OPENCLAW_AGE_MS:-500}"
now_ms=$(node -p 'Date.now()')
updated_at=$((now_ms - age_ms))
cat <<JSON
{"sessions":{"defaults":{"model":"gpt-5.3-codex"},"recent":[{"sessionId":"sess-alert-rate","agentId":"main","model":"gpt-5.3-codex","totalTokens":12345,"updatedAt":\${updated_at},"totalTokensFresh":true}]},"ts":\${now_ms}}
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

function runSample(ageMs, overrides = {}) {
  const env = {
    ...process.env,
    IDLEWATCH_OPENCLAW_BIN: mockBinPath,
    IDLEWATCH_USAGE_STALE_MS: '60000',
    IDLEWATCH_USAGE_STALE_GRACE_MS: '10000',
    IDLEWATCH_INTERVAL_MS: '1000',
    MOCK_OPENCLAW_AGE_MS: String(ageMs),
    ...overrides
  }

  const out = execFileSync('node', ['bin/idlewatch-agent.js', '--dry-run'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  return readRow(out)
}

function collectAlertLevels(ageSeries, overrides = {}) {
  return ageSeries.map((ageMs) => {
    const row = runSample(ageMs, overrides)
    return {
      ageMs,
      nearMs: row?.source?.usageNearStaleMsThreshold,
      level: row?.source?.usageAlertLevel,
      reason: row?.source?.usageAlertReason
    }
  })
}

try {
  writeMockOpenClaw(mockBinPath)

  const typicalAges = [28000, 33000, 39000, 45000, 50000, 54000]
  const typical = collectAlertLevels(typicalAges)

  const nonOkTypical = typical.filter((sample) => sample.level !== 'ok')
  assert.equal(nonOkTypical.length, 0, `expected no non-ok alerts for typical low-traffic ages, got: ${JSON.stringify(nonOkTypical)}`)
  assert.equal(typical[0].nearMs, 59500, 'expected default near-stale threshold to include stale+grace derivation (59500ms)')

  const deterministicBoundaryAges = [1800, 3600, 5600]
  const deterministicBoundary = collectAlertLevels(deterministicBoundaryAges, {
    IDLEWATCH_USAGE_STALE_MS: '3000',
    IDLEWATCH_USAGE_NEAR_STALE_MS: '1000',
    IDLEWATCH_USAGE_STALE_GRACE_MS: '1000'
  })

  assert.equal(deterministicBoundary[0].level, 'notice')
  assert.equal(deterministicBoundary[0].reason, 'activity-near-stale')
  assert.equal(deterministicBoundary[1].level, 'warning')
  assert.equal(deterministicBoundary[1].reason, 'activity-past-threshold')
  assert.equal(deterministicBoundary[2].level, 'warning')
  assert.equal(deterministicBoundary[2].reason, 'activity-past-threshold')

  console.log('usage-alert-rate-e2e: ok (typical cadence stays ok; boundary states escalate notice -> warning -> warning)')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
