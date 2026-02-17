#!/usr/bin/env node
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const repoRoot = process.cwd()
const appBin = './dist/IdleWatch.app/Contents/MacOS/IdleWatch'
const tempDir = mkdtempSync(join(tmpdir(), 'idlewatch-packaged-alert-rate-'))
const mockBinPath = join(tempDir, 'openclaw-mock.sh')

function writeMockOpenClaw(pathToFile) {
  const script = `#!/usr/bin/env bash
set -euo pipefail
AGE_MS="\${MOCK_OPENCLAW_AGE_MS:-500}"
now_ms=$(node -p 'Date.now()')
updated_at=$((now_ms - AGE_MS))
cat <<JSON
{"sessions":{"defaults":{"model":"gpt-5.3-codex"},"recent":[{"sessionId":"sess-packaged-alert","agentId":"main","model":"gpt-5.3-codex","totalTokens":12345,"updatedAt":\${updated_at},"totalTokensFresh":true}]},"ts":\${now_ms}}
JSON
`
  writeFileSync(pathToFile, script, 'utf8')
  chmodSync(pathToFile, 0o755)
}

function readRow(stdout) {
  const lines = String(stdout).trim().split('\n').map((line) => line.trim()).filter(Boolean)
  const jsonLine = [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'))
  assert.ok(jsonLine, 'did not find telemetry JSON line in packaged dry-run output')
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

  const out = execFileSync(appBin, ['--dry-run'], {
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
      reason: row?.source?.usageAlertReason,
      freshness: row?.source?.usageFreshnessState
    }
  })
}

try {
  writeMockOpenClaw(mockBinPath)
  execFileSync('npm', ['run', 'package:macos', '--silent'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const typicalAges = [28000, 33000, 39000, 45000, 50000, 54000]
  const typical = collectAlertLevels(typicalAges)

  const nonOkTypical = typical.filter((sample) => sample.level !== 'ok')
  assert.equal(nonOkTypical.length, 0, `expected no non-ok alerts for typical low-traffic ages, got: ${JSON.stringify(nonOkTypical)}`)
  assert.equal(typical[0].nearMs, 59500, 'expected default near-stale threshold to include stale+grace derivation (59500ms)')

  const boundaryAges = [1800, 3600, 5600]
  const boundary = collectAlertLevels(boundaryAges, {
    IDLEWATCH_USAGE_STALE_MS: '3000',
    IDLEWATCH_USAGE_NEAR_STALE_MS: '1000',
    IDLEWATCH_USAGE_STALE_GRACE_MS: '1000'
  })

  assert.equal(boundary[0].level, 'notice', 'expected boundary sample 0 to emit notice for near-stale')
  assert.equal(boundary[0].reason, 'activity-near-stale', 'expected boundary sample 0 reason to be activity-near-stale')
  assert.equal(boundary[1].level, 'warning', 'expected boundary sample 1 to emit warning after stale threshold')
  assert.equal(boundary[1].reason, 'activity-past-threshold', 'expected boundary sample 1 reason to be activity-past-threshold')
  assert.equal(boundary[2].level, 'warning', 'expected boundary sample 2 to remain warning')
  assert.equal(boundary[2].reason, 'activity-past-threshold', 'expected boundary sample 2 reason to remain activity-past-threshold')

  console.log('validate-packaged-usage-alert-rate-e2e: ok (packaged launcher alert-level transitions remain aligned)')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
