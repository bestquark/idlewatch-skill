#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const tempDir = mkdtempSync(join(tmpdir(), 'idlewatch-openclaw-stats-egress-'))
const mockBinPath = join(tempDir, 'openclaw-mock.sh')

function writeMockOpenClaw(pathToScript) {
  const script = `#!/usr/bin/env bash
set -euo pipefail

if [[ "$1" == "usage" || "$1" == "status" || "$1" == "session" || "$1" == "session_status" ]]; then
  echo '{"message":"legacy status output unavailable"}\n'
  exit 0
fi

if [[ "$1" == "stats" ]]; then
  cat <<JSON
{
  "status": {
    "result": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "mock-stats-session",
            "agentId": "agent-stats-mock",
            "model": "gpt-5.3-codex",
            "totalTokens": 6789,
            "tokensPerMinute": 33.25,
            "updatedAt": 1771304100000
          }
        }
      }
    }
  },
  "ts": 1771304200000
}
JSON
  exit 0
fi

echo '{"error":"unsupported command"}'
exit 2
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
  assert.ok(jsonLine, 'did not find telemetry JSON line in dry-run output')
  return JSON.parse(jsonLine)
}

function run() {
  writeMockOpenClaw(mockBinPath)

  const env = {
    ...process.env,
    IDLEWATCH_OPENCLAW_BIN: mockBinPath,
    IDLEWATCH_OPENCLAW_BIN_STRICT: '1',
    IDLEWATCH_OPENCLAW_PROBE_RETRIES: '0',
    IDLEWATCH_USAGE_STALE_MS: '60000',
    IDLEWATCH_USAGE_STALE_GRACE_MS: '10000',
    IDLEWATCH_USAGE_REFRESH_REPROBES: '0',
    IDLEWATCH_INTERVAL_MS: '1000',
    IDLEWATCH_OPENCLAW_USAGE: 'auto'
  }

  const out = execFileSync('node', ['bin/idlewatch-agent.js', '--dry-run'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const row = readRow(out)
  assert.equal(row?.source?.usage, 'openclaw', 'usage should be sourced from openclaw when stats fallback is used')
  assert.equal(row?.source?.usageIngestionStatus, 'ok', 'stats fallback should still be ingestion-healthy')
  assert.equal(row?.source?.usageProbeResult, 'ok', 'stats command should succeed')
  assert.equal(row?.source?.usageProbeAttempts >= 3, true, 'stats fallback path should have attempted several commands')
  assert.equal(row?.source?.usageCommand.includes('stats --json'), true, 'stats command should be selected after fallback')
  assert.equal(row?.openclawSessionId, 'mock-stats-session')
  assert.equal(row?.openclawTotalTokens, 6789)
  assert.equal(row?.openclawAgentId, 'agent-stats-mock')
  assert.equal(row?.tokensPerMin, 33.25)
  assert.equal(row?.usageProbeError || null, null)

  console.log('validate-openclaw-stats-ingestion: ok (stats-only command path parsed and ingested)')
}

try {
  run()
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
