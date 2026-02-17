import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BIN = path.resolve(__dirname, '../bin/idlewatch-agent.js')

test('accepts explicit IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS in dry-run', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS: '60000'
    },
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /idlewatch-agent dry-run/)
})

test('rejects invalid IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS: '0'
    },
    encoding: 'utf8'
  })

  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /Invalid IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS/)
})
