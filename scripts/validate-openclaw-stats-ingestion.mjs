#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { readTelemetryJsonRow } from './lib/telemetry-row-parser.mjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const tempDir = mkdtempSync(join(tmpdir(), 'idlewatch-openclaw-stats-egress-'))
const mockBinPath = join(tempDir, 'openclaw-mock.sh')

function writeMockOpenClaw(pathToScript, shape) {
  const resultCurrent = `{
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
}`

  const statusCurrent = `{
  "status": {
    "current": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "status-current-session",
            "agentId": "agent-stats-status-current",
            "model": "gpt-5.3-codex-pro",
            "totalTokens": 2048,
            "tokensPerMinute": 42,
            "updatedAt": 1771304500000
          }
        }
      }
    }
  },
  "ts": 1771304600000
}`

  const statusCurrentTsMs = `{
  "status": {
    "current": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "status-current-ts-ms",
            "agentId": "agent-stats-ts-ms",
            "model": "gpt-5.3-codex",
            "totalTokens": 4096,
            "tokensPerMinute": 64,
            "usage_ts_ms": 1771306600000
          }
        }
      }
    }
  },
  "ts": 1771306700000
}`

  const statusCurrentUsageTimestampMs = `{
  "status": {
    "current": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "status-current-usage-ts-ms",
            "agentId": "agent-stats-usage-ts-ms",
            "model": "qwen3",
            "totalTokens": 512,
            "tokensPerMinute": 16,
            "usage_timestamp_ms": 1771308800000
          }
        }
      }
    }
  },
  "ts": 1771308900000
}`

  const script = `#!/usr/bin/env bash
set -euo pipefail

SCENARIO="${shape}"
if [[ "$1" == "usage" || "$1" == "status" || "$1" == "session" || "$1" == "session_status" ]]; then
  echo '{"message":"legacy status output unavailable"}\n'
  exit 0
fi

if [[ "$1" == "stats" ]]; then
  if [[ "$SCENARIO" == "statusCurrent" ]]; then
    cat <<JSON
${statusCurrent}
JSON
  elif [[ "$SCENARIO" == "statusCurrentTsMs" ]]; then
    cat <<JSON
${statusCurrentTsMs}
JSON
  elif [[ "$SCENARIO" == "statusCurrentUsageTimestampMs" ]]; then
    cat <<JSON
${statusCurrentUsageTimestampMs}
JSON
  else
    cat <<JSON
${resultCurrent}
JSON
  fi
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

function run(shape, expectations) {
  writeMockOpenClaw(mockBinPath, shape)

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
  assert.equal(row?.source?.usageIngestionStatus, 'ok', 'usage ingestion should remain healthy')
  assert.equal(row?.source?.usageProbeResult, 'ok', 'stats command should succeed')
  assert.equal(row?.source?.usageProbeAttempts >= 3, true, 'stats fallback path should have attempted several commands')
  assert.equal(row?.source?.usageCommand.includes('stats --json'), true, 'stats command should be selected after fallback attempts')
  assert.equal(row?.openclawSessionId, expectations.sessionId)
  assert.equal(row?.openclawAgentId, expectations.agentId)
  assert.equal(row?.openclawTotalTokens, expectations.totalTokens)
  assert.equal(row?.openclawModel, expectations.model)
  assert.equal(row?.tokensPerMin, expectations.tokensPerMin)
  assert.equal(row?.source?.usageProbeError || null, null)
}

function runAllShapes() {
  run('resultCurrent', {
    sessionId: 'mock-stats-session',
    agentId: 'agent-stats-mock',
    totalTokens: 6789,
    model: 'gpt-5.3-codex',
    tokensPerMin: 33.25
  })

  run('statusCurrent', {
    sessionId: 'status-current-session',
    agentId: 'agent-stats-status-current',
    totalTokens: 2048,
    model: 'gpt-5.3-codex-pro',
    tokensPerMin: 42
  })

  run('statusCurrentTsMs', {
    sessionId: 'status-current-ts-ms',
    agentId: 'agent-stats-ts-ms',
    totalTokens: 4096,
    model: 'gpt-5.3-codex',
    tokensPerMin: 64
  })

  run('statusCurrentUsageTimestampMs', {
    sessionId: 'status-current-usage-ts-ms',
    agentId: 'agent-stats-usage-ts-ms',
    totalTokens: 512,
    model: 'qwen3',
    tokensPerMin: 16
  })

  console.log('validate-openclaw-stats-ingestion: ok (stats-only command path parsed and ingested across multiple payload shapes)')
}

try {
  runAllShapes()
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
