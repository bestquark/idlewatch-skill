#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { readTelemetryJsonRow } from './lib/telemetry-row-parser.mjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const tempDir = mkdtempSync(join(tmpdir(), 'idlewatch-openclaw-usage-health-'))
const mockBinPath = join(tempDir, 'openclaw-mock.sh')

function writeMockOpenClaw(pathToScript) {
  const script = `#!/usr/bin/env bash
set -euo pipefail
NOW_MS="$(node -e "console.log(Date.now())")"

if [[ "$1" == "usage" || "$1" == "status" || "$1" == "session" || "$1" == "session_status" ]]; then
  cat <<JSON
{
  "status": {
    "result": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "health-session",
            "agentId": "agent-health",
            "model": "gpt-5.3-codex-health",
            "totalTokens": 3333,
            "tokensPerMinute": 11.11,
            "updatedAt": ${'$'}NOW_MS
          }
        }
      }
    }
  }
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

function readRow(output) {
  return readTelemetryJsonRow(output)
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

  assert.equal(row?.source?.usage, 'openclaw', 'usage should be sourced from openclaw')
  assert.equal(row?.source?.usageIngestionStatus, 'ok', 'usage ingestion should be healthy')
  assert.equal(row?.source?.usageProbeResult, 'ok', 'usage probe should succeed')
  assert.ok(row?.source?.usageIntegrationStatus === 'ok' || row?.source?.usageIntegrationStatus === 'aging', 'usage integration should be ok/aging')
  assert.equal(row?.openclawSessionId, 'health-session')
  assert.equal(row?.openclawModel, 'gpt-5.3-codex-health')
  assert.equal(row?.openclawAgentId, 'agent-health')
  assert.equal(row?.openclawTotalTokens, 3333)
  assert.equal(row?.tokensPerMin, 11.11)
  assert.ok(Number(row?.openclawUsageTs) > Date.now() - 120000, 'usage timestamp should be recent')

  console.log('validate-openclaw-usage-health: ok (openclaw usage source required and healthy)')
}

try {
  run()
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
