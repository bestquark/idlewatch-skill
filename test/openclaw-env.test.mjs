import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
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

test('accepts explicit IDLEWATCH_OPENCLAW_PROBE_RETRIES in dry-run', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      IDLEWATCH_OPENCLAW_PROBE_RETRIES: '2'
    },
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /idlewatch-agent dry-run/)
})

test('rejects invalid IDLEWATCH_OPENCLAW_PROBE_RETRIES', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      IDLEWATCH_OPENCLAW_PROBE_RETRIES: '-1'
    },
    encoding: 'utf8'
  })

  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /Invalid IDLEWATCH_OPENCLAW_PROBE_RETRIES/)
})

test('accepts explicit IDLEWATCH_USAGE_REFRESH_REPROBES in dry-run', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      IDLEWATCH_USAGE_REFRESH_REPROBES: '3'
    },
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /idlewatch-agent dry-run/)
})

test('rejects invalid IDLEWATCH_USAGE_REFRESH_REPROBES', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      IDLEWATCH_USAGE_REFRESH_REPROBES: '-1'
    },
    encoding: 'utf8'
  })

  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /Invalid IDLEWATCH_USAGE_REFRESH_REPROBES/)
})

test('accepts explicit IDLEWATCH_USAGE_REFRESH_DELAY_MS in dry-run', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      IDLEWATCH_USAGE_REFRESH_DELAY_MS: '500'
    },
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /idlewatch-agent dry-run/)
})

test('rejects invalid IDLEWATCH_USAGE_REFRESH_DELAY_MS', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      IDLEWATCH_USAGE_REFRESH_DELAY_MS: '-5'
    },
    encoding: 'utf8'
  })

  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /Invalid IDLEWATCH_USAGE_REFRESH_DELAY_MS/)
})

test('accepts Firestore emulator mode without service account credentials', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      FIREBASE_PROJECT_ID: 'idlewatch-dev',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      FIREBASE_SERVICE_ACCOUNT_JSON: '',
      FIREBASE_SERVICE_ACCOUNT_B64: ''
    },
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /idlewatch-agent dry-run/)
  assert.match(run.stdout, /firebase=true/)
})

test('rejects emulator mode when FIREBASE_PROJECT_ID is missing', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      FIREBASE_PROJECT_ID: '',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080'
    },
    encoding: 'utf8'
  })

  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /FIREBASE_PROJECT_ID is missing/)
})

test('rejects required Firebase writes when Firebase is not configured', () => {
  const run = spawnSync(process.execPath, [BIN, '--once'], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      IDLEWATCH_REQUIRE_FIREBASE_WRITES: '1',
      FIREBASE_PROJECT_ID: '',
      FIRESTORE_EMULATOR_HOST: '',
      FIREBASE_SERVICE_ACCOUNT_JSON: '',
      FIREBASE_SERVICE_ACCOUNT_B64: ''
    },
    encoding: 'utf8'
  })

  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /IDLEWATCH_REQUIRE_FIREBASE_WRITES=1 requires Firebase to be configured/)
})

test('accepts required Firebase writes config in emulator mode (dry-run)', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      IDLEWATCH_REQUIRE_FIREBASE_WRITES: '1',
      FIREBASE_PROJECT_ID: 'idlewatch-dev',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      FIREBASE_SERVICE_ACCOUNT_JSON: '',
      FIREBASE_SERVICE_ACCOUNT_B64: ''
    },
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /idlewatch-agent dry-run/)
  assert.match(run.stdout, /firebase=true/)
})

test('accepts FIREBASE_SERVICE_ACCOUNT_FILE credentials', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-creds-file-'))
  const credsPath = path.join(tmpRoot, 'service-account.json')

  try {
    fs.writeFileSync(credsPath, JSON.stringify({
      type: 'service_account',
      project_id: 'idlewatch-test',
      private_key_id: 'abc123',
      private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
      client_email: 'idlewatch@idlewatch-test.iam.gserviceaccount.com',
      client_id: '123'
    }))

    const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
      env: {
        ...process.env,
        IDLEWATCH_OPENCLAW_USAGE: 'off',
        FIREBASE_PROJECT_ID: 'idlewatch-test',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        FIREBASE_SERVICE_ACCOUNT_FILE: credsPath,
        FIREBASE_SERVICE_ACCOUNT_JSON: '',
        FIREBASE_SERVICE_ACCOUNT_B64: ''
      },
      encoding: 'utf8'
    })

    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /idlewatch-agent dry-run/)
    assert.match(run.stdout, /firebase=true/)
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }
})
