import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(process.cwd())

function runDryRunSchemaWithOpenClawMode(mode) {
  const result = spawnSync(process.execPath, [
    path.join(root, 'scripts', 'validate-dry-run-schema.mjs'),
    process.execPath,
    path.join(root, 'bin', 'idlewatch-agent.js'),
    '--dry-run'
  ], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: mode,
      IDLEWATCH_DRY_RUN_TIMEOUT_MS: '5000',
      IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS: '2500',
      IDLEWATCH_OPENCLAW_PROBE_RETRIES: '1'
    },
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, `dry-run schema validation failed for mode=${mode}: ${result.stderr || result.stdout}`)
}

test('validate dry-run schema passes with OpenClaw usage disabled', () => {
  runDryRunSchemaWithOpenClawMode('off')
})
