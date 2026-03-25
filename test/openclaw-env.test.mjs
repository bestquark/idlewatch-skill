import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BIN = path.resolve(__dirname, '../bin/idlewatch-agent.js')
const BIN_DISPLAY = path.relative(process.cwd(), BIN) || BIN
const SOURCE_CMD = `node ${BIN_DISPLAY}`

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

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
  assert.match(run.stdout, /Sample collected.*dry run/)
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
  assert.match(run.stdout, /Sample collected.*dry run/)
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
  assert.match(run.stdout, /Sample collected.*dry run/)
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
  assert.match(run.stdout, /Sample collected.*dry run/)
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
      HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-firebase-home-')),
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      FIREBASE_PROJECT_ID: 'idlewatch-dev',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      FIREBASE_SERVICE_ACCOUNT_JSON: '',
      FIREBASE_SERVICE_ACCOUNT_B64: '',
      IDLEWATCH_CLOUD_INGEST_URL: '',
      IDLEWATCH_CLOUD_API_KEY: ''
    },
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /Sample collected.*dry run/)
  assert.match(run.stdout, /firebase mode/)
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

test('keeps plain dry-run output local-only without Firebase warning noise', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-dry-run-home-')),
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      FIREBASE_PROJECT_ID: '',
      FIRESTORE_EMULATOR_HOST: '',
      FIREBASE_SERVICE_ACCOUNT_JSON: '',
      FIREBASE_SERVICE_ACCOUNT_B64: '',
      IDLEWATCH_CLOUD_INGEST_URL: '',
      IDLEWATCH_CLOUD_API_KEY: ''
    },
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.doesNotMatch(run.stderr, /Firebase is not configured/)
  assert.doesNotMatch(run.stderr, /No publish target is configured yet/)
  assert.match(run.stdout, /Sample collected.*dry run/)
  assert.match(run.stdout, /local-only mode/)
  assert.doesNotMatch(run.stdout, /firebase/)
})

test('help keeps the happy path above advanced env tuning noise', () => {
  const run = spawnSync(process.execPath, [BIN, '--help'], {
    env: process.env,
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /Get started:/)
  assert.match(run.stdout, /quickstart/)
  assert.match(run.stdout, /--dry-run/)
  assert.match(run.stdout, /--once/)
  assert.match(run.stdout, /--test-publish/)
})

test('--test-publish aliases to one-shot publish mode', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-test-publish-home-'))
  const envDir = path.join(tempHome, '.idlewatch')
  fs.mkdirSync(envDir, { recursive: true })
  fs.writeFileSync(path.join(envDir, 'idlewatch.env'), [
    'IDLEWATCH_DEVICE_NAME=Alias Box',
    'IDLEWATCH_DEVICE_ID=alias-box',
    'IDLEWATCH_MONITOR_TARGETS=cpu,memory',
    'IDLEWATCH_OPENCLAW_USAGE=off'
  ].join('\n') + '\n')

  const run = spawnSync(process.execPath, [BIN, '--test-publish'], {
    env: {
      ...process.env,
      HOME: tempHome
    },
    encoding: 'utf8',
    timeout: 15000
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /Sample collected/)
  assert.match(run.stdout, /local-only mode/)
})

test('uses cloud publish label for once mode when cloud ingest config is active', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-cloud-once-home-'))
  const envDir = path.join(tempHome, '.idlewatch')
  fs.mkdirSync(envDir, { recursive: true })
  fs.writeFileSync(path.join(envDir, 'idlewatch.env'), [
    'IDLEWATCH_DEVICE_NAME=QA Box',
    'IDLEWATCH_DEVICE_ID=qa-box',
    'IDLEWATCH_CLOUD_API_KEY=iwk_invalidexample1234567890',
    'IDLEWATCH_CLOUD_INGEST_URL=http://127.0.0.1:1/api/ingest',
    'IDLEWATCH_MONITOR_TARGETS=cpu,memory',
    'IDLEWATCH_OPENCLAW_USAGE=off'
  ].join('\n'))

  const run = spawnSync(process.execPath, [BIN, '--once'], {
    env: {
      ...process.env,
      HOME: tempHome,
      FIREBASE_PROJECT_ID: '',
      FIRESTORE_EMULATOR_HOST: '',
      FIREBASE_SERVICE_ACCOUNT_JSON: '',
      FIREBASE_SERVICE_ACCOUNT_B64: ''
    },
    encoding: 'utf8',
    timeout: 15000
  })

  assert.match(run.stdout, /cloud mode/)
  assert.doesNotMatch(run.stdout, /firebase/)
})

test('accepts required Firebase writes config in emulator mode (dry-run)', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-firebase-required-home-')),
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      IDLEWATCH_REQUIRE_FIREBASE_WRITES: '1',
      FIREBASE_PROJECT_ID: 'idlewatch-dev',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      FIREBASE_SERVICE_ACCOUNT_JSON: '',
      FIREBASE_SERVICE_ACCOUNT_B64: '',
      IDLEWATCH_CLOUD_INGEST_URL: '',
      IDLEWATCH_CLOUD_API_KEY: ''
    },
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /Sample collected.*dry run/)
  assert.match(run.stdout, /firebase mode/)
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
        HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-creds-home-')),
        IDLEWATCH_OPENCLAW_USAGE: 'off',
        FIREBASE_PROJECT_ID: 'idlewatch-test',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        FIREBASE_SERVICE_ACCOUNT_FILE: credsPath,
        FIREBASE_SERVICE_ACCOUNT_JSON: '',
        FIREBASE_SERVICE_ACCOUNT_B64: '',
        IDLEWATCH_CLOUD_INGEST_URL: '',
        IDLEWATCH_CLOUD_API_KEY: ''
      },
      encoding: 'utf8'
    })

    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /Sample collected.*dry run/)
    assert.match(run.stdout, /firebase mode/)
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }
})


test('quickstart local mode does not leak stale cloud env into required once test', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-local-quickstart-home-'))
  const idlewatchDir = path.join(tempHome, '.idlewatch')
  fs.mkdirSync(idlewatchDir, { recursive: true })
  fs.writeFileSync(path.join(idlewatchDir, 'idlewatch.env'), [
    'IDLEWATCH_DEVICE_NAME=Old Cloud Box',
    'IDLEWATCH_DEVICE_ID=old-cloud-box',
    'IDLEWATCH_CLOUD_API_KEY=iwk_invalidexample1234567890',
    'IDLEWATCH_CLOUD_INGEST_URL=https://idlewatch.com/api/ingest',
    'IDLEWATCH_REQUIRE_CLOUD_WRITES=1',
    'IDLEWATCH_MONITOR_TARGETS=cpu,memory',
    'IDLEWATCH_OPENCLAW_USAGE=off'
  ].join('\n'))

  const run = spawnSync(process.execPath, [BIN, 'quickstart'], {
    env: {
      ...process.env,
      HOME: tempHome,
      IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
      IDLEWATCH_ENROLL_MODE: 'local'
    },
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /✅ Setup complete/)
  assert.match(run.stdout, /Local telemetry verified/)
  assert.doesNotMatch(run.stdout, /Initial telemetry sample sent successfully\./)
  assert.match(run.stderr, /Running in local-only mode/)
  assert.doesNotMatch(run.stderr, /Firebase\/emulator mode if you need that path/)
  assert.doesNotMatch(run.stdout + run.stderr, /publish=cloud/)
  assert.doesNotMatch(run.stdout + run.stderr, /Cloud ingest disabled:/)

  const savedEnv = fs.readFileSync(path.join(idlewatchDir, 'idlewatch.env'), 'utf8')
  assert.doesNotMatch(savedEnv, /IDLEWATCH_CLOUD_API_KEY=/)
  assert.doesNotMatch(savedEnv, /IDLEWATCH_CLOUD_INGEST_URL=/)
})

test('quickstart honors IDLEWATCH_ENROLL_DEVICE_NAME in non-interactive mode', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-enroll-device-name-home-'))
  const idlewatchDir = path.join(tempHome, '.idlewatch')
  fs.mkdirSync(idlewatchDir, { recursive: true })
  fs.writeFileSync(path.join(idlewatchDir, 'idlewatch.env'), [
    'IDLEWATCH_DEVICE_NAME=Old Cloud Box',
    'IDLEWATCH_DEVICE_ID=old-cloud-box',
    'IDLEWATCH_MONITOR_TARGETS=cpu,memory',
    'IDLEWATCH_OPENCLAW_USAGE=off'
  ].join('\n'))

  const run = spawnSync(process.execPath, [BIN, 'quickstart'], {
    env: {
      ...process.env,
      HOME: tempHome,
      IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
      IDLEWATCH_ENROLL_MODE: 'local',
      IDLEWATCH_ENROLL_DEVICE_NAME: 'Now Local Box'
    },
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /Now Local Box/)

  const savedEnv = fs.readFileSync(path.join(idlewatchDir, 'idlewatch.env'), 'utf8')
  assert.match(savedEnv, /IDLEWATCH_DEVICE_NAME=Now Local Box/)
  assert.match(savedEnv, /IDLEWATCH_DEVICE_ID=now-local-box/)
})

test('quickstart does not fall back to the text wizard after a TUI run already wrote config', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-tui-handoff-home-'))
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-tui-handoff-root-'))
  const fakeTui = path.join(tempRoot, 'fake-tui.sh')
  const configDir = path.join(tempHome, '.idlewatch')

  writeFileSync(fakeTui, `#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$IDLEWATCH_ENROLL_CONFIG_DIR/logs" "$IDLEWATCH_ENROLL_CONFIG_DIR/cache"
cat > "$IDLEWATCH_ENROLL_OUTPUT_ENV_FILE" <<EOF
# Generated by fake tui
IDLEWATCH_DEVICE_NAME=TUI Box
IDLEWATCH_DEVICE_ID=tui-box
IDLEWATCH_MONITOR_TARGETS=cpu,memory
IDLEWATCH_OPENCLAW_USAGE=off
IDLEWATCH_LOCAL_LOG_PATH=$IDLEWATCH_ENROLL_CONFIG_DIR/logs/tui-box-metrics.ndjson
IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH=$IDLEWATCH_ENROLL_CONFIG_DIR/cache/tui-box-openclaw-last-good.json
EOF
exit 7
`, { encoding: 'utf8' })
  chmodSync(fakeTui, 0o755)

  try {
    const run = spawnSync(process.execPath, [BIN, 'quickstart'], {
      env: {
        ...process.env,
        HOME: tempHome,
        IDLEWATCH_TUI_BIN: fakeTui
      },
      input: '2\n\n\n',
      encoding: 'utf8',
      timeout: 15000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /✅ Setup complete/)
    assert.match(run.stdout, /TUI Box/)
    assert.doesNotMatch(run.stdout + run.stderr, /Mode \[1\/2\]/)
    assert.doesNotMatch(run.stdout + run.stderr, /Cloud API key:/)
    assert.doesNotMatch(run.stdout + run.stderr, /Monitor targets \[/)

    const savedEnv = fs.readFileSync(path.join(configDir, 'idlewatch.env'), 'utf8')
    assert.match(savedEnv, /IDLEWATCH_DEVICE_NAME=TUI Box/)
    assert.match(savedEnv, /IDLEWATCH_DEVICE_ID=tui-box/)
  } finally {
    rmSync(tempHome, { recursive: true, force: true })
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('quickstart success summarizes setup verification instead of dumping raw telemetry JSON', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-quickstart-summary-home-'))

  const run = spawnSync(process.execPath, [BIN, 'quickstart', '--no-tui'], {
    env: {
      ...process.env,
      HOME: tempHome,
      IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
      IDLEWATCH_ENROLL_MODE: 'local',
      IDLEWATCH_ENROLL_DEVICE_NAME: 'Metric Box',
      IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory',
      IDLEWATCH_OPENCLAW_USAGE: 'off'
    },
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /✅ Setup complete/)
  assert.match(run.stdout, /Local telemetry verified/)
  assert.doesNotMatch(run.stdout, /"schemaFamily":"idlewatch\.openclaw\.fleet"/)
  assert.doesNotMatch(run.stdout, /"usageProbeSweeps":/)
})


test('quickstart failure keeps idlewatch --once as the primary retry only for the default saved config path', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-quickstart-default-retry-home-'))
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-quickstart-default-retry-root-'))
  const rejectServer = path.join(tempRoot, 'reject-server.mjs')
  const port = 47931

  fs.writeFileSync(rejectServer, `
    import http from 'node:http'
    const port = Number(process.argv[2])
    const server = http.createServer((req, res) => {
      req.resume()
      req.on('end', () => {
        res.writeHead(401, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid_api_key' }))
      })
    })
    server.listen(port, '127.0.0.1')
  `)

  const server = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' })
  void server
  const serverProc = spawn(process.execPath, [rejectServer, String(port)], {
    stdio: 'ignore'
  })

  try {
    const run = spawnSync(process.execPath, [BIN, 'quickstart'], {
      env: {
        ...process.env,
        HOME: tempHome,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_MODE: 'production',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'Retry Box',
        IDLEWATCH_CLOUD_API_KEY: 'iwk_abcdefghijklmnopqrstuvwxyz123456',
        IDLEWATCH_CLOUD_INGEST_URL: `http://127.0.0.1:${port}/api/ingest`,
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory',
        IDLEWATCH_OPENCLAW_USAGE: 'off'
      },
      encoding: 'utf8'
    })

    assert.notEqual(run.status, 0)
    assert.match(run.stderr, /Setup saved, but the test sample failed to publish/)
    assert.ok(run.stderr.includes(`Retry:  ${SOURCE_CMD} --once`), 'should show source-checkout retry command')
    assert.ok(run.stderr.includes(`Redo:   ${SOURCE_CMD} quickstart`), 'should show source-checkout quickstart redo command')
  } finally {
    serverProc.kill('SIGTERM')
    rmSync(tempHome, { recursive: true, force: true })
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('quickstart failure uses custom-path-aware retry copy when setup saved config outside the default path', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-quickstart-custom-retry-home-'))
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-quickstart-custom-retry-root-'))
  const rejectServer = path.join(tempRoot, 'reject-server.mjs')
  const customEnvFile = path.join(tempRoot, 'custom.env')
  const port = 47932

  fs.writeFileSync(rejectServer, `
    import http from 'node:http'
    const port = Number(process.argv[2])
    const server = http.createServer((req, res) => {
      req.resume()
      req.on('end', () => {
        res.writeHead(401, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid_api_key' }))
      })
    })
    server.listen(port, '127.0.0.1')
  `)

  const serverProc = spawn(process.execPath, [rejectServer, String(port)], {
    stdio: 'ignore'
  })
  sleep(150)

  try {
    const run = spawnSync(process.execPath, [BIN, 'quickstart'], {
      env: {
        ...process.env,
        HOME: tempHome,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_MODE: 'production',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'Retry Box',
        IDLEWATCH_CLOUD_API_KEY: 'iwk_abcdefghijklmnopqrstuvwxyz123456',
        IDLEWATCH_CLOUD_INGEST_URL: `http://127.0.0.1:${port}/api/ingest`,
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory',
        IDLEWATCH_ENROLL_OUTPUT_ENV_FILE: customEnvFile,
        IDLEWATCH_ENROLL_CONFIG_DIR: path.join(tempRoot, 'config'),
        IDLEWATCH_OPENCLAW_USAGE: 'off'
      },
      encoding: 'utf8'
    })

    assert.notEqual(run.status, 0)
    assert.match(run.stderr, /Setup saved, but the test sample failed to publish/)
    assert.ok(run.stderr.includes(`Retry:  ${SOURCE_CMD} --once`), 'should show source-checkout retry command')
    assert.ok(run.stderr.includes(`Redo:   ${SOURCE_CMD} quickstart`), 'should show source-checkout quickstart redo command')
  } finally {
    serverProc.kill('SIGTERM')
    rmSync(tempHome, { recursive: true, force: true })
    rmSync(tempRoot, { recursive: true, force: true })
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

    const run = spawnSync(process.execPath, [BIN, '--dry-run', '--json'], {
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

    const run = spawnSync(process.execPath, [BIN, '--dry-run', '--json'], {
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

    const run = spawnSync(process.execPath, [BIN, '--dry-run', '--json'], {
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


test('status command shows cloud link info when cloud config is present', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-cloud-'))
  try {
    const configDir = path.join(tempDir, '.idlewatch')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(path.join(configDir, 'idlewatch.env'), [
      'IDLEWATCH_DEVICE_NAME=Status Test Box',
      'IDLEWATCH_DEVICE_ID=status-test-box',
      'IDLEWATCH_CLOUD_API_KEY=iwk_abcdefghijklmnopqrstuvwxyz123456',
      'IDLEWATCH_CLOUD_INGEST_URL=https://api.idlewatch.com/api/ingest',
      'IDLEWATCH_MONITOR_TARGETS=cpu,memory',
      'IDLEWATCH_OPENCLAW_USAGE=off'
    ].join('\n') + '\n')

    const run = spawnSync(process.execPath, [BIN, 'status'], {
      env: { ...process.env, HOME: tempDir, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.ok(run.stdout.includes('Cloud link:'), 'should show cloud link URL')
    assert.ok(run.stdout.includes('API key:'), 'should show masked API key')
    assert.ok(run.stdout.includes('iwk_abcd'), 'should show key prefix')
    assert.ok(run.stdout.includes('3456'), 'should show key suffix')
    assert.ok(!run.stdout.includes('iwk_abcdefghijklmnopqrstuvwxyz123456'), 'should not show full key')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('install-agent help explains config is optional', () => {
  const run = spawnSync(process.execPath, [BIN, 'install-agent', '--help'], {
    env: { ...process.env, PATH: process.env.PATH },
    encoding: 'utf8',
    timeout: 10000
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /Saved config is optional on first install/)
  assert.doesNotMatch(run.stdout, /Uses the saved config from ~\/\.idlewatch\/idlewatch\.env\./)
})

test('install-agent follow-up uses source checkout command path', () => {
  if (process.platform !== 'darwin') {
    return
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-install-agent-source-'))
  try {
    const run = spawnSync(process.execPath, [BIN, 'install-agent'], {
      env: { ...process.env, HOME: tempDir, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 15000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.ok(run.stdout.includes(`Next:         ${SOURCE_CMD} quickstart`), 'should show source-checkout quickstart command')
    assert.ok(run.stdout.includes(`Then re-run:  ${SOURCE_CMD} install-agent`), 'should show source-checkout reinstall command')
    assert.ok(run.stdout.includes(`Check:        ${SOURCE_CMD} status`), 'should show source-checkout status command')
    assert.ok(run.stdout.includes(`Remove:       ${SOURCE_CMD} uninstall-agent`), 'should show source-checkout uninstall command')
    assert.doesNotMatch(run.stdout, /Next:.*idlewatch quickstart/)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('status command hides cloud link info in local-only mode', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-local-'))
  try {
    const run = spawnSync(process.execPath, [BIN, 'status'], {
      env: { ...process.env, HOME: tempDir, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.ok(!run.stdout.includes('Cloud link:'), 'should not show cloud link in local-only')
    assert.ok(!run.stdout.includes('API key:'), 'should not show API key in local-only')
    assert.ok(run.stdout.includes('local-only'), 'should show local-only mode')
    assert.ok(run.stdout.includes(`${SOURCE_CMD} quickstart`), 'should hint at quickstart when no config')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('status command shows contextual next-step hints', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-hints-'))
  try {
    // With config but no samples: should hint at --once / run
    const configDir = path.join(tempDir, '.idlewatch')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(path.join(configDir, 'idlewatch.env'), [
      'IDLEWATCH_DEVICE_NAME=Hint Box',
      'IDLEWATCH_DEVICE_ID=hint-box',
      'IDLEWATCH_MONITOR_TARGETS=cpu,memory',
      'IDLEWATCH_OPENCLAW_USAGE=off'
    ].join('\n') + '\n')

    const noSamples = spawnSync(process.execPath, [BIN, 'status'], {
      env: { ...process.env, HOME: tempDir, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 10000
    })
    assert.equal(noSamples.status, 0, noSamples.stderr)
    assert.ok(noSamples.stdout.includes('(none yet)'), 'should show no samples yet')
    assert.ok(noSamples.stdout.includes(`${SOURCE_CMD} --once`), 'should hint at --once for test sample')
    assert.ok(noSamples.stdout.includes(`${SOURCE_CMD} run`), 'should hint at run for continuous monitoring')

    // With config and samples: should hint at configure
    const logDir = path.join(configDir, 'logs')
    fs.mkdirSync(logDir, { recursive: true })
    fs.writeFileSync(path.join(logDir, 'hint-box-metrics.ndjson'), `{"ts":${Date.now()}}\n`)

    const withSamples = spawnSync(process.execPath, [BIN, 'status'], {
      env: { ...process.env, HOME: tempDir, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 10000
    })
    assert.equal(withSamples.status, 0, withSamples.stderr)
    assert.ok(withSamples.stdout.includes(`${SOURCE_CMD} configure`), 'should hint at configure when samples exist')
    assert.ok(!withSamples.stdout.includes('(none yet)'), 'should not show none yet when samples exist')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
