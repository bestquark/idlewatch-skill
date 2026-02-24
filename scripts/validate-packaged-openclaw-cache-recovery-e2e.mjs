#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const repoRoot = process.cwd()
const rootDir = process.cwd()
const tempDir = mkdtempSync(join(tmpdir(), 'idlewatch-openclaw-cache-recover-pkg-'))
const mockBinPath = join(tempDir, 'openclaw-mock.sh')
const callLog = join(tempDir, 'calls.txt')
const cachePath = join(tempDir, 'openclaw-last-good.json')

function writeMockOpenClaw(pathToScript) {
  const script = `#!/usr/bin/env bash
set -euo pipefail

calls_file="${callLog}"
if [[ ! -f "$calls_file" ]]; then
  echo 0 > "$calls_file"
fi

n=$(cat "$calls_file")
next=$((n + 1))
echo "$next" > "$calls_file"

if [[ "$n" -lt 7 ]]; then
  echo "temporary probe failure \$n" >&2
  exit 1
fi

now_ms=$(($(date +%s) * 1000))
updated_at=$((now_ms - 1500))
cat <<JSON
{
  "sessions": {
    "recent": [
      {
        "sessionId": "cached-recover-packaged",
        "agentId": "agent-cache-pkg",
        "model": "gpt-5.3-codex",
        "totalTokens": 9090,
        "updatedAt": $updated_at,
        "updated_at": $updated_at
      }
    ]
  },
  "ts": $now_ms
}
JSON
`
  writeFileSync(pathToScript, script, 'utf8')
  chmodSync(pathToScript, 0o755)
}

function readRow(stdout) {
  const lines = String(stdout)
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const jsonLine = [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'))
  assert.ok(jsonLine, 'did not capture telemetry JSON from packaged dry-run output')
  return JSON.parse(jsonLine)
}

function collectRow(env) {
  const launcher = join(rootDir, 'dist', 'IdleWatch.app', 'Contents', 'MacOS', 'IdleWatch')
  const out = spawnSync(launcher, ['--dry-run'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 25000,
    env,
    maxBuffer: 16 * 1024 * 1024,
    killSignal: 'SIGINT'
  })

  const output = String(out.stdout || '') + String(out.stderr || '')
  assert.equal(out.status, 0, `packaged dry-run exited with ${out.status}`)
  assert.ok(output.trim(), 'packaged dry-run produced no output')
  return readRow(output)
}

function run() {
  const nowMs = Date.now()
  const staleAgeMs = 90000

  execFileSync('npm', ['run', 'package:macos', '--silent'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  writeMockOpenClaw(mockBinPath)

  const staleSnapshot = {
    at: nowMs,
    usage: {
      model: 'gpt-5.3-codex',
      totalTokens: 8080,
      tokensPerMin: 18.2,
      sessionId: 'cached-recover-packaged',
      agentId: 'agent-cache-pkg',
      usageTimestampMs: nowMs - staleAgeMs,
      sourceCommand: 'cached-recovery-stale'
    }
  }
  writeFileSync(cachePath, JSON.stringify(staleSnapshot), 'utf8')
  writeFileSync(callLog, '0', 'utf8')

  const env = {
    ...process.env,
    HOME: process.env.HOME || '',
    IDLEWATCH_OPENCLAW_BIN: mockBinPath,
    IDLEWATCH_OPENCLAW_BIN_STRICT: '1',
    IDLEWATCH_OPENCLAW_PROBE_RETRIES: '0',
    IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH: cachePath,
    IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS: '120000',
    IDLEWATCH_USAGE_STALE_MS: '30000',
    IDLEWATCH_USAGE_NEAR_STALE_MS: '15000',
    IDLEWATCH_USAGE_STALE_GRACE_MS: '3000',
    IDLEWATCH_USAGE_REFRESH_REPROBES: '4',
    IDLEWATCH_USAGE_REFRESH_DELAY_MS: '20',
    IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE: '1',
    IDLEWATCH_INTERVAL_MS: '1000',
    IDLEWATCH_OPENCLAW_USAGE: 'auto',
    IDLEWATCH_REQUIRE_OPENCLAW_USAGE: '1'
  }

  const row = collectRow(env)

  assert.equal(row?.source?.usage, 'openclaw', 'usage source should remain openclaw during packaged cache recovery')
  assert.equal(row?.source?.usageProbeAttempts >= 1, true, 'probe attempts should run for refresh path')
  assert.equal(row?.source?.usageRefreshAttempted, true, 'packaged stale recovery should attempt refresh')
  assert.equal(row?.source?.usageRefreshAttempts >= 1, true, 'at least one refresh reprobe attempt should run after stale cache')
  assert.equal(row?.source?.usageRefreshRecovered, true, 'stale packaged cache should recover after successful reprobe')
  assert.equal(row?.source?.usageProbeResult, 'ok', 'final usage probe result should be ok after recovery')
  assert.equal(row?.source?.usageFreshnessState, 'fresh', 'usage should be fresh after successful recovery')
  assert.equal(row?.source?.usageAlertLevel, 'ok', 'usage alert should settle to ok after recovery')
  assert.equal(row?.openclawSessionId, 'cached-recover-packaged')
  assert.equal(row?.openclawAgentId, 'agent-cache-pkg')
  assert.equal(row?.openclawTotalTokens, 9090)
  assert.equal(row?.source?.usageCommand?.includes('--json') || row?.source?.usageCommand?.includes('status'), true, 'command path should be OpenClaw command text')

  const calls = Number(readFileSync(callLog, 'utf8').trim())
  assert.ok(Number.isFinite(calls) && calls >= 3, `expected at least 3 probe calls, got ${calls}`)

  console.log('validate-packaged-openclaw-cache-recovery-e2e: ok (packaged stale cache recovers through reprobe attempts)')
}

try {
  run()
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
