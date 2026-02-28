import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
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


test('accepts OpenClaw JSON from stderr payload on non-zero-exit command', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-openclaw-stderr-'))
  const mockBin = path.join(tempDir, 'openclaw-mock.sh')

  try {
    writeFileSync(
      mockBin,
      `#!/usr/bin/env bash
set -euo pipefail
echo '{"sessions":{"defaults":{"model":"gpt-5.3-codex"},"recent":[{"sessionId":"stderr-session","agentId":"main","model":"gpt-5.3-codex","totalTokens":12345,"updatedAt":1771280000000,"totalTokensFresh":true}]},"ts":1771280001234}' >&2
exit 42\n`,
      { encoding: 'utf8' }
    )
    chmodSync(mockBin, 0o755)

    const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
      env: {
        ...process.env,
        IDLEWATCH_OPENCLAW_BIN: mockBin,
        IDLEWATCH_OPENCLAW_USAGE: 'auto',
        IDLEWATCH_OPENCLAW_PROBE_RETRIES: '0',
        IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS: '500',
        IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS: '1000',
        IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH: path.join(tempDir, 'openclaw-last-good.json')
      },
      encoding: 'utf8'
    })

    assert.equal(run.status, 0, run.stderr)
    const lines = run.stdout.trim().split('\n').filter(Boolean)
    const jsonLine = [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'))
    assert.ok(jsonLine)
    const payload = JSON.parse(jsonLine)

    assert.equal(payload.source.usage, 'openclaw')
    assert.equal(payload.source.usageProbeResult, 'ok')
    assert.equal(payload.openclawSessionId, 'stderr-session')
    assert.match(payload.source.usageProbeError, /command-exited/)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('accepts OpenClaw JSON from mixed stdout+stderr on non-zero-exit command', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-openclaw-mixed-'))
  const mockBin = path.join(tempDir, 'openclaw-mock.sh')

  try {
    writeFileSync(
      mockBin,
      `#!/usr/bin/env bash
set -euo pipefail
echo 'openclaw wrapper initializing...'
echo '{"sessions":{"defaults":{"model":"gpt-5.3-codex"},"recent":[{"sessionId":"mixed-session","agentId":"main","model":"gpt-5.3-codex","totalTokens":6789,"updatedAt":1771290000000,"totalTokensFresh":true}]},"ts":1771290001234}' >&2
exit 42\n`,
      { encoding: 'utf8' }
    )
    chmodSync(mockBin, 0o755)

    const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
      env: {
        ...process.env,
        IDLEWATCH_OPENCLAW_BIN: mockBin,
        IDLEWATCH_OPENCLAW_USAGE: 'auto',
        IDLEWATCH_OPENCLAW_PROBE_RETRIES: '0',
        IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS: '500',
        IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS: '1000',
        IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH: path.join(tempDir, 'openclaw-last-good.json')
      },
      encoding: 'utf8'
    })

    assert.equal(run.status, 0, run.stderr)
    const lines = run.stdout.trim().split('\n').filter(Boolean)
    const jsonLine = [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'))
    assert.ok(jsonLine)
    const payload = JSON.parse(jsonLine)

    assert.equal(payload.source.usage, 'openclaw')
    assert.equal(payload.source.usageProbeResult, 'ok')
    assert.equal(payload.openclawSessionId, 'mixed-session')
    assert.match(payload.source.usageProbeError, /command-exited/)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('accepts legacy IDLEWATCH_OPENCLAW_BIN_HINT as explicit binary path in strict mode', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-openclaw-bin-hint-'))
  const mockBin = path.join(tempDir, 'openclaw-hint-mock.sh')

  try {
    writeFileSync(
      mockBin,
      `#!/usr/bin/env bash
set -euo pipefail
cat <<'JSON'
{"sessions":{"defaults":{"model":"gpt-5.3-codex"},"recent":[{"sessionId":"hint-session","agentId":"main","model":"gpt-5.3-codex","totalTokens":2222,"updatedAt":1771280100000,"totalTokensFresh":true}]},"ts":1771280100123}
JSON
`,
      { encoding: 'utf8' }
    )
    chmodSync(mockBin, 0o755)

    const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
      env: {
        ...process.env,
        IDLEWATCH_OPENCLAW_BIN: '',
        IDLEWATCH_OPENCLAW_BIN_HINT: mockBin,
        IDLEWATCH_OPENCLAW_BIN_STRICT: '1',
        IDLEWATCH_OPENCLAW_USAGE: 'auto',
        IDLEWATCH_OPENCLAW_PROBE_RETRIES: '0',
        IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS: '500',
        IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS: '1000',
        IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH: path.join(tempDir, 'openclaw-last-good.json')
      },
      encoding: 'utf8'
    })

    assert.equal(run.status, 0, run.stderr)
    const lines = run.stdout.trim().split('\n').filter(Boolean)
    const jsonLine = [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'))
    assert.ok(jsonLine)
    const payload = JSON.parse(jsonLine)

    assert.equal(payload.source.usage, 'openclaw')
    assert.equal(payload.source.usageProbeResult, 'ok')
    assert.equal(payload.source.usageCommand, `${mockBin} status --json`)
    assert.equal(payload.openclawSessionId, 'hint-session')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
