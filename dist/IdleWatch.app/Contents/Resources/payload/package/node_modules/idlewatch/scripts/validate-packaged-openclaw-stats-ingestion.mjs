#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { readTelemetryJsonRow } from './lib/telemetry-row-parser.mjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const repoRoot = process.cwd()
const rootDir = process.cwd()
const tempDir = mkdtempSync(join(tmpdir(), 'idlewatch-openclaw-stats-pkg-egress-'))
const mockBinPath = join(tempDir, 'openclaw-mock.sh')

function writeMockOpenClaw(pathToScript, shape) {
  const resultCurrent = `{
  "status": {
    "result": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "packaged-stats-session",
            "agentId": "agent-stats-packaged",
            "model": "gpt-5.3-codex",
            "totalTokens": 4242,
            "tokensPerMinute": 12.5,
            "updatedAt": 1771311100000
          }
        }
      }
    }
  },
  "ts": 1771311110000
}`

  const statusCurrent = `{
  "status": {
    "current": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "packaged-status-current-session",
            "agentId": "agent-stats-packaged-current",
            "model": "gpt-5.3-codex-pro",
            "totalTokens": 4096,
            "tokensPerMinute": 15,
            "updatedAt": 1771311900000
          }
        }
      }
    }
  },
  "ts": 1771311910000
}`

  const statusCurrentTsMs = `{
  "status": {
    "current": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "packaged-status-current-tsms-session",
            "agentId": "agent-stats-packaged-tsms",
            "model": "gpt-5.3-codex-pro",
            "totalTokens": 3210,
            "tokensPerMinute": 18,
            "usage_ts_ms": 1771312500000,
            "ts_ms": 1771312501000
        }
      }
    }
  },
  "ts": 1771312510000
}`

  const statusCurrentUsageTs = `{
  "status": {
    "current": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "packaged-status-current-usage-ts",
            "agentId": "agent-stats-packaged-usage-ts",
            "model": "gpt-5.3-codex-pro",
            "totalTokens": 2900,
            "tokensPerMinute": 19,
            "usage_ts": 1771312600000,
            "ts_ms": 1771312601000
        }
      }
    }
  },
  "ts": 1771312610000
}`

  const statusCurrentUsageTimestampMs = `{
  "status": {
    "current": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "packaged-status-current-usage-timestamp-ms",
            "agentId": "agent-stats-packaged-usage-timestamp-ms",
            "model": "qwen-lite-packaged",
            "totalTokens": 2121,
            "tokensPerMinute": 22,
            "usage_timestamp_ms": 1771317000000,
            "ts_ms": 1771317001000
        }
      }
    }
  },
  "ts": 1771317010000
}`

  const statusCurrentUpdatedAtMs = `{
  "status": {
    "current": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "packaged-status-current-updated-at-ms",
            "agentId": "agent-stats-packaged-updated-at-ms",
            "model": "claude-mini-3.8",
            "totalTokens": 777,
            "tokensPerMinute": 21,
            "updated_at_ms": 1771315000000,
            "ts_ms": 1771315001000
        }
      }
    }
  },
  "ts": 1771315010000
}`

  const statusCurrentUsageTimestamp = `{
  "status": {
    "current": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "packaged-status-current-usage-timestamp",
            "agentId": "agent-stats-packaged-usage-timestamp",
            "model": "qwen-lite-packaged",
            "totalTokens": 1919,
            "tokensPerMinute": 12,
            "usage_timestamp": "2026-02-27T09:10:00.000Z",
            "ts_ms": 1771316000000
        }
      }
    }
  },
  "ts": 1771316010000
}`

  const statusCurrentUsageTime = `{
  "status": {
    "current": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "packaged-status-current-usage-time",
            "agentId": "agent-stats-packaged-usage-time",
            "model": "claude-mini-3.8-packaged",
            "totalTokens": 1555,
            "tokensPerMinute": 14,
            "usage_time": "2026-02-27T09:20:00.000Z",
            "ts_ms": 1771317000000
          }
        }
      }
    }
  },
  "ts": 1771317010000
}`

  const statusCurrentUsageTimeCamel = `{
  "status": {
    "current": {
      "stats": {
        "current": {
          "session": {
            "sessionId": "packaged-status-current-usage-time-camel",
            "agentId": "agent-stats-packaged-usage-time-camel",
            "model": "qwen-camel-packaged",
            "totalTokens": 2333,
            "tokensPerMinute": 17,
            "usageTime": "2026-02-27T09:50:00.000Z",
            "ts_ms": 1771319000000
          }
        }
      }
    }
  },
  "ts": 1771319010000
}`

  const script = `#!/usr/bin/env bash
set -euo pipefail

SCENARIO="${shape}"
if [[ "$1" == "stats" && "$2" == "--json" ]]; then
  if [[ "$SCENARIO" == "statusCurrent" ]]; then
    cat <<JSON
${statusCurrent}
JSON
  elif [[ "$SCENARIO" == "statusCurrentTsMs" ]]; then
    cat <<JSON
${statusCurrentTsMs}
JSON
  elif [[ "$SCENARIO" == "statusCurrentUsageTs" ]]; then
    cat <<JSON
${statusCurrentUsageTs}
JSON
  elif [[ "$SCENARIO" == "statusCurrentUsageTimestampMs" ]]; then
    cat <<JSON
${statusCurrentUsageTimestampMs}
JSON
  elif [[ "$SCENARIO" == "statusCurrentUpdatedAtMs" ]]; then
    cat <<JSON
${statusCurrentUpdatedAtMs}
JSON
  elif [[ "$SCENARIO" == "statusCurrentUsageTimestamp" ]]; then
    cat <<JSON
${statusCurrentUsageTimestamp}
JSON
  elif [[ "$SCENARIO" == "statusCurrentUsageTime" ]]; then
    cat <<JSON
${statusCurrentUsageTime}
JSON
  elif [[ "$SCENARIO" == "statusCurrentUsageTimeCamel" ]]; then
    cat <<JSON
${statusCurrentUsageTimeCamel}
JSON
  else
    cat <<JSON
${resultCurrent}
JSON
  fi
  exit 0
fi

if [[ "$1" == "status" || "$1" == "usage" || "$1" == "session" || "$1" == "session_status" ]]; then
  echo '{"message":"legacy status output unavailable"}\n'
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

function collectRow(env) {
  const launcher = join(rootDir, 'dist', 'IdleWatch.app', 'Contents', 'MacOS', 'IdleWatch')
  const out = spawnSync(launcher, ['--dry-run'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 20000,
    env,
    maxBuffer: 8 * 1024 * 1024,
    killSignal: 'SIGINT'
  })

  const output = String(out.stdout || '') + String(out.stderr || '')
  assert.ok(!out.error || out.error.code === 'ETIMEDOUT', `packaged dry-run command failed unexpectedly: ${out.error?.message || `exit ${out.status}`}`)
  assert.equal(out.status, 0, `packaged dry-run exited with ${out.status}`)
  assert.ok(output.trim(), 'packaged dry-run produced no output')
  return readRow(output)
}

function run(shape, expectations) {
  writeMockOpenClaw(mockBinPath, shape)

  const env = {
    ...process.env,
    HOME: process.env.HOME || '',
    IDLEWATCH_OPENCLAW_BIN: mockBinPath,
    IDLEWATCH_OPENCLAW_BIN_STRICT: '1',
    IDLEWATCH_OPENCLAW_USAGE: 'auto',
    IDLEWATCH_OPENCLAW_PROBE_RETRIES: '0',
    IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS: '2000',
    IDLEWATCH_USAGE_STALE_MS: '5000',
    IDLEWATCH_USAGE_NEAR_STALE_MS: '3000',
    IDLEWATCH_USAGE_STALE_GRACE_MS: '1000',
    IDLEWATCH_USAGE_REFRESH_REPROBES: '0',
    IDLEWATCH_USAGE_REFRESH_DELAY_MS: '0',
    IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE: '0',
    IDLEWATCH_REQUIRE_OPENCLAW_USAGE: '1',
    IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS: '5000',
    IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH: join(tempDir, 'openclaw-last-good.json')
  }

  const row = collectRow(env)

  assert.equal(row?.source?.usage, 'openclaw', 'packaged OpenClaw path should emit usage=openclaw')
  assert.equal(row?.source?.usageIngestionStatus, 'ok', 'packaged OpenClaw path should report ingestion ok')
  assert.equal(row?.source?.usageProbeResult, 'ok', 'stats --json fallback path should be accepted as successful probe')
  assert.equal(row?.openclawSessionId, expectations.sessionId)
  assert.equal(row?.openclawAgentId, expectations.agentId)
  assert.equal(row?.openclawTotalTokens, expectations.totalTokens)
  assert.equal(row?.tokensPerMin, expectations.tokensPerMin)
  assert.equal(row?.openclawModel, expectations.model)
  assert.equal(row?.source?.usageCommand?.includes('stats --json'), true, 'OpenClaw command used in packaged run should include stats --json when stats fallback is needed')
  assert.equal(row?.source?.usageProbeAttempts >= 3, true, 'stats fallback should require attempts through multiple commands before success')
  assert.equal(row?.usageProbeError || null, null, 'successful packaged stats fallback should not leak probe error')
}

function runAllShapes() {
  if (process.env.IDLEWATCH_SKIP_PACKAGE_MACOS !== '1') {
    execFileSync('npm', ['run', 'package:macos', '--silent'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  }

  run('resultCurrent', {
    sessionId: 'packaged-stats-session',
    agentId: 'agent-stats-packaged',
    totalTokens: 4242,
    model: 'gpt-5.3-codex',
    tokensPerMin: 12.5
  })

  run('statusCurrent', {
    sessionId: 'packaged-status-current-session',
    agentId: 'agent-stats-packaged-current',
    totalTokens: 4096,
    model: 'gpt-5.3-codex-pro',
    tokensPerMin: 15
  })

  run('statusCurrentTsMs', {
    sessionId: 'packaged-status-current-tsms-session',
    agentId: 'agent-stats-packaged-tsms',
    totalTokens: 3210,
    model: 'gpt-5.3-codex-pro',
    tokensPerMin: 18
  })

  run('statusCurrentUsageTs', {
    sessionId: 'packaged-status-current-usage-ts',
    agentId: 'agent-stats-packaged-usage-ts',
    totalTokens: 2900,
    model: 'gpt-5.3-codex-pro',
    tokensPerMin: 19
  })

  run('statusCurrentUsageTimestampMs', {
    sessionId: 'packaged-status-current-usage-timestamp-ms',
    agentId: 'agent-stats-packaged-usage-timestamp-ms',
    totalTokens: 2121,
    model: 'qwen-lite-packaged',
    tokensPerMin: 22
  })

  run('statusCurrentUsageTimestamp', {
    sessionId: 'packaged-status-current-usage-timestamp',
    agentId: 'agent-stats-packaged-usage-timestamp',
    totalTokens: 1919,
    model: 'qwen-lite-packaged',
    tokensPerMin: 12
  })

  run('statusCurrentUsageTime', {
    sessionId: 'packaged-status-current-usage-time',
    agentId: 'agent-stats-packaged-usage-time',
    totalTokens: 1555,
    model: 'claude-mini-3.8-packaged',
    tokensPerMin: 14
  })

  run('statusCurrentUsageTimeCamel', {
    sessionId: 'packaged-status-current-usage-time-camel',
    agentId: 'agent-stats-packaged-usage-time-camel',
    totalTokens: 2333,
    model: 'qwen-camel-packaged',
    tokensPerMin: 17
  })

  run('statusCurrentUpdatedAtMs', {
    sessionId: 'packaged-status-current-updated-at-ms',
    agentId: 'agent-stats-packaged-updated-at-ms',
    totalTokens: 777,
    model: 'claude-mini-3.8',
    tokensPerMin: 21
  })

  console.log('validate-packaged-openclaw-stats-ingestion: ok (packaged app parses stats fallback across payload shapes)')
}

try {
  runAllShapes()
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
