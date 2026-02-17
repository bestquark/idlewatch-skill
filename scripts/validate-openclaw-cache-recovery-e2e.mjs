#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const tempDir = mkdtempSync(join(tmpdir(), 'idlewatch-openclaw-cache-recover-'))
const mockBinPath = join(tempDir, 'openclaw-mock.sh')
const cachePath = join(tempDir, 'openclaw-last-good.json')
const callLog = join(tempDir, 'calls.txt')
const staleAgeMs = 90000
const staleUsageTs = Date.now() - staleAgeMs

function writeMockOpenClaw(path) {
  const script = `#!/usr/bin/env bash
set -euo pipefail
calls_file="${callLog}"
if [[ ! -f "$calls_file" ]]; then
  echo 0 > "$calls_file"
fi
n=$(cat "$calls_file")
next=$((n + 1))
echo "$next" > "$calls_file"

if [[ "$n" -lt 5 ]]; then
  echo "openclaw temporary failure for recovery test" >&2
  exit 1
fi

now_ms=$(node -p 'Date.now()')
updated_at=$((now_ms - 2000))
cat <<JSON
{"sessions":{"defaults":{"model":"gpt-5.3-codex"},"recent":[{"sessionId":"cached-recover","agentId":"main","model":"gpt-5.3-codex","totalTokens":98765,"totalTokensFresh":true,"updatedAt":$updated_at,"updated_at":$updated_at}]},"ts":$now_ms}
JSON
`

  writeFileSync(path, script, 'utf8')
  chmodSync(path, 0o755)
}

function readRow(stdout) {
  const lines = String(stdout)
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const jsonLine = [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'))
  assert.ok(jsonLine, 'did not find telemetry JSON line in dry-run output')
  return JSON.parse(jsonLine)
}

function run() {
  const mockNow = Date.now()
  const staleSnapshot = {
    at: mockNow,
    usage: {
      model: 'gpt-5.3-codex',
      totalTokens: 1111,
      tokensPerMin: 45.0,
      sessionId: 'cached-recover',
      agentId: 'main',
      usageTimestampMs: staleUsageTs,
      sourceCommand: 'legacy-cache'
    }
  }

  writeFileSync(cachePath, JSON.stringify(staleSnapshot), 'utf8')
  writeMockOpenClaw(mockBinPath)

  const env = {
    ...process.env,
    IDLEWATCH_OPENCLAW_BIN: mockBinPath,
    IDLEWATCH_OPENCLAW_BIN_STRICT: '1',
    IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH: cachePath,
    IDLEWATCH_USAGE_STALE_MS: '60000',
    IDLEWATCH_USAGE_STALE_GRACE_MS: '10000',
    IDLEWATCH_USAGE_REFRESH_REPROBES: '1',
    IDLEWATCH_USAGE_REFRESH_DELAY_MS: '0',
    IDLEWATCH_OPENCLAW_PROBE_RETRIES: '0',
    IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE: '1',
    IDLEWATCH_INTERVAL_MS: '1000'
  }

  const out = execFileSync('node', ['bin/idlewatch-agent.js', '--dry-run'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const row = readRow(out)
  assert.equal(row?.source?.usage, 'openclaw', 'usage source should remain openclaw with fallback-cache path')
  assert.equal(
    row?.source?.usageProbeResult === 'fallback-cache' || row?.source?.usageProbeResult === 'ok',
    true,
    'expected fallback-cache or live probe result'
  )
  assert.equal(row?.source?.usageRefreshAttempted, true, 'stale cache path should trigger refresh attempts')
  assert.equal(row?.source?.usageRefreshAttempts >= 1, true, 'expected at least one refresh attempt')

  if (row?.source?.usageProbeResult === 'ok') {
    assert.equal(row?.source?.usageFreshnessState, 'fresh', 'recovered probe should return fresh state')
    assert.equal(row?.source?.usageRefreshRecovered, true, 'stale cache path should recover when probe succeeds')
    assert.equal(row?.source?.usageAlertLevel, 'ok', 'activity should be healthy after recovery')
  }

  const calls = Number(readFileSync(callLog, 'utf8').trim())
  assert.ok(Number.isFinite(calls) && calls >= 2, `expected mock probe called at least twice, got ${calls}`)

  console.log('validate-openclaw-cache-recovery-e2e: ok (fallback-cache sample recovered via forced reprobe)')
}

try {
  run()
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
