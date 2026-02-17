#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const appBin = './dist/IdleWatch.app/Contents/MacOS/IdleWatch'
const tempDir = mkdtempSync(join(tmpdir(), 'idlewatch-packaged-recovery-'))
const mockBinPath = join(tempDir, 'openclaw-mock.sh')
const counterPath = join(tempDir, 'counter.txt')

function writeMockOpenClaw(binPath, callCounterPath) {
  const script = `#!/usr/bin/env bash
set -euo pipefail
counter_file="${callCounterPath}"
if [[ ! -f "$counter_file" ]]; then
  echo 0 > "$counter_file"
fi
n=$(cat "$counter_file")
next=$((n + 1))
echo "$next" > "$counter_file"

# First call returns post-threshold age, second call returns fresh age.
if [[ "$n" -eq 0 ]]; then
  age_ms=65000
else
  age_ms=2000
fi

now_ms=$(node -p 'Date.now()')
updated_at=$((now_ms - age_ms))
cat <<JSON
{"sessions":{"defaults":{"model":"gpt-5.3-codex"},"recent":[{"sessionId":"sess-packaged-recovery","agentId":"main","model":"gpt-5.3-codex","totalTokens":99999,"updatedAt":\${updated_at},"totalTokensFresh":true}]},"ts":\${now_ms}}
JSON
`
  writeFileSync(binPath, script, 'utf8')
  chmodSync(binPath, 0o755)
}

function readRow(stdout) {
  const lines = String(stdout).trim().split('\n').map((line) => line.trim()).filter(Boolean)
  const jsonLine = [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'))
  assert.ok(jsonLine, 'did not find telemetry JSON line in packaged dry-run output')
  return JSON.parse(jsonLine)
}

try {
  writeMockOpenClaw(mockBinPath, counterPath)

  execFileSync('npm', ['run', 'package:macos', '--silent'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const env = {
    ...process.env,
    IDLEWATCH_OPENCLAW_BIN: mockBinPath,
    IDLEWATCH_USAGE_STALE_MS: '60000',
    IDLEWATCH_USAGE_STALE_GRACE_MS: '10000',
    IDLEWATCH_USAGE_REFRESH_REPROBES: '1',
    IDLEWATCH_USAGE_REFRESH_DELAY_MS: '0',
    IDLEWATCH_INTERVAL_MS: '1000'
  }

  const out = execFileSync(appBin, ['--dry-run'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const row = readRow(out)
  assert.equal(row?.source?.usageIngestionStatus, 'ok')
  assert.equal(row?.source?.usageRefreshAttempted, true)
  assert.equal(row?.source?.usageRefreshRecovered, true)
  assert.ok((row?.source?.usageRefreshAttempts ?? 0) >= 1, 'expected at least one refresh attempt during recovery pass')
  assert.equal(row?.source?.usageActivityStatus, 'fresh')
  assert.equal(row?.source?.usageAlertLevel, 'ok')
  assert.equal(row?.source?.usageAlertReason, 'healthy')

  const probeCalls = Number(readFileSync(counterPath, 'utf8').trim())
  assert.ok(probeCalls >= 2, `expected mock OpenClaw to be invoked >=2 times, got ${probeCalls}`)

  console.log('packaged-usage-recovery-e2e: ok (post-threshold sample recovered to fresh via forced reprobe)')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
