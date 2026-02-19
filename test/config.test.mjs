import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

// Snapshot and restore env around each test
let savedEnv

function clearIdlewatchEnv() {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('IDLEWATCH_') || key.startsWith('FIREBASE_') || key === 'FIRESTORE_EMULATOR_HOST') {
      delete process.env[key]
    }
  }
}

async function freshBuildConfig() {
  // Dynamic import with cache-bust to pick up env changes
  const mod = await import(`../src/config.js?t=${Date.now()}-${Math.random()}`)
  return mod.buildConfig
}

describe('buildConfig', () => {
  beforeEach(() => {
    savedEnv = { ...process.env }
    clearIdlewatchEnv()
  })

  afterEach(() => {
    // Restore original env
    clearIdlewatchEnv()
    for (const [k, v] of Object.entries(savedEnv)) {
      process.env[k] = v
    }
  })

  it('returns default config with no env vars', async () => {
    const buildConfig = (await import(`../src/config.js?t=${Date.now()}`)).buildConfig
    const cfg = buildConfig()
    assert.equal(cfg.INTERVAL_MS, 10000)
    assert.equal(cfg.OPENCLAW_USAGE_MODE, 'auto')
    assert.equal(cfg.OPENCLAW_PROBE_TIMEOUT_MS, 2500)
    assert.equal(cfg.OPENCLAW_PROBE_RETRIES, 1)
    assert.equal(cfg.USAGE_REFRESH_ON_NEAR_STALE, 1)
    assert.equal(cfg.REQUIRE_FIREBASE_WRITES, false)
    assert.ok(cfg.HOST)
    assert.ok(cfg.LOCAL_LOG_PATH)
    assert.ok(Object.isFrozen(cfg))
  })

  it('respects IDLEWATCH_INTERVAL_MS', async () => {
    process.env.IDLEWATCH_INTERVAL_MS = '5000'
    const buildConfig = (await import(`../src/config.js?t=${Date.now()}-2`)).buildConfig
    const cfg = buildConfig()
    assert.equal(cfg.INTERVAL_MS, 5000)
  })

  it('throws on invalid IDLEWATCH_INTERVAL_MS', async () => {
    process.env.IDLEWATCH_INTERVAL_MS = '-1'
    const buildConfig = (await import(`../src/config.js?t=${Date.now()}-3`)).buildConfig
    assert.throws(() => buildConfig(), /Invalid IDLEWATCH_INTERVAL_MS/)
  })

  it('throws on non-numeric IDLEWATCH_INTERVAL_MS', async () => {
    process.env.IDLEWATCH_INTERVAL_MS = 'abc'
    const buildConfig = (await import(`../src/config.js?t=${Date.now()}-4`)).buildConfig
    assert.throws(() => buildConfig(), /Invalid IDLEWATCH_INTERVAL_MS/)
  })

  it('throws on invalid IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE', async () => {
    process.env.IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE = '3'
    const buildConfig = (await import(`../src/config.js?t=${Date.now()}-5`)).buildConfig
    assert.throws(() => buildConfig(), /Invalid IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE/)
  })

  it('derives stale thresholds from interval', async () => {
    process.env.IDLEWATCH_INTERVAL_MS = '20000'
    const buildConfig = (await import(`../src/config.js?t=${Date.now()}-6`)).buildConfig
    const cfg = buildConfig()
    assert.equal(cfg.USAGE_STALE_MS, 60000) // max(20000*3, 60000)
    assert.equal(cfg.USAGE_STALE_GRACE_MS, 10000) // min(20000, 10000)
  })

  it('picks up custom host', async () => {
    process.env.IDLEWATCH_HOST = 'my-host'
    const buildConfig = (await import(`../src/config.js?t=${Date.now()}-7`)).buildConfig
    const cfg = buildConfig()
    assert.equal(cfg.HOST, 'my-host')
    assert.equal(cfg.SAFE_HOST, 'my-host')
  })

  it('sanitizes host with special chars', async () => {
    process.env.IDLEWATCH_HOST = 'my host/foo'
    const buildConfig = (await import(`../src/config.js?t=${Date.now()}-8`)).buildConfig
    const cfg = buildConfig()
    assert.equal(cfg.SAFE_HOST, 'my_host_foo')
  })

  it('sets openclaw usage mode from env', async () => {
    process.env.IDLEWATCH_OPENCLAW_USAGE = 'OFF'
    const buildConfig = (await import(`../src/config.js?t=${Date.now()}-9`)).buildConfig
    const cfg = buildConfig()
    assert.equal(cfg.OPENCLAW_USAGE_MODE, 'off')
  })

  it('sets firebase config', async () => {
    process.env.FIREBASE_PROJECT_ID = 'test-project'
    process.env.FIREBASE_SERVICE_ACCOUNT_FILE = '/tmp/sa.json'
    const buildConfig = (await import(`../src/config.js?t=${Date.now()}-10`)).buildConfig
    const cfg = buildConfig()
    assert.equal(cfg.FIREBASE.PROJECT_ID, 'test-project')
    assert.equal(cfg.FIREBASE.CREDS_FILE, '/tmp/sa.json')
  })
})
