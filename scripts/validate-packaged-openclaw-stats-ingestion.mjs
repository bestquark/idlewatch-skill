#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const repoRoot = process.cwd()
const rootDir = process.cwd()
const tempDir = mkdtempSync(join(tmpdir(), 'idlewatch-openclaw-stats-pkg-egress-'))
const mockBinPath = join(tempDir, 'openclaw-mock.sh')

function writeMockOpenClaw(pathToScript) {
  const script = `#!/usr/bin/env bash
set -euo pipefail

if [[ "$1" == "stats" && "$2" == "--json" ]]; then
  cat <<JSON
{
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
        },
        "totals": {
          "model": "ignored"
        }
      }
    }
  },
  "ts": 1771311110000
}
JSON
  exit 0
fi

if [[ "$1" == "status" || "$1" == "usage" || "$1" == "session" || "$1" == "session_status" ]]; then
  echo '{"status":"unsupported-command"}\n'
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
  assert.ok(jsonLine, 'did not capture telemetry JSON from packaged dry-run output')
  return JSON.parse(jsonLine)
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

function run() {
  execFileSync('npm', ['run', 'package:macos', '--silent'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  writeMockOpenClaw(mockBinPath)

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
  assert.equal(row?.openclawSessionId, 'packaged-stats-session')
  assert.equal(row?.openclawAgentId, 'agent-stats-packaged')
  assert.equal(row?.openclawTotalTokens, 4242)
  assert.equal(row?.tokensPerMin, 12.5)
  assert.equal(row?.openclawModel, 'gpt-5.3-codex')
  assert.equal(row?.source?.usageCommand?.includes('stats --json'), true, 'OpenClaw command used in packaged run should include stats --json when stats fallback is needed')
  assert.equal(row?.source?.usageProbeAttempts >= 3, true, 'stats fallback should require attempts through multiple commands before success')
  assert.equal(row?.source?.usageProbeError, null, 'successful packaged stats fallback should not leak probe error')

  console.log('validate-packaged-openclaw-stats-ingestion: ok (packaged launcher can ingest via stats fallback command)')
}

try {
  run()
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
