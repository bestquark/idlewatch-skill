import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promptModeText } from '../src/enrollment.js'

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

test('rejects invalid IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES with the provided value', () => {
  const run = spawnSync(process.execPath, [BIN, '--dry-run'], {
    env: {
      ...process.env,
      IDLEWATCH_OPENCLAW_USAGE: 'off',
      IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES: 'abc'
    },
    encoding: 'utf8'
  })

  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /Invalid IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES: abc/)
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
  assert.match(run.stdout, /run\s+Run the collector in the foreground/)
  assert.doesNotMatch(run.stdout, /run\s+Start the background collector/)
  assert.match(run.stdout, /--dry-run/)
  assert.match(run.stdout, /--once/)
  assert.match(run.stdout, /--test-publish/)
})

test('help preserves one-off command hints under npm exec', () => {
  const run = spawnSync(process.execPath, [BIN, '--help'], {
    env: {
      ...process.env,
      npm_execpath: '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
      npm_command: 'exec',
      npm_lifecycle_event: 'npx',
      npm_config_user_agent: 'npm/11.9.0 node/v25.6.1 darwin arm64 workspaces/false'
    },
    encoding: 'utf8'
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /Get started:\s+npx idlewatch quickstart --no-tui/)
  assert.doesNotMatch(run.stdout, /Get started:\s+idlewatch quickstart(?:\s|$)/)
})

test('setup mode prompt stays neutral and local-first friendly', () => {
  const prompt = promptModeText()

  assert.match(prompt, /IdleWatch Setup/)
  assert.match(prompt, /1\) Cloud link — publish with an API key from idlewatch\.com\/api/)
  assert.match(prompt, /2\) Local-only — keep samples on this Mac/)
  assert.doesNotMatch(prompt, /Cloud \(recommended\)/)
})

test('reconfigure mode prompt keeps the same calmer setup-mode wording', () => {
  const prompt = promptModeText({ isReconfigure: true })

  assert.match(prompt, /IdleWatch Reconfigure/)
  assert.match(prompt, /1\) Cloud link — publish with an API key from idlewatch\.com\/api/)
  assert.match(prompt, /2\) Local-only — keep samples on this Mac/)
  assert.doesNotMatch(prompt, /Cloud \(recommended\)/)
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
  assert.match(run.stdout, /✅ Sample collected .* and saved locally/)
  assert.doesNotMatch(run.stdout, /⚠️ Sample collected/)
  assert.match(run.stdout, /✅ Setup complete/)
  assert.match(run.stdout, /Local telemetry verified/)
  assert.doesNotMatch(run.stdout, /Initial telemetry sample sent successfully\./)
  assert.equal(run.stderr.trim(), '')
  assert.doesNotMatch(run.stdout, /Firebase\/emulator mode if you need that path/)
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
  assert.match(run.stdout, /✅ Sample collected .* and saved locally/)
  assert.doesNotMatch(run.stdout, /⚠️ Sample collected/)
  assert.match(run.stdout, /✅ Setup complete/)
  assert.match(run.stdout, /Mode:\s+local-only/)
  assert.match(run.stdout, /Local telemetry verified/)
  assert.match(run.stdout, /For background mode:\n\s+.*install-agent\s+Auto-start in background/)
  assert.doesNotMatch(run.stdout, /Auto-start in background \(recommended\)/)
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
    assert.ok(run.stderr.includes(`Redo:   ${SOURCE_CMD} quickstart --no-tui`), 'should show source-checkout quickstart redo command')
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
    assert.ok(run.stderr.includes(`Redo:   ${SOURCE_CMD} quickstart --no-tui`), 'should show source-checkout quickstart redo command')
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

test('install-agent help keeps the durable setup path short and clear', () => {
  const run = spawnSync(process.execPath, [BIN, 'install-agent', '--help'], {
    env: { ...process.env, PATH: process.env.PATH },
    encoding: 'utf8',
    timeout: 10000
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /install-agent — Enable background mode \(macOS\)/)
  assert.match(run.stdout, /Enables background mode on macOS\./)
  assert.doesNotMatch(run.stdout, /Enables the LaunchAgent for background mode\./)
  assert.match(run.stdout, /If setup is already saved, IdleWatch starts automatically\./)
  assert.match(run.stdout, /If not, save setup first with .*quickstart --no-tui, then re-run install-agent\./)
  assert.doesNotMatch(run.stdout, /If not, it stays off until you save setup and re-run install-agent\./)
  assert.doesNotMatch(run.stdout, /If you're using npx\/npm exec:/)
  assert.doesNotMatch(run.stdout, /Install once:\s+npm install -g idlewatch/)
  assert.doesNotMatch(run.stdout, /Then enable:\s+idlewatch install-agent/)
  assert.doesNotMatch(run.stdout, /Saved config is optional on first install/)
  assert.doesNotMatch(run.stdout, /run quickstart later, then re-run install-agent to apply it\./)
  assert.doesNotMatch(run.stdout, /For one-off npx\/npm exec runs, install IdleWatch once first:/)
  assert.doesNotMatch(run.stdout, /Uses the saved config from ~\/\.idlewatch\/idlewatch\.env\./)
})

test('install-agent help in npx context points straight to the durable path', () => {
  const run = spawnSync(process.execPath, [BIN, 'install-agent', '--help'], {
    env: {
      ...process.env,
      PATH: process.env.PATH,
      npm_execpath: '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
      npm_command: 'exec',
      npm_lifecycle_event: 'npx',
      npm_config_user_agent: 'npm/11.9.0 node/v25.6.1 darwin arm64 workspaces/false'
    },
    encoding: 'utf8',
    timeout: 10000
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /^Background mode needs a durable install\./)
  assert.match(run.stdout, /Install once:\s+npm install -g idlewatch/)
  assert.match(run.stdout, /Then enable:\s+idlewatch install-agent/)
  assert.doesNotMatch(run.stdout, /Usage:\s+npx idlewatch install-agent/)
  assert.doesNotMatch(run.stdout, /npx idlewatch install-agent — Install background LaunchAgent \(macOS\)/)
})

test('main help matches the current source-checkout invocation path', () => {
  const run = spawnSync(process.execPath, [BIN, '--help'], {
    env: { ...process.env, PATH: process.env.PATH },
    encoding: 'utf8',
    timeout: 10000
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /^node .*bin\/idlewatch-agent\.js\n\nUsage:\s+node .*bin\/idlewatch-agent\.js <command> \[options\]/)
  assert.match(run.stdout, /quickstart\s+Set up this device \(name, metrics, optional cloud link\)/)
  assert.match(run.stdout, /configure\s+Re-open setup \(name, metrics, optional cloud link\)/)
  assert.match(run.stdout, /status\s+Show device config and background mode state/)
  assert.match(run.stdout, /install-agent\s+Enable background mode \(macOS\)/)
  assert.match(run.stdout, /uninstall-agent\s+Disable background mode \(macOS\)/)
  assert.doesNotMatch(run.stdout, /quickstart\s+Set up this device \(API key, name, metrics\)/)
  assert.doesNotMatch(run.stdout, /configure\s+Re-open setup to change settings — values auto-filled/)
  assert.doesNotMatch(run.stdout, /status\s+Show device config and background agent state/)
  assert.doesNotMatch(run.stdout, /install-agent\s+Install background LaunchAgent \(macOS\)/)
  assert.doesNotMatch(run.stdout, /^idlewatch\n\nUsage:\s+idlewatch <command> \[options\]/)
})

test('main help stays on the durable command in npx context', () => {
  const run = spawnSync(process.execPath, [BIN, '--help'], {
    env: {
      ...process.env,
      PATH: process.env.PATH,
      npm_execpath: '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
      npm_command: 'exec',
      npm_lifecycle_event: 'npx',
      npm_config_user_agent: 'npm/11.9.0 node/v25.6.1 darwin arm64 workspaces/false'
    },
    encoding: 'utf8',
    timeout: 10000
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /^npx idlewatch\n\nUsage:\s+npx idlewatch <command> \[options\]/)
  assert.match(run.stdout, /Get started:\s+npx idlewatch quickstart --no-tui/)
  assert.match(run.stdout, /install-agent\s+Enable background mode \(requires durable install\)/)
  assert.doesNotMatch(run.stdout, /install-agent\s+Install background LaunchAgent \(macOS\)/)
})

test('quickstart help stays clean in non-TTY mode', () => {
  const run = spawnSync(process.execPath, [BIN, 'quickstart', '--help'], {
    env: { ...process.env, PATH: process.env.PATH },
    encoding: 'utf8',
    timeout: 10000
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /Usage:\s+.*quickstart --no-tui\n/)
  assert.match(run.stdout, /Walks you through device name, metrics, and an optional cloud link\./)
  assert.match(run.stdout, /Uses plain-text prompts\./)
  assert.doesNotMatch(run.stdout, /Walks you through API key, device name, and metric selection\./)
  assert.doesNotMatch(run.stdout, /Usage:\s+.*quickstart --no-tui \[--no-tui\]/)
  assert.doesNotMatch(run.stdout, /Use --no-tui for plain-text prompts\./)
})

test('configure help stays clean in non-TTY mode and keeps saved-config reload wording short', () => {
  const run = spawnSync(process.execPath, [BIN, 'configure', '--help'], {
    env: { ...process.env, PATH: process.env.PATH },
    encoding: 'utf8',
    timeout: 10000
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /configure — Re-open setup\n\nUsage:\s+.*configure --no-tui\n/)
  assert.match(run.stdout, /Re-opens setup to change device name, metrics, and your optional cloud link\./)
  assert.match(run.stdout, /Uses plain-text prompts\./)
  assert.match(run.stdout, /Saved changes apply on the next start\./)
  assert.match(run.stdout, /If background mode is already enabled, re-run .* install-agent to refresh it with the saved config\./)
  assert.doesNotMatch(run.stdout, /Usage:\s+.*configure \[--no-tui\]/)
  assert.doesNotMatch(run.stdout, /Use --no-tui for plain-text prompts\./)
  assert.doesNotMatch(run.stdout, /Saved changes apply the next time IdleWatch starts\./)
  assert.doesNotMatch(run.stdout, /restart it with the updated config\./)
  assert.doesNotMatch(run.stdout, /Re-opens the setup wizard to change mode, API key, device name, or metrics\./)

  const npxRun = spawnSync(process.execPath, [BIN, 'configure', '--help'], {
    env: {
      ...process.env,
      PATH: process.env.PATH,
      npm_execpath: '/usr/local/lib/node_modules/npm/bin/npx-cli.js',
      npm_command: 'exec'
    },
    encoding: 'utf8',
    timeout: 10000
  })

  assert.equal(npxRun.status, 0, npxRun.stderr)
  assert.match(npxRun.stdout, /If background mode is already enabled, re-run idlewatch install-agent to refresh it with the saved config\./)
  assert.doesNotMatch(npxRun.stdout, /npx idlewatch install-agent/)
})

test('reconfigure help stays clean in non-TTY mode', () => {
  const run = spawnSync(process.execPath, [BIN, 'reconfigure', '--help'], {
    env: { ...process.env, PATH: process.env.PATH },
    encoding: 'utf8',
    timeout: 10000
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /reconfigure — Re-open setup \(alias for configure\)\n\nUsage:\s+.*reconfigure --no-tui\n/)
  assert.match(run.stdout, /Re-opens setup to change device name, metrics, and your optional cloud link\./)
  assert.match(run.stdout, /Uses plain-text prompts\./)
  assert.doesNotMatch(run.stdout, /Usage:\s+.*reconfigure \[--no-tui\]/)
  assert.doesNotMatch(run.stdout, /Use --no-tui for plain-text prompts\./)
  assert.doesNotMatch(run.stdout, /Re-opens the setup wizard to change mode, API key, device name, or metrics\./)
})

test('status help keeps the calmer background-mode wording and saved-config refresh hint', () => {
  const run = spawnSync(process.execPath, [BIN, 'status', '--help'], {
    env: { ...process.env, PATH: process.env.PATH },
    encoding: 'utf8',
    timeout: 10000
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /status — Show device config and background mode state/)
  assert.match(run.stdout, /Displays device config, publish mode, enabled metrics, last sample age,\nand background mode state\./)
  assert.match(run.stdout, /Config changes saved by quickstart\/configure apply on the next start\./)
  assert.match(run.stdout, /If background mode is already enabled, re-run .* install-agent to refresh it with the saved config\./)
  assert.doesNotMatch(run.stdout, /background LaunchAgent state\./)
  assert.doesNotMatch(run.stdout, /If the background agent is already running, re-run .* install-agent to restart it\./)
})

test('uninstall-agent help reassures that config and logs are kept', () => {
  const run = spawnSync(process.execPath, [BIN, 'uninstall-agent', '--help'], {
    env: { ...process.env, PATH: process.env.PATH },
    encoding: 'utf8',
    timeout: 10000
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /uninstall-agent — Disable background mode \(macOS\)/)
  assert.match(run.stdout, /Disables background mode on macOS\./)
  assert.doesNotMatch(run.stdout, /Stops and removes the LaunchAgent for background mode\./)
  assert.match(run.stdout, /Saved config stays at ~\/\.idlewatch\/idlewatch\.env when setup has been saved\./)
  assert.match(run.stdout, /Local logs stay where they're already being written, so you can re-enable background mode later\./)
  assert.doesNotMatch(run.stdout, /Saved config and local logs stay in ~\/\.idlewatch/)
  assert.doesNotMatch(run.stdout, /Remove background LaunchAgent \(macOS\)/)
  assert.doesNotMatch(run.stdout, /Stops and removes the IdleWatch LaunchAgent\./)
  assert.doesNotMatch(run.stdout, /Telemetry collection stops\s+until you manually run IdleWatch again\./)
})

test('uninstall-agent runtime output keeps the saved-config wording calm', () => {
  if (process.platform !== 'darwin') {
    return
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-uninstall-agent-runtime-'))
  const launchAgentsDir = path.join(tempDir, 'Library', 'LaunchAgents')
  const plistPath = path.join(launchAgentsDir, 'com.idlewatch.agent.plist')

  fs.mkdirSync(launchAgentsDir, { recursive: true })
  writeFileSync(plistPath, '<plist/>')

  try {
    const run = spawnSync(process.execPath, [BIN, 'uninstall-agent'], {
      env: { ...process.env, HOME: tempDir, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /Background mode turned off\./)
    assert.doesNotMatch(run.stdout, /LaunchAgent removed — background collection stopped\./)
    assert.match(run.stdout, /Saved config stays at .*\.idlewatch\/idlewatch\.env/)
    assert.match(run.stdout, /Local logs stay in .*\.idlewatch\/logs/)
    assert.match(run.stdout, /Re-enable:\s+.*install-agent/)
    assert.doesNotMatch(run.stdout, /Saved config and local logs stay in/)
    assert.doesNotMatch(run.stdout, /Your config and logs were kept in/)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('uninstall-agent when nothing is installed still reassures that config and logs are kept', () => {
  if (process.platform !== 'darwin') {
    return
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-uninstall-agent-not-installed-'))

  try {
    const run = spawnSync(process.execPath, [BIN, 'uninstall-agent'], {
      env: { ...process.env, HOME: tempDir, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /Background mode is already off\./)
    assert.match(run.stdout, /Saved config stays at .*\.idlewatch\/idlewatch\.env/)
    assert.match(run.stdout, /Local logs stay in .*\.idlewatch\/logs/)
    assert.doesNotMatch(run.stdout, /LaunchAgent is not installed\. Nothing to remove\./)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('uninstall-agent runtime output names a custom retained local log path', () => {
  if (process.platform !== 'darwin') {
    return
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-uninstall-agent-custom-log-'))
  const launchAgentsDir = path.join(tempDir, 'Library', 'LaunchAgents')
  const plistPath = path.join(launchAgentsDir, 'com.idlewatch.agent.plist')
  const customLogPath = path.join(tempDir, 'custom-logs', 'kitchen-mac.ndjson')

  fs.mkdirSync(launchAgentsDir, { recursive: true })
  fs.mkdirSync(path.dirname(customLogPath), { recursive: true })
  writeFileSync(plistPath, '<plist/>')
  fs.mkdirSync(path.join(tempDir, '.idlewatch'), { recursive: true })
  writeFileSync(path.join(tempDir, '.idlewatch', 'idlewatch.env'), [
    'IDLEWATCH_DEVICE_NAME=Kitchen Mac',
    'IDLEWATCH_DEVICE_ID=kitchen-mac',
    'IDLEWATCH_MONITOR_TARGETS=cpu,memory',
    `IDLEWATCH_LOCAL_LOG_PATH=${customLogPath}`
  ].join('\n') + '\n')

  try {
    const run = spawnSync(process.execPath, [BIN, 'uninstall-agent'], {
      env: { ...process.env, HOME: tempDir, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /Saved config stays at .*\.idlewatch\/idlewatch\.env/)
    assert.ok(run.stdout.includes(`Local log stays at ${customLogPath}`), 'should show the retained custom local log path')
    assert.doesNotMatch(run.stdout, /Saved config and local logs stay in .*\.idlewatch/)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('install-agent refuses disposable npm exec paths and explains the durable path', () => {
  if (process.platform !== 'darwin') {
    return
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-install-agent-npx-'))
  try {
    const run = spawnSync(process.execPath, [BIN, 'install-agent'], {
      env: {
        ...process.env,
        HOME: tempDir,
        PATH: process.env.PATH,
        npm_execpath: '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
        npm_command: 'exec',
        npm_lifecycle_event: 'npx',
        npm_config_user_agent: 'npm/11.9.0 node/v25.6.1 darwin arm64 workspaces/false'
      },
      encoding: 'utf8',
      timeout: 15000
    })

    assert.notEqual(run.status, 0)
    assert.match(run.stderr, /Background install needs a durable IdleWatch install first/)
    assert.match(run.stderr, /Install once:\s+npm install -g idlewatch/)
    assert.match(run.stderr, /Then enable:\s+idlewatch install-agent/)
    assert.match(run.stderr, /Run now:\s+npx idlewatch run/)
    assert.doesNotMatch(run.stderr, /npm cache and can disappear later/)
    assert.equal(fs.existsSync(path.join(tempDir, 'Library', 'LaunchAgents', 'com.idlewatch.agent.plist')), false)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
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
    assert.match(run.stdout, /✅ Background mode installed\./)
    assert.match(run.stdout, /Setup isn't saved yet, so background mode stays off for now\./)
    assert.doesNotMatch(run.stdout, /IdleWatch is running in the background\./)
    assert.ok(run.stdout.includes(`Save setup:   ${SOURCE_CMD} quickstart --no-tui`), 'should show source-checkout quickstart command')
    assert.ok(run.stdout.includes(`Run now:      ${SOURCE_CMD} run`), 'should show source-checkout foreground run command')
    assert.ok(run.stdout.includes(`Then start:   ${SOURCE_CMD} install-agent`), 'should show source-checkout start command after pre-installing background mode')
    assert.ok(run.stdout.includes(`Config path:  ${path.join(tempDir, '.idlewatch', 'idlewatch.env')}`), 'should show source-checkout config path before setup is saved')
    assert.ok(run.stdout.includes(`Check:        ${SOURCE_CMD} status`), 'should show source-checkout status command')
    assert.ok(run.stdout.includes(`Remove:       ${SOURCE_CMD} uninstall-agent`), 'should show source-checkout uninstall command')
    assert.doesNotMatch(run.stdout, /Save setup:.*idlewatch quickstart/)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('status stays honest after install-agent without saved config', () => {
  if (process.platform !== 'darwin') {
    return
  }

  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-no-config-install-'))
  const fakeBinDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-launchctl-bin-'))
  const fakeLaunchctl = path.join(fakeBinDir, 'launchctl')
  try {
    writeFileSync(fakeLaunchctl, '#!/usr/bin/env bash\nset -euo pipefail\ncmd="${1:-}"\nif [[ "$cmd" == "print" ]]; then\n  exit 1\nfi\nif [[ "$cmd" == "bootstrap" || "$cmd" == "enable" || "$cmd" == "bootout" ]]; then\n  exit 0\nfi\nexit 0\n', { encoding: 'utf8' })
    chmodSync(fakeLaunchctl, 0o755)

    const install = spawnSync(process.execPath, [BIN, 'install-agent'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: `${fakeBinDir}:${process.env.PATH}`
      },
      encoding: 'utf8',
      timeout: 15000
    })
    assert.equal(install.status, 0, install.stderr)

    const status = spawnSync(process.execPath, [BIN, 'status'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: `${fakeBinDir}:${process.env.PATH}`
      },
      encoding: 'utf8',
      timeout: 15000
    })
    assert.equal(status.status, 0, status.stderr)
    assert.match(status.stdout, /Setup:\s+not completed yet/)
    assert.match(status.stdout, /Local log preview:\s+.*\.idlewatch\/logs\//)
    assert.doesNotMatch(status.stdout, /\n\s*Local log:\s+/)
    assert.match(status.stdout, /Config:\s+.*\.idlewatch\/idlewatch\.env \(not saved yet\)/)
    assert.match(status.stdout, /Background:\s+waiting for setup/)
    assert.doesNotMatch(status.stdout, /Background:\s+LaunchAgent loaded/)
  } finally {
    rmSync(fakeBinDir, { recursive: true, force: true })
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('install-agent does not claim background is running when launchd still reports not loaded', () => {
  if (process.platform !== 'darwin') {
    return
  }

  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-install-agent-not-loaded-'))
  const fakeBinDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-launchctl-bin-'))
  const fakeLaunchctl = path.join(fakeBinDir, 'launchctl')
  try {
    fs.mkdirSync(path.join(tempHome, '.idlewatch'), { recursive: true })
    fs.writeFileSync(path.join(tempHome, '.idlewatch', 'idlewatch.env'), 'IDLEWATCH_DEVICE_NAME=QA Box\n', 'utf8')
    writeFileSync(fakeLaunchctl, '#!/usr/bin/env bash\nset -euo pipefail\ncmd="${1:-}"\nif [[ "$cmd" == "print" ]]; then\n  exit 1\nfi\nif [[ "$cmd" == "bootstrap" || "$cmd" == "enable" || "$cmd" == "bootout" ]]; then\n  exit 0\nfi\nexit 0\n', { encoding: 'utf8' })
    chmodSync(fakeLaunchctl, 0o755)

    const install = spawnSync(process.execPath, [BIN, 'install-agent'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: `${fakeBinDir}:${process.env.PATH}`
      },
      encoding: 'utf8',
      timeout: 15000
    })

    assert.equal(install.status, 0, install.stderr)
    assert.match(install.stdout, /✅ Background mode installed\./)
    assert.match(install.stdout, /Saved config is ready, but background collection is not loaded yet\./)
    assert.ok(install.stdout.includes(`Start:        ${SOURCE_CMD} install-agent`), 'should show a start hint for the current install path when the agent is installed but not loaded')
    assert.ok(!install.stdout.includes(`Re-enable:    ${SOURCE_CMD} install-agent`), 'should not frame an already-installed agent like a fresh re-enable')
    assert.doesNotMatch(install.stdout, /IdleWatch is running in the background/)
  } finally {
    rmSync(fakeBinDir, { recursive: true, force: true })
    rmSync(tempHome, { recursive: true, force: true })
  }
})


test('install-agent prefers a durable idlewatch CLI path in the LaunchAgent plist when available', () => {
  if (process.platform !== 'darwin') {
    return
  }

  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-install-agent-durable-cli-'))
  const fakeBinDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-durable-cli-bin-'))
  const fakeLaunchctl = path.join(fakeBinDir, 'launchctl')
  const fakeIdlewatch = path.join(fakeBinDir, 'idlewatch')
  try {
    writeFileSync(fakeLaunchctl, '#!/usr/bin/env bash\nset -euo pipefail\ncmd="${1:-}"\nif [[ "$cmd" == "print" ]]; then\n  exit 1\nfi\nif [[ "$cmd" == "bootstrap" || "$cmd" == "enable" || "$cmd" == "bootout" ]]; then\n  exit 0\nfi\nexit 0\n', { encoding: 'utf8' })
    chmodSync(fakeLaunchctl, 0o755)
    writeFileSync(fakeIdlewatch, '#!/usr/bin/env bash\nexit 0\n', { encoding: 'utf8' })
    chmodSync(fakeIdlewatch, 0o755)

    const run = spawnSync(process.execPath, [BIN, 'install-agent'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: `${fakeBinDir}:${process.env.PATH}`
      },
      encoding: 'utf8',
      timeout: 15000
    })

    assert.equal(run.status, 0, run.stderr)
    const plistPath = path.join(tempHome, 'Library', 'LaunchAgents', 'com.idlewatch.agent.plist')
    const plist = fs.readFileSync(plistPath, 'utf8')
    assert.ok(plist.includes(`<string>${fakeIdlewatch}</string>`), 'should target the durable idlewatch CLI path')
    assert.ok(plist.includes('<string>run</string>'), 'should keep the run subcommand in the plist')
    assert.ok(!plist.includes(`<string>${process.execPath}</string>`), 'should not pin the current node binary when a durable idlewatch CLI is available')
    assert.ok(!plist.includes(`<string>${BIN}</string>`), 'should not pin the current source checkout script when a durable idlewatch CLI is available')
  } finally {
    rmSync(fakeBinDir, { recursive: true, force: true })
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('install-agent falls back to the source script in the LaunchAgent plist when no durable idlewatch CLI is available', () => {
  if (process.platform !== 'darwin') {
    return
  }

  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-install-agent-source-plist-'))
  const fakeBinDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-source-plist-bin-'))
  const fakeLaunchctl = path.join(fakeBinDir, 'launchctl')
  try {
    writeFileSync(fakeLaunchctl, '#!/usr/bin/env bash\nset -euo pipefail\ncmd="${1:-}"\nif [[ "$cmd" == "print" ]]; then\n  exit 1\nfi\nif [[ "$cmd" == "bootstrap" || "$cmd" == "enable" || "$cmd" == "bootout" ]]; then\n  exit 0\nfi\nexit 0\n', { encoding: 'utf8' })
    chmodSync(fakeLaunchctl, 0o755)

    const run = spawnSync(process.execPath, [BIN, 'install-agent'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: fakeBinDir
      },
      encoding: 'utf8',
      timeout: 15000
    })

    assert.equal(run.status, 0, run.stderr)
    const plistPath = path.join(tempHome, 'Library', 'LaunchAgents', 'com.idlewatch.agent.plist')
    const plist = fs.readFileSync(plistPath, 'utf8')
    assert.ok(plist.includes(`<string>${process.execPath}</string>`), 'should keep the current node binary when no durable idlewatch CLI is available')
    assert.ok(plist.includes(`<string>${BIN}</string>`), 'should keep the current source checkout script when no durable idlewatch CLI is available')
    assert.ok(plist.includes('<string>run</string>'), 'should keep the run subcommand in the fallback plist')
  } finally {
    rmSync(fakeBinDir, { recursive: true, force: true })
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('install-agent refresh confirmation stays on background-mode wording', () => {
  if (process.platform !== 'darwin') {
    return
  }

  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-install-agent-refresh-'))
  const fakeBinDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-launchctl-refresh-bin-'))
  const fakeLaunchctl = path.join(fakeBinDir, 'launchctl')
  try {
    fs.mkdirSync(path.join(tempHome, '.idlewatch'), { recursive: true })
    fs.writeFileSync(path.join(tempHome, '.idlewatch', 'idlewatch.env'), 'IDLEWATCH_DEVICE_NAME=QA Box\n', 'utf8')
    writeFileSync(fakeLaunchctl, '#!/usr/bin/env bash\nset -euo pipefail\ncmd="${1:-}"\nif [[ "$cmd" == "print" ]]; then\n  cat <<\x27EOF\x27\npid = 4242\nEOF\n  exit 0\nfi\nif [[ "$cmd" == "bootstrap" || "$cmd" == "enable" || "$cmd" == "bootout" ]]; then\n  exit 0\nfi\nexit 0\n', { encoding: 'utf8' })
    chmodSync(fakeLaunchctl, 0o755)

    const install = spawnSync(process.execPath, [BIN, 'install-agent'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: `${fakeBinDir}:${process.env.PATH}`
      },
      encoding: 'utf8',
      timeout: 15000
    })

    assert.equal(install.status, 0, install.stderr)
    assert.match(install.stdout, /✅ Background mode refreshed — IdleWatch is running in the background\./)
    assert.match(install.stdout, /Background mode refreshed with the saved config\./)
    assert.doesNotMatch(install.stdout, /Existing background agent refreshed with the saved config\./)
    assert.doesNotMatch(install.stdout, /restarted with the latest config/)
  } finally {
    rmSync(fakeBinDir, { recursive: true, force: true })
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('quickstart completion stays honest when a LaunchAgent was installed before setup', () => {
  if (process.platform !== 'darwin') {
    return
  }

  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-quickstart-install-first-'))
  const fakeBinDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-quickstart-launchctl-bin-'))
  const fakeLaunchctl = path.join(fakeBinDir, 'launchctl')
  try {
    writeFileSync(fakeLaunchctl, '#!/usr/bin/env bash\nset -euo pipefail\ncmd="${1:-}"\nif [[ "$cmd" == "print" ]]; then\n  exit 1\nfi\nif [[ "$cmd" == "bootstrap" || "$cmd" == "enable" || "$cmd" == "bootout" ]]; then\n  exit 0\nfi\nexit 0\n', { encoding: 'utf8' })
    chmodSync(fakeLaunchctl, 0o755)

    const install = spawnSync(process.execPath, [BIN, 'install-agent'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: `${fakeBinDir}:${process.env.PATH}`
      },
      encoding: 'utf8',
      timeout: 15000
    })
    assert.equal(install.status, 0, install.stderr)

    const run = spawnSync(process.execPath, [BIN, 'quickstart', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: `${fakeBinDir}:${process.env.PATH}`,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_MODE: 'local',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'QA Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /Background mode is already installed\./)
    assert.doesNotMatch(run.stdout, /Background agent is already installed\./)
    assert.match(run.stdout, /Start it: .*install-agent/)
    assert.match(run.stdout, /It will use the saved config\./)
    assert.doesNotMatch(run.stdout, /Background collection is not enabled yet\./)
    assert.doesNotMatch(run.stdout, /Auto-start in background \(recommended\)/)
  } finally {
    rmSync(fakeBinDir, { recursive: true, force: true })
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('first-run status keeps the metric preview lightweight', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-first-run-'))
  try {
    const run = spawnSync(process.execPath, [BIN, 'status'], {
      env: { ...process.env, HOME: tempDir, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /Default metrics:\s+CPU, Memory, GPU, Temperature/)
    assert.match(run.stdout, /Extras available:\s+OpenClaw activity, OpenClaw tokens, OpenClaw runtime/)
    assert.doesNotMatch(run.stdout, /Metrics preview:/)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('quickstart rejects a fully invalid metric selection with a clear validation error', () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-invalid-metrics-'))
  try {
    const run = spawnSync(process.execPath, [BIN, 'quickstart', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_MODE: 'local',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'QA Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'wat,not-real'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.notEqual(run.status, 0)
    assert.match(run.stderr, /No valid metrics were selected\./)
    assert.match(run.stderr, /Unknown: wat, not-real\./)
    assert.match(run.stderr, /Choose one or more of:/)
    assert.match(run.stderr, /cpu, memory/)
    assert.match(run.stderr, /openclaw/)
    assert.doesNotMatch(run.stderr, /agent_activity|token_usage|runtime_state/)
    assert.equal(fs.existsSync(path.join(tempHome, '.idlewatch', 'idlewatch.env')), false)
  } finally {
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('quickstart names the valid enrollment modes when non-interactive mode is invalid', () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-invalid-mode-'))
  try {
    const run = spawnSync(process.execPath, [BIN, 'quickstart', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_MODE: 'cloudy',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'QA Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.notEqual(run.status, 0)
    assert.match(run.stderr, /Invalid enrollment mode: cloudy\./)
    assert.match(run.stderr, /Choose "production" \(cloud\) or "local" \(local-only\)\./)
    assert.equal(fs.existsSync(path.join(tempHome, '.idlewatch', 'idlewatch.env')), false)
  } finally {
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('quickstart gives a calmer non-interactive error when cloud mode is missing an API key', () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-missing-cloud-key-'))
  try {
    const run = spawnSync(process.execPath, [BIN, 'quickstart', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_MODE: 'production',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'Cloud Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.notEqual(run.status, 0)
    assert.match(run.stderr, /Cloud mode needs an API key\./)
    assert.match(run.stderr, /Set IDLEWATCH_CLOUD_API_KEY or switch to local-only mode\./)
    assert.doesNotMatch(run.stderr, /Missing cloud API key/)
    assert.equal(fs.existsSync(path.join(tempHome, '.idlewatch', 'idlewatch.env')), false)
  } finally {
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('quickstart and configure keep one-off runs honest about background install under npm exec env', () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-quickstart-npx-env-'))
  try {
    const baseEnv = {
      ...process.env,
      HOME: tempHome,
      PATH: process.env.PATH,
      npm_execpath: '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
      npm_command: 'exec',
      npm_lifecycle_event: 'npx',
      npm_config_user_agent: 'npm/11.9.0 node/v25.6.1 darwin arm64 workspaces/false',
      IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
      IDLEWATCH_ENROLL_MODE: 'local',
      IDLEWATCH_ENROLL_DEVICE_NAME: 'QA Box',
      IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory'
    }

    const quickstart = spawnSync(process.execPath, [BIN, 'quickstart', '--no-tui'], {
      env: baseEnv,
      encoding: 'utf8',
      timeout: 20000
    })

    assert.equal(quickstart.status, 0, quickstart.stderr)
    assert.match(quickstart.stdout, /Use it now:/)
    assert.match(quickstart.stdout, /npx idlewatch run/)
    assert.match(quickstart.stdout, /For background mode:/)
    assert.match(quickstart.stdout, /Install once: npm install -g idlewatch/)
    assert.match(quickstart.stdout, /Then enable: idlewatch install-agent/)
    assert.match(quickstart.stdout, /idlewatch install-agent/)
    assert.doesNotMatch(quickstart.stdout, /To keep it running:/)
    assert.doesNotMatch(quickstart.stdout, /npx idlewatch install-agent/)

    const configure = spawnSync(process.execPath, [BIN, 'configure', '--no-tui'], {
      env: { ...baseEnv, IDLEWATCH_ENROLL_MONITOR_TARGETS: 'agent_activity' },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.equal(configure.status, 0, configure.stderr)
    assert.match(configure.stdout, /Use it now:/)
    assert.match(configure.stdout, /npx idlewatch run/)
    assert.match(configure.stdout, /For background mode:/)
    assert.match(configure.stdout, /Install once: npm install -g idlewatch/)
    assert.match(configure.stdout, /Then enable: idlewatch install-agent/)
    assert.match(configure.stdout, /idlewatch install-agent/)
    assert.doesNotMatch(configure.stdout, /To keep it running:/)
    assert.doesNotMatch(configure.stdout, /npx idlewatch install-agent/)

    if (process.platform === 'darwin') {
      const fakeBinDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-configure-npx-running-launchctl-bin-'))
      try {
        fs.writeFileSync(path.join(fakeBinDir, 'launchctl'), `#!/usr/bin/env bash
set -euo pipefail
cmd="\${1:-}"
if [[ "\$cmd" == "print" ]]; then
  exit 0
fi
if [[ "\$cmd" == "bootstrap" || "\$cmd" == "enable" || "\$cmd" == "bootout" || "\$cmd" == "disable" || "\$cmd" == "kickstart" ]]; then
  exit 0
fi
exit 0
`)
        fs.chmodSync(path.join(fakeBinDir, 'launchctl'), 0o755)

        const durableInstall = spawnSync(process.execPath, [BIN, 'install-agent'], {
          env: { ...process.env, HOME: tempHome, PATH: `${fakeBinDir}:${process.env.PATH}` },
          encoding: 'utf8',
          timeout: 15000
        })
        assert.equal(durableInstall.status, 0, durableInstall.stderr)

        const npxConfigureWithRunningAgent = spawnSync(process.execPath, [BIN, 'configure', '--no-tui'], {
          env: {
            ...baseEnv,
            PATH: `${fakeBinDir}:${process.env.PATH}`,
            IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory,gpu'
          },
          encoding: 'utf8',
          timeout: 20000
        })

        assert.equal(npxConfigureWithRunningAgent.status, 0, npxConfigureWithRunningAgent.stderr)
        assert.match(npxConfigureWithRunningAgent.stdout, /Background mode:\s+already running/)
        assert.doesNotMatch(npxConfigureWithRunningAgent.stdout, /Background agent:\s+already running/)
        assert.match(npxConfigureWithRunningAgent.stdout, /Apply changes:\s+re-run idlewatch install-agent to refresh it with the saved config/)
        assert.match(npxConfigureWithRunningAgent.stdout, /This npx run updated the saved config only\./)
        assert.doesNotMatch(npxConfigureWithRunningAgent.stdout, /refresh the background agent with the saved config/)
      } finally {
        rmSync(fakeBinDir, { recursive: true, force: true })
      }
    }
  } finally {
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('configure --no-tui preserves the saved local/cloud mode when mode is omitted', () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-configure-preserve-mode-home-'))
  try {
    const quickstart = spawnSync(process.execPath, [BIN, 'quickstart', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_MODE: 'local',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'QA Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.equal(quickstart.status, 0, quickstart.stderr)

    const configure = spawnSync(process.execPath, [BIN, 'configure', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'Renamed Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory,gpu'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.equal(configure.status, 0, configure.stderr)
    assert.match(configure.stdout, /✅ Settings saved for "Renamed Box"\./)
    assert.match(configure.stdout, /✓ Local telemetry verified\./)
    assert.doesNotMatch(configure.stderr, /Missing cloud API key/)

    const updatedEnv = fs.readFileSync(path.join(tempHome, '.idlewatch', 'idlewatch.env'), 'utf8')
    assert.match(updatedEnv, /IDLEWATCH_DEVICE_NAME=Renamed Box/)
    assert.match(updatedEnv, /IDLEWATCH_MONITOR_TARGETS=cpu,memory,gpu/)
    assert.doesNotMatch(updatedEnv, /IDLEWATCH_CLOUD_API_KEY=/)
    assert.doesNotMatch(updatedEnv, /IDLEWATCH_REQUIRE_CLOUD_WRITES=1/)
  } finally {
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('configure --no-tui keeps saved metrics when metrics are omitted', () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-configure-preserve-metrics-home-'))
  try {
    const quickstart = spawnSync(process.execPath, [BIN, 'quickstart', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_MODE: 'local',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'Metric Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory,gpu'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.equal(quickstart.status, 0, quickstart.stderr)

    const configure = spawnSync(process.execPath, [BIN, 'configure', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'Renamed Metric Box'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.equal(configure.status, 0, configure.stderr)
    assert.match(configure.stdout, /✅ Settings saved for "Renamed Metric Box"\./)
    assert.match(configure.stdout, /✓ Local telemetry verified\./)

    const updatedEnv = fs.readFileSync(path.join(tempHome, '.idlewatch', 'idlewatch.env'), 'utf8')
    assert.match(updatedEnv, /IDLEWATCH_DEVICE_NAME=Renamed Metric Box/)
    assert.match(updatedEnv, /IDLEWATCH_MONITOR_TARGETS=cpu,memory,gpu/)
  } finally {
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('configure accepts saved config lines prefixed with export', () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-configure-export-env-'))
  try {
    const configDir = path.join(tempHome, '.idlewatch')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(path.join(configDir, 'idlewatch.env'), [
      'export IDLEWATCH_ENROLL_MODE=local',
      'export IDLEWATCH_DEVICE_NAME="Export Box"',
      'export IDLEWATCH_DEVICE_ID=export-box',
      'export IDLEWATCH_MONITOR_TARGETS="cpu,memory"',
      `export IDLEWATCH_LOCAL_LOG_PATH="${path.join(configDir, 'logs', 'export-box-metrics.ndjson')}"`
    ].join('\n') + '\n')

    const configure = spawnSync(process.execPath, [BIN, 'configure', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'Renamed Export Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory,gpu'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.equal(configure.status, 0, configure.stderr)
    assert.match(configure.stdout, /✅ Settings saved for "Renamed Export Box"\./)
    assert.match(configure.stdout, /✓ Local telemetry verified\./)
    assert.doesNotMatch(configure.stderr, /Missing cloud API key/)

    const updatedEnv = fs.readFileSync(path.join(configDir, 'idlewatch.env'), 'utf8')
    assert.match(updatedEnv, /IDLEWATCH_DEVICE_NAME=Renamed Export Box/)
    assert.match(updatedEnv, /IDLEWATCH_MONITOR_TARGETS=cpu,memory,gpu/)
    assert.doesNotMatch(updatedEnv, /IDLEWATCH_CLOUD_API_KEY=/)
  } finally {
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('configure accepts a saved config file that starts with a UTF-8 BOM', () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-configure-bom-env-'))
  try {
    const configDir = path.join(tempHome, '.idlewatch')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(path.join(configDir, 'idlewatch.env'), '\uFEFF' + [
      'export IDLEWATCH_ENROLL_MODE=local',
      'export IDLEWATCH_DEVICE_NAME="BOM Box"',
      'export IDLEWATCH_DEVICE_ID=bom-box',
      'export IDLEWATCH_MONITOR_TARGETS="cpu,memory"',
      `export IDLEWATCH_LOCAL_LOG_PATH="${path.join(configDir, 'logs', 'bom-box-metrics.ndjson')}"`
    ].join('\n') + '\n')

    const configure = spawnSync(process.execPath, [BIN, 'configure', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'Renamed BOM Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory,gpu'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.equal(configure.status, 0, configure.stderr)
    assert.match(configure.stdout, /✅ Settings saved for "Renamed BOM Box"\./)
    assert.match(configure.stdout, /✓ Local telemetry verified\./)

    const updatedEnv = fs.readFileSync(path.join(configDir, 'idlewatch.env'), 'utf8')
    assert.match(updatedEnv, /IDLEWATCH_DEVICE_NAME=Renamed BOM Box/)
    assert.match(updatedEnv, /IDLEWATCH_MONITOR_TARGETS=cpu,memory,gpu/)
    assert.doesNotMatch(updatedEnv, /^\uFEFF/m)
  } finally {
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('configure accepts saved config values with trailing inline comments', () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-configure-inline-comment-env-'))
  try {
    const configDir = path.join(tempHome, '.idlewatch')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(path.join(configDir, 'idlewatch.env'), [
      'IDLEWATCH_ENROLL_MODE=local # keep local-only for now',
      'IDLEWATCH_DEVICE_NAME="Comment Box" # renamed in Notes',
      'IDLEWATCH_DEVICE_ID=comment-box # stable id',
      'IDLEWATCH_MONITOR_TARGETS="cpu,memory" # defaults for this Mac',
      `IDLEWATCH_LOCAL_LOG_PATH="${path.join(configDir, 'logs', 'comment-box-metrics.ndjson')}" # custom path`
    ].join('\n') + '\n')

    const configure = spawnSync(process.execPath, [BIN, 'configure', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'Renamed Comment Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory,gpu'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.equal(configure.status, 0, configure.stderr)
    assert.match(configure.stdout, /✅ Settings saved for "Renamed Comment Box"\./)
    assert.match(configure.stdout, /✓ Local telemetry verified\./)

    const updatedEnv = fs.readFileSync(path.join(configDir, 'idlewatch.env'), 'utf8')
    assert.match(updatedEnv, /IDLEWATCH_DEVICE_NAME=Renamed Comment Box/)
    assert.match(updatedEnv, /IDLEWATCH_MONITOR_TARGETS=cpu,memory,gpu/)
  } finally {
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('configure reuses a saved cloud API key from export-prefixed quoted env lines', () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-configure-cloud-export-env-'))
  try {
    const configDir = path.join(tempHome, '.idlewatch')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(path.join(configDir, 'idlewatch.env'), [
      'export IDLEWATCH_DEVICE_NAME="Cloud Export Box"',
      'export IDLEWATCH_DEVICE_ID=cloud-export-box',
      'export IDLEWATCH_MONITOR_TARGETS="cpu,memory"',
      `export IDLEWATCH_LOCAL_LOG_PATH="${path.join(configDir, 'logs', 'cloud-export-box-metrics.ndjson')}"`,
      'export IDLEWATCH_CLOUD_INGEST_URL="https://api.idlewatch.com/api/ingest"',
      'export IDLEWATCH_CLOUD_API_KEY="iwk_abcdefghijklmnopqrstuvwxyz123456"',
      'export IDLEWATCH_REQUIRE_CLOUD_WRITES=1'
    ].join('\n') + '\n')

    const configure = spawnSync(process.execPath, [BIN, 'configure', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'Renamed Cloud Export Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory,gpu'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.notEqual(configure.status, 0, 'test fixture should still fail the cloud verification step with a fake key')
    assert.match(configure.stderr, /API key rejected|Cloud publish failed/)
    assert.doesNotMatch(configure.stderr, /Missing cloud API key/)
    assert.doesNotMatch(configure.stderr, /Cloud API key is invalid/)

    const updatedEnv = fs.readFileSync(path.join(configDir, 'idlewatch.env'), 'utf8')
    assert.match(updatedEnv, /IDLEWATCH_DEVICE_NAME=Renamed Cloud Export Box/)
    assert.match(updatedEnv, /IDLEWATCH_MONITOR_TARGETS=cpu,memory,gpu/)
    assert.match(updatedEnv, /IDLEWATCH_CLOUD_API_KEY=iwk_abcdefghijklmnopqrstuvwxyz123456/)
    assert.match(updatedEnv, /IDLEWATCH_REQUIRE_CLOUD_WRITES=1/)
  } finally {
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('--test-publish invalid cloud-key recovery copy stays product-shaped in a source checkout', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-test-publish-invalid-key-home-'))
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-test-publish-invalid-key-root-'))
  const rejectServer = path.join(tempRoot, 'reject-server.mjs')
  const port = 47933

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
    const run = spawnSync(process.execPath, [BIN, '--test-publish'], {
      env: {
        ...process.env,
        HOME: tempHome,
        IDLEWATCH_DEVICE_NAME: 'test',
        IDLEWATCH_CLOUD_API_KEY: 'bad',
        IDLEWATCH_CLOUD_INGEST_URL: `http://127.0.0.1:${port}/api/ingest`,
        IDLEWATCH_REQUIRE_CLOUD_WRITES: '1',
        IDLEWATCH_OPENCLAW_USAGE: 'off'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.notEqual(run.status, 0)
    assert.match(run.stderr, /Cloud publish failed for "test": API key rejected \(invalid_api_key\)\./)
    assert.match(run.stderr, /Run idlewatch configure --no-tui to update your API key\./)
    assert.doesNotMatch(run.stderr, /Run node .*bin\/idlewatch-agent\.js configure --no-tui to update your API key\./)
  } finally {
    serverProc.kill('SIGTERM')
    rmSync(tempHome, { recursive: true, force: true })
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('configure keeps the saved device id stable when renaming the device', () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-configure-rename-home-'))
  try {
    const quickstart = spawnSync(process.execPath, [BIN, 'quickstart', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_MODE: 'local',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'QA Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory'
      },
      encoding: 'utf8',
      timeout: 20000
    })
    assert.equal(quickstart.status, 0, quickstart.stderr)

    const initialEnv = fs.readFileSync(path.join(tempHome, '.idlewatch', 'idlewatch.env'), 'utf8')
    assert.match(initialEnv, /# Local-only mode \(no cloud writes\)\./)
    assert.match(initialEnv, /IDLEWATCH_DEVICE_NAME=QA Box/)
    assert.match(initialEnv, /IDLEWATCH_DEVICE_ID=qa-box/)

    const configure = spawnSync(process.execPath, [BIN, 'configure', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_MODE: 'local',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'Renamed Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'agent_activity'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.equal(configure.status, 0, configure.stderr)
    assert.match(configure.stdout, /✅ Settings saved for "Renamed Box"\./)
    assert.match(configure.stdout, /Device ID: qa-box \(kept from original setup for continuity\)/)

    const updatedEnv = fs.readFileSync(path.join(tempHome, '.idlewatch', 'idlewatch.env'), 'utf8')
    assert.match(updatedEnv, /IDLEWATCH_DEVICE_NAME=Renamed Box/)
    assert.match(updatedEnv, /IDLEWATCH_DEVICE_ID=qa-box/)
    assert.doesNotMatch(updatedEnv, /IDLEWATCH_DEVICE_ID=renamed-box/)

    const status = spawnSync(process.execPath, [BIN, 'status'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH
      },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(status.status, 0, status.stderr)
    assert.match(status.stdout, /Device:\s+Renamed Box/)
    assert.match(status.stdout, /Device ID:\s+qa-box \(kept from original setup for continuity\)/)
    assert.match(status.stdout, /Local log:\s+.*qa-box-metrics\.ndjson/)
  } finally {
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('configure success says to refresh an already-running background agent', () => {
  if (process.platform !== 'darwin') {
    return
  }

  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-configure-refresh-home-'))
  try {
    const quickstart = spawnSync(process.execPath, [BIN, 'quickstart', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_MODE: 'local',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'QA Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'cpu,memory'
      },
      encoding: 'utf8',
      timeout: 20000
    })
    assert.equal(quickstart.status, 0, quickstart.stderr)
    assert.match(quickstart.stdout, /Use it now:/)
    assert.match(quickstart.stdout, new RegExp(`${SOURCE_CMD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} run`))
    assert.match(quickstart.stdout, /For background mode:/)
    assert.match(quickstart.stdout, new RegExp(`${SOURCE_CMD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} install-agent`))
    assert.doesNotMatch(quickstart.stdout, /To keep it running:/)

    const install = spawnSync(process.execPath, [BIN, 'install-agent'], {
      env: { ...process.env, HOME: tempHome, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 15000
    })
    assert.equal(install.status, 0, install.stderr)

    const postInstallStatus = spawnSync(process.execPath, [BIN, 'status'], {
      env: { ...process.env, HOME: tempHome, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 15000
    })
    assert.equal(postInstallStatus.status, 0, postInstallStatus.stderr)

    const configure = spawnSync(process.execPath, [BIN, 'configure', '--no-tui'], {
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: process.env.PATH,
        IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
        IDLEWATCH_ENROLL_MODE: 'local',
        IDLEWATCH_ENROLL_DEVICE_NAME: 'QA Box',
        IDLEWATCH_ENROLL_MONITOR_TARGETS: 'agent_activity'
      },
      encoding: 'utf8',
      timeout: 20000
    })

    assert.equal(configure.status, 0, configure.stderr)
    assert.match(configure.stdout, /✅ Settings saved for "QA Box"\./)
    assert.doesNotMatch(configure.stdout, /✅ Setup complete — "QA Box" is live!/)

    const launchAgentWasRunning = /Background:\s+running in background|Background:\s+enabled \(idle\)/.test(postInstallStatus.stdout)
    if (launchAgentWasRunning) {
      assert.match(configure.stdout, /Background mode:\s+already running/)
      assert.doesNotMatch(configure.stdout, /Background agent:\s+already running/)
      assert.match(configure.stdout, /Apply changes:\s+re-run .*install-agent to refresh it with the saved config/)
      assert.doesNotMatch(configure.stdout, /To keep it running:/)
    } else {
      assert.match(configure.stdout, /Background collection is not enabled yet\./)
      assert.match(configure.stdout, /Use it now:/)
      assert.match(configure.stdout, /For background mode:/)
      assert.doesNotMatch(configure.stdout, /To keep it running:/)
    }
  } finally {
    spawnSync(process.execPath, [BIN, 'uninstall-agent'], {
      env: { ...process.env, HOME: tempHome, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 15000
    })
    rmSync(tempHome, { recursive: true, force: true })
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
    assert.ok(run.stdout.includes(`${SOURCE_CMD} quickstart --no-tui`), 'should hint at quickstart when no config')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('status command preserves one-off command hints under npm exec env', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-npx-'))
  try {
    const run = spawnSync(process.execPath, [BIN, 'status'], {
      env: {
        ...process.env,
        HOME: tempDir,
        PATH: process.env.PATH,
        npm_execpath: '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
        npm_command: 'exec',
        npm_lifecycle_event: 'npx',
        npm_config_user_agent: 'npm/11.9.0 node/v25.6.1 darwin arm64 workspaces/false'
      },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /Get started:\s+npx idlewatch quickstart --no-tui/)
    assert.doesNotMatch(run.stdout, /Get started:\s+idlewatch quickstart(?:\s|$)/)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('status command keeps npx background hints short and durable-install oriented', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-npx-config-'))
  try {
    const configDir = path.join(tempDir, '.idlewatch')
    fs.mkdirSync(path.join(configDir, 'logs'), { recursive: true })
    fs.writeFileSync(path.join(configDir, 'idlewatch.env'), [
      'IDLEWATCH_DEVICE_NAME=Hint Box',
      'IDLEWATCH_DEVICE_ID=hint-box',
      'IDLEWATCH_MONITOR_TARGETS=cpu,memory',
      'IDLEWATCH_OPENCLAW_USAGE=off'
    ].join('\n') + '\n')

    const npxEnv = {
      ...process.env,
      HOME: tempDir,
      PATH: process.env.PATH,
      npm_execpath: '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
      npm_command: 'exec',
      npm_lifecycle_event: 'npx',
      npm_config_user_agent: 'npm/11.9.0 node/v25.6.1 darwin arm64 workspaces/false'
    }

    const noSamples = spawnSync(process.execPath, [BIN, 'status'], {
      env: npxEnv,
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(noSamples.status, 0, noSamples.stderr)
    assert.match(noSamples.stdout, /Start:\s+npx idlewatch run/)
    assert.match(noSamples.stdout, /Install once:\s+npm install -g idlewatch/)
    assert.match(noSamples.stdout, /Then enable:\s+idlewatch install-agent/)
    assert.doesNotMatch(noSamples.stdout, /Background:\s+install IdleWatch globally first, then run idlewatch install-agent/)

    fs.writeFileSync(path.join(configDir, 'logs', 'hint-box-metrics.ndjson'), `{"ts":${Date.now()}}\n`)

    const withSamples = spawnSync(process.execPath, [BIN, 'status'], {
      env: npxEnv,
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(withSamples.status, 0, withSamples.stderr)
    assert.match(withSamples.stdout, /Change:\s+npx idlewatch configure --no-tui/)
    assert.doesNotMatch(withSamples.stdout, /Change:\s+npx idlewatch configure(?! --no-tui)(?:\s|$)/)
    assert.match(withSamples.stdout, /Install once:\s+npm install -g idlewatch/)
    assert.match(withSamples.stdout, /Then enable:\s+idlewatch install-agent/)
    assert.doesNotMatch(withSamples.stdout, /Background:\s+install IdleWatch globally first, then run idlewatch install-agent/)

    if (process.platform === 'darwin') {
      const fakeBinDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-npx-launchctl-bin-'))
      try {
        fs.writeFileSync(path.join(fakeBinDir, 'launchctl'), `#!/usr/bin/env bash
set -euo pipefail
cmd="\${1:-}"
if [[ "\$cmd" == "print" ]]; then
  exit 1
fi
if [[ "\$cmd" == "bootstrap" || "\$cmd" == "enable" || "\$cmd" == "bootout" || "\$cmd" == "disable" || "\$cmd" == "kickstart" ]]; then
  exit 0
fi
exit 0
`)
        fs.chmodSync(path.join(fakeBinDir, 'launchctl'), 0o755)

        const install = spawnSync(process.execPath, [BIN, 'install-agent'], {
          env: { ...process.env, HOME: tempDir, PATH: `${fakeBinDir}:${process.env.PATH}` },
          encoding: 'utf8',
          timeout: 15000
        })
        assert.equal(install.status, 0, install.stderr)

        const withInstalledAgent = spawnSync(process.execPath, [BIN, 'status'], {
          env: { ...npxEnv, PATH: `${fakeBinDir}:${process.env.PATH}` },
          encoding: 'utf8',
          timeout: 10000
        })

        assert.equal(withInstalledAgent.status, 0, withInstalledAgent.stderr)
        assert.match(withInstalledAgent.stdout, /Background:\s+installed but not running/)
        assert.match(withInstalledAgent.stdout, /Start:\s+idlewatch install-agent/)
        assert.doesNotMatch(withInstalledAgent.stdout, /Re-enable:\s+idlewatch install-agent/)
        assert.doesNotMatch(withInstalledAgent.stdout, /Install once:\s+npm install -g idlewatch/)
        assert.doesNotMatch(withInstalledAgent.stdout, /Then enable:\s+idlewatch install-agent/)
      } finally {
        rmSync(fakeBinDir, { recursive: true, force: true })
      }
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('status command treats quoted saved config values like normal values', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-quoted-env-'))
  try {
    const configDir = path.join(tempDir, '.idlewatch')
    fs.mkdirSync(path.join(configDir, 'logs'), { recursive: true })
    fs.writeFileSync(path.join(configDir, 'idlewatch.env'), [
      'IDLEWATCH_DEVICE_NAME="Quoted Box"',
      "IDLEWATCH_DEVICE_ID='quoted-box'",
      'IDLEWATCH_MONITOR_TARGETS="cpu,memory"',
      'IDLEWATCH_OPENCLAW_USAGE="off"',
      'IDLEWATCH_CLOUD_API_KEY="iwk_abcdefghijklmnopqrstuvwxyz123456"',
      `IDLEWATCH_LOCAL_LOG_PATH="${path.join(configDir, 'logs', 'quoted-box-metrics.ndjson')}"`
    ].join('\n') + '\n')

    fs.writeFileSync(path.join(configDir, 'logs', 'quoted-box-metrics.ndjson'), `{"ts":${Date.now()}}\n`)

    const run = spawnSync(process.execPath, [BIN, 'status'], {
      env: { ...process.env, HOME: tempDir, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /Device:\s+Quoted Box/)
    assert.match(run.stdout, /Publish mode:\s+local-only/)
    assert.match(run.stdout, /Metrics:\s+CPU, Memory/)
    assert.doesNotMatch(run.stdout, /"Quoted Box"|'Quoted Box'/)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('status command accepts saved config lines prefixed with export', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-export-env-'))
  try {
    const configDir = path.join(tempDir, '.idlewatch')
    fs.mkdirSync(path.join(configDir, 'logs'), { recursive: true })
    fs.writeFileSync(path.join(configDir, 'idlewatch.env'), [
      'export IDLEWATCH_DEVICE_NAME="Export Box"',
      'export IDLEWATCH_ENROLL_MODE=local',
      'export IDLEWATCH_MONITOR_TARGETS="cpu,memory"',
      `export IDLEWATCH_LOCAL_LOG_PATH="${path.join(configDir, 'logs', 'export-box-metrics.ndjson')}"`
    ].join('\n') + '\n')

    fs.writeFileSync(path.join(configDir, 'logs', 'export-box-metrics.ndjson'), `{"ts":${Date.now()}}\n`)

    const run = spawnSync(process.execPath, [BIN, 'status'], {
      env: { ...process.env, HOME: tempDir, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /Device:\s+Export Box/)
    assert.match(run.stdout, /Publish mode:\s+local-only/)
    assert.match(run.stdout, /Metrics:\s+CPU, Memory/)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('status command accepts saved config values with trailing inline comments', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-inline-comment-env-'))
  try {
    const configDir = path.join(tempDir, '.idlewatch')
    fs.mkdirSync(path.join(configDir, 'logs'), { recursive: true })
    fs.writeFileSync(path.join(configDir, 'idlewatch.env'), [
      'IDLEWATCH_DEVICE_NAME="Comment Box" # hand-edited label',
      'IDLEWATCH_ENROLL_MODE=local # keep local-only',
      'IDLEWATCH_MONITOR_TARGETS="cpu,memory" # default pair',
      `IDLEWATCH_LOCAL_LOG_PATH="${path.join(configDir, 'logs', 'comment-box-metrics.ndjson')}" # custom local log`
    ].join('\n') + '\n')

    fs.writeFileSync(path.join(configDir, 'logs', 'comment-box-metrics.ndjson'), `{"ts":${Date.now()}}\n`)

    const run = spawnSync(process.execPath, [BIN, 'status'], {
      env: { ...process.env, HOME: tempDir, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /Device:\s+Comment Box/)
    assert.match(run.stdout, /Publish mode:\s+local-only/)
    assert.match(run.stdout, /Metrics:\s+CPU, Memory/)
    assert.match(run.stdout, /Local log:\s+.*comment-box-metrics\.ndjson/)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('status command accepts a saved config file that starts with a UTF-8 BOM', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-bom-env-'))
  try {
    const configDir = path.join(tempDir, '.idlewatch')
    fs.mkdirSync(path.join(configDir, 'logs'), { recursive: true })
    fs.writeFileSync(path.join(configDir, 'idlewatch.env'), '\uFEFF' + [
      'export IDLEWATCH_DEVICE_NAME="BOM Box"',
      'export IDLEWATCH_ENROLL_MODE=local',
      'export IDLEWATCH_MONITOR_TARGETS="cpu,memory"',
      `export IDLEWATCH_LOCAL_LOG_PATH="${path.join(configDir, 'logs', 'bom-box-metrics.ndjson')}"`
    ].join('\n') + '\n')

    fs.writeFileSync(path.join(configDir, 'logs', 'bom-box-metrics.ndjson'), `{"ts":${Date.now()}}\n`)

    const run = spawnSync(process.execPath, [BIN, 'status'], {
      env: { ...process.env, HOME: tempDir, PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /Device:\s+BOM Box/)
    assert.match(run.stdout, /Publish mode:\s+local-only/)
    assert.match(run.stdout, /Metrics:\s+CPU, Memory/)
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

    if (process.platform === 'darwin') {
      assert.ok(noSamples.stdout.includes(`Enable:   ${SOURCE_CMD} install-agent`), 'should show enable hint when no samples exist and LaunchAgent is not installed')
      assert.ok(!noSamples.stdout.includes(`Re-enable:  ${SOURCE_CMD} install-agent`), 'should not suggest re-enabling when LaunchAgent was never installed')
      assert.ok(!noSamples.stdout.includes('Background: already enabled'), 'should not claim background is already enabled when LaunchAgent is not installed')
    }

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
    assert.ok(withSamples.stdout.includes(`${SOURCE_CMD} configure --no-tui`), 'should hint at non-TTY configure when samples exist')
    assert.doesNotMatch(withSamples.stdout, /Change:\s+node .*configure(?! --no-tui)(?:\s|$)/, 'should not fall back to plain configure in non-TTY status hints')
    assert.ok(!withSamples.stdout.includes('(none yet)'), 'should not show none yet when samples exist')

    if (process.platform === 'darwin') {
      assert.ok(withSamples.stdout.includes(`Enable:   ${SOURCE_CMD} install-agent`), 'should show enable hint when LaunchAgent is not installed')
      assert.ok(!withSamples.stdout.includes(`Re-enable:  ${SOURCE_CMD} install-agent`), 'should not suggest re-enabling when LaunchAgent was never installed')
      assert.doesNotMatch(withSamples.stdout, /Apply:.*already running in the background/, 'should not show running-agent apply hint after uninstall/not-installed state')
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('status command keeps running-agent apply hint aligned with saved-config wording', () => {
  if (process.platform !== 'darwin') return

  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-running-apply-'))
  const fakeBin = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-running-apply-bin-'))
  try {
    const configDir = path.join(tempHome, '.idlewatch')
    const logDir = path.join(configDir, 'logs')
    fs.mkdirSync(logDir, { recursive: true })
    fs.mkdirSync(path.join(tempHome, 'Library', 'LaunchAgents'), { recursive: true })
    fs.writeFileSync(path.join(tempHome, 'Library', 'LaunchAgents', 'com.idlewatch.agent.plist'), '<plist/>\n')
    fs.writeFileSync(path.join(configDir, 'idlewatch.env'), [
      'IDLEWATCH_DEVICE_NAME=Apply Box',
      'IDLEWATCH_DEVICE_ID=apply-box',
      'IDLEWATCH_MONITOR_TARGETS=cpu,memory',
      'IDLEWATCH_OPENCLAW_USAGE=off'
    ].join('\n') + '\n')
    fs.writeFileSync(path.join(logDir, 'apply-box-metrics.ndjson'), `{"ts":${Date.now()}}\n`)

    fs.writeFileSync(path.join(fakeBin, 'launchctl'), `#!/usr/bin/env bash
set -euo pipefail
cmd="\${1:-}"
if [[ "\$cmd" == "print" ]]; then
  cat <<'EOF'
pid = 4242
EOF
  exit 0
fi
exit 0
`, { mode: 0o755 })

    const run = spawnSync(process.execPath, [BIN, 'status'], {
      env: { ...process.env, HOME: tempHome, PATH: `${fakeBin}:${process.env.PATH}` },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.ok(run.stdout.includes('Background:   running in background (pid 4242)'), 'should report the running background state')
    assert.ok(run.stdout.includes(`Apply:    re-run ${SOURCE_CMD} install-agent to refresh it with the saved config`), 'should keep the running-agent apply hint aligned with saved-config wording')
    assert.ok(!run.stdout.includes('after config changes to refresh the background agent'), 'should drop the older longer apply wording')
  } finally {
    rmSync(fakeBin, { recursive: true, force: true })
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('status command keeps no-sample background hint honest when LaunchAgent is installed but not loaded', () => {
  if (process.platform !== 'darwin') return

  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-installed-not-loaded-'))
  const fakeBin = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-status-installed-not-loaded-bin-'))
  try {
    fs.mkdirSync(path.join(tempHome, '.idlewatch'), { recursive: true })
    fs.mkdirSync(path.join(tempHome, 'Library', 'LaunchAgents'), { recursive: true })
    fs.writeFileSync(path.join(tempHome, 'Library', 'LaunchAgents', 'com.idlewatch.agent.plist'), '<plist/>\n')
    fs.writeFileSync(path.join(tempHome, '.idlewatch', 'idlewatch.env'), [
      'IDLEWATCH_DEVICE_NAME=Hint Box',
      'IDLEWATCH_DEVICE_ID=hint-box',
      'IDLEWATCH_MONITOR_TARGETS=cpu,memory',
      'IDLEWATCH_OPENCLAW_USAGE=off'
    ].join('\n') + '\n')

    fs.writeFileSync(path.join(fakeBin, 'launchctl'), `#!/usr/bin/env bash
set -euo pipefail
cmd="\${1:-}"
if [[ "\$cmd" == "print" ]]; then
  exit 1
fi
exit 0
`, { mode: 0o755 })

    const run = spawnSync(process.execPath, [BIN, 'status'], {
      env: { ...process.env, HOME: tempHome, PATH: `${fakeBin}:${process.env.PATH}` },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.equal(run.status, 0, run.stderr)
    assert.ok(run.stdout.includes('(none yet)'), 'should still show no samples yet')
    assert.ok(run.stdout.includes('Background:   installed but not running'), 'should report the installed-not-loaded state')
    assert.ok(run.stdout.includes(`Start:    ${SOURCE_CMD} install-agent`), 'should suggest starting the saved background agent')
    assert.ok(!run.stdout.includes(`Re-enable:  ${SOURCE_CMD} install-agent`), 'should not frame an already-installed agent like a fresh enable')
    assert.ok(!run.stdout.includes(`Enable:   ${SOURCE_CMD} install-agent`), 'should not look like a first-time install path')
    assert.ok(!run.stdout.includes('Background: already enabled'), 'should not claim background is already enabled when launchd reports otherwise')
  } finally {
    rmSync(fakeBin, { recursive: true, force: true })
    rmSync(tempHome, { recursive: true, force: true })
  }
})

test('install-agent reports launchctl exit status when launchctl fails silently', () => {
  if (process.platform !== 'darwin') return

  const tempHome = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-install-launchctl-status-'))
  const fakeBin = mkdtempSync(path.join(os.tmpdir(), 'idlewatch-install-launchctl-status-bin-'))
  try {
    fs.mkdirSync(path.join(tempHome, '.idlewatch'), { recursive: true })
    fs.writeFileSync(path.join(tempHome, '.idlewatch', 'idlewatch.env'), [
      'IDLEWATCH_DEVICE_NAME=Status Box',
      'IDLEWATCH_DEVICE_ID=status-box',
      'IDLEWATCH_MONITOR_TARGETS=cpu,memory',
      'IDLEWATCH_OPENCLAW_USAGE=off'
    ].join('\n') + '\n')

    fs.writeFileSync(path.join(fakeBin, 'launchctl'), `#!/usr/bin/env bash
set -euo pipefail
cmd="\${1:-}"
if [[ "\$cmd" == "print" ]]; then
  exit 1
fi
exit 7
`, { mode: 0o755 })

    const run = spawnSync(process.execPath, [BIN, 'install-agent'], {
      env: { ...process.env, HOME: tempHome, PATH: `${fakeBin}:${process.env.PATH}` },
      encoding: 'utf8',
      timeout: 10000
    })

    assert.notEqual(run.status, 0, 'install should fail when launchctl bootstrap fails')
    assert.match(run.stderr, /Background mode install failed\./)
    assert.match(run.stderr, /launchctl exited with status 7/)
    assert.doesNotMatch(run.stderr, /unknown error/)
  } finally {
    rmSync(fakeBin, { recursive: true, force: true })
    rmSync(tempHome, { recursive: true, force: true })
  }
})
