#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { readTelemetryJsonRow } from './lib/telemetry-row-parser.mjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const appBin = './dist/IdleWatch.app/Contents/MacOS/IdleWatch'
const tempDir = mkdtempSync(join(tmpdir(), 'idlewatch-packaged-probe-noise-'))
const mockBinPath = join(tempDir, 'openclaw-mock.sh')

function writeMockOpenClaw(binPath) {
  const script = `#!/usr/bin/env bash
set -euo pipefail
age_ms="\${MOCK_OPENCLAW_AGE_MS:-500}"
exit_code="\${MOCK_OPENCLAW_EXIT_CODE:-3}"

now_ms=$(node -p 'Date.now()')
updated_at=$((now_ms - age_ms))

cat <<JSON
{"sessions":{"defaults":{"model":"gpt-5.3-codex"},"recent":[{"sessionId":"sess-packaged-noise","agentId":"main","model":"gpt-5.3-codex","totalTokens":54321,"updatedAt":\${updated_at},"totalTokensFresh":true}]},"ts":\${now_ms}}
JSON

echo "openclaw status probe complete (simulated warning)." >&2
exit "\${exit_code}"
`
  writeFileSync(binPath, script, 'utf8')
  chmodSync(binPath, 0o755)
}

function readRow(output) {
  return readTelemetryJsonRow(output)
}

try {
  writeMockOpenClaw(mockBinPath)

  execFileSync('npm', ['run', 'package:macos', '--silent'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const env = {
    ...process.env,
    IDLEWATCH_OPENCLAW_BIN: mockBinPath,
    IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS: '2500',
    IDLEWATCH_OPENCLAW_PROBE_RETRIES: '0',
    IDLEWATCH_USAGE_STALE_MS: '60000',
    IDLEWATCH_USAGE_STALE_GRACE_MS: '10000',
    IDLEWATCH_USAGE_REFRESH_REPROBES: '0',
    IDLEWATCH_OPENCLAW_USAGE: 'auto',
    MOCK_OPENCLAW_AGE_MS: '500',
    MOCK_OPENCLAW_EXIT_CODE: '3'
  }

  const out = execFileSync(appBin, ['--dry-run'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const row = readRow(out)
  const source = row.source

  assert.equal(source.usage, 'openclaw')
  assert.equal(source.usageIngestionStatus, 'ok')
  assert.equal(source.usageProbeResult, 'ok')
  assert.equal(
    typeof source.usageProbeError === 'string' &&
      (source.usageProbeError.includes('non-zero') || source.usageProbeError.includes('command-exited')),
    true
  )
  assert.ok(source.usageCommand.includes('openclaw-mock.sh status --json'))
  assert.equal(source.usageIntegrationStatus, 'ok')
  assert.equal(source.usageAlertReason, 'healthy')
  assert.equal(row.openclawSessionId, 'sess-packaged-noise')
  assert.equal(row.openclawTotalTokens, 54321)

  console.log('packaged-usage-probe-noise-e2e: ok (non-zero exit with valid JSON still ingested)')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
