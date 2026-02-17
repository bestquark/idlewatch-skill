#!/usr/bin/env node
import fs from 'fs'
import os from 'os'
import path from 'path'
import process from 'process'
import { execFileSync } from 'child_process'
import { createRequire } from 'module'
import { parseOpenClawUsage } from '../src/openclaw-usage.js'
import { gpuSampleDarwin } from '../src/gpu.js'
import { memUsedPct, memoryPressureDarwin } from '../src/memory.js'
import { deriveUsageFreshness } from '../src/usage-freshness.js'
import { deriveUsageAlert } from '../src/usage-alert.js'
import { loadLastGoodUsageSnapshot, persistLastGoodUsageSnapshot } from '../src/openclaw-cache.js'
import { runEnrollmentWizard } from '../src/enrollment.js'
import { enrichWithOpenClawFleetTelemetry } from '../src/telemetry-mapping.js'
import pkg from '../package.json' with { type: 'json' }

function printHelp() {
  console.log(`idlewatch-agent\n\nUsage:\n  idlewatch-agent [quickstart] [--dry-run] [--once] [--help]\n\nOptions:\n  quickstart  Run first-run enrollment wizard and generate secure env config\n  --dry-run   Collect and print one telemetry sample, then exit without Firebase writes\n  --once      Collect and publish one telemetry sample, then exit\n  --help      Show this help message\n\nEnvironment:\n  IDLEWATCH_HOST                     Optional custom host label (default: hostname)\n  IDLEWATCH_INTERVAL_MS              Sampling interval in ms (default: 10000)\n  IDLEWATCH_LOCAL_LOG_PATH           Optional NDJSON file path for local sample durability\n  IDLEWATCH_OPENCLAW_USAGE           OpenClaw usage lookup mode: auto|off (default: auto)\n  IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS OpenClaw command timeout per probe in ms (default: 2500)\n  IDLEWATCH_OPENCLAW_PROBE_RETRIES   Extra OpenClaw probe sweep retries after first pass (default: 1)\n  IDLEWATCH_USAGE_STALE_MS           Mark OpenClaw usage stale beyond this age in ms (default: max(interval*3,60000))\n  IDLEWATCH_USAGE_NEAR_STALE_MS      Mark OpenClaw usage as aging beyond this age in ms (default: floor((stale+grace)*0.85))\n  IDLEWATCH_USAGE_STALE_GRACE_MS     Extra grace window before status becomes stale (default: min(interval,10000))\n  IDLEWATCH_USAGE_REFRESH_REPROBES   Forced uncached reprobes when usage crosses stale threshold (default: 1)\n  IDLEWATCH_USAGE_REFRESH_DELAY_MS   Delay between forced stale-threshold reprobes in ms (default: 250)\n  IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE Trigger refresh when usage is near-stale: 1|0 (default: 1)\n  IDLEWATCH_USAGE_IDLE_AFTER_MS      Downgrade stale usage alerts to idle notice beyond this age in ms (default: 21600000)\n  IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS  Reuse last successful usage snapshot after probe failures up to this age in ms\n  IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH Persist/reuse last successful usage snapshot across restarts (default: os tmp dir)\n  IDLEWATCH_REQUIRE_FIREBASE_WRITES  Require Firebase publish path in --once mode: 1|0 (default: 0)\n  FIREBASE_PROJECT_ID                Firebase project id\n  FIREBASE_SERVICE_ACCOUNT_FILE      Path to service account JSON file (preferred for production)\n  FIREBASE_SERVICE_ACCOUNT_JSON      Raw JSON service account (supported, less secure than file path)\n  FIREBASE_SERVICE_ACCOUNT_B64       Base64-encoded JSON service account (legacy)\n  FIRESTORE_EMULATOR_HOST            Optional Firestore emulator host; allows local writes without service-account creds\n`)
}

const require = createRequire(import.meta.url)

const argv = process.argv.slice(2)
const quickstartRequested = argv[0] === 'quickstart' || argv.includes('--quickstart')
const args = new Set(argv)
if (args.has('--help') || args.has('-h')) {
  printHelp()
  process.exit(0)
}

if (quickstartRequested) {
  try {
    const result = await runEnrollmentWizard()
    console.log(`Enrollment complete. Mode=${result.mode} envFile=${result.outputEnvFile}`)
    console.log(`Next step: set -a; source "${result.outputEnvFile}"; set +a`)
    console.log('Then run: idlewatch-agent --once')
    process.exit(0)
  } catch (err) {
    console.error(`Enrollment failed: ${err.message}`)
    process.exit(1)
  }
}

const DRY_RUN = args.has('--dry-run')
const ONCE = args.has('--once')
const HOST = process.env.IDLEWATCH_HOST || os.hostname()
const SAFE_HOST = HOST.replace(/[^a-zA-Z0-9_.-]/g, '_')
const INTERVAL_MS = Number(process.env.IDLEWATCH_INTERVAL_MS || 10000)
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID
const CREDS_FILE = process.env.FIREBASE_SERVICE_ACCOUNT_FILE
const CREDS_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
const CREDS_B64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST
const OPENCLAW_USAGE_MODE = (process.env.IDLEWATCH_OPENCLAW_USAGE || 'auto').toLowerCase()
const REQUIRE_FIREBASE_WRITES = process.env.IDLEWATCH_REQUIRE_FIREBASE_WRITES === '1'
const OPENCLAW_PROBE_TIMEOUT_MS = Number(process.env.IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS || 2500)
const OPENCLAW_BIN_STRICT = process.env.IDLEWATCH_OPENCLAW_BIN_STRICT === '1'
const OPENCLAW_PROBE_RETRIES = process.env.IDLEWATCH_OPENCLAW_PROBE_RETRIES
  ? Number(process.env.IDLEWATCH_OPENCLAW_PROBE_RETRIES)
  : 1
const LOCAL_LOG_PATH = process.env.IDLEWATCH_LOCAL_LOG_PATH
  ? path.resolve(process.env.IDLEWATCH_LOCAL_LOG_PATH)
  : path.resolve(process.cwd(), 'logs', `${SAFE_HOST}-metrics.ndjson`)

if (!Number.isFinite(INTERVAL_MS) || INTERVAL_MS <= 0) {
  console.error(`Invalid IDLEWATCH_INTERVAL_MS: ${process.env.IDLEWATCH_INTERVAL_MS}. Expected a positive number.`)
  process.exit(1)
}

if (!Number.isFinite(OPENCLAW_PROBE_TIMEOUT_MS) || OPENCLAW_PROBE_TIMEOUT_MS <= 0) {
  console.error(
    `Invalid IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS: ${process.env.IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS}. Expected a positive number.`
  )
  process.exit(1)
}

if (!Number.isInteger(OPENCLAW_PROBE_RETRIES) || OPENCLAW_PROBE_RETRIES < 0) {
  console.error(
    `Invalid IDLEWATCH_OPENCLAW_PROBE_RETRIES: ${process.env.IDLEWATCH_OPENCLAW_PROBE_RETRIES}. Expected an integer >= 0.`
  )
  process.exit(1)
}

const USAGE_STALE_MS = process.env.IDLEWATCH_USAGE_STALE_MS
  ? Number(process.env.IDLEWATCH_USAGE_STALE_MS)
  : Math.max(INTERVAL_MS * 3, 60000)

if (!Number.isFinite(USAGE_STALE_MS) || USAGE_STALE_MS <= 0) {
  console.error(`Invalid IDLEWATCH_USAGE_STALE_MS: ${process.env.IDLEWATCH_USAGE_STALE_MS}. Expected a positive number.`)
  process.exit(1)
}

const USAGE_STALE_GRACE_MS = process.env.IDLEWATCH_USAGE_STALE_GRACE_MS
  ? Number(process.env.IDLEWATCH_USAGE_STALE_GRACE_MS)
  : Math.min(INTERVAL_MS, 10000)

if (!Number.isFinite(USAGE_STALE_GRACE_MS) || USAGE_STALE_GRACE_MS < 0) {
  console.error(
    `Invalid IDLEWATCH_USAGE_STALE_GRACE_MS: ${process.env.IDLEWATCH_USAGE_STALE_GRACE_MS}. Expected a non-negative number.`
  )
  process.exit(1)
}

const USAGE_NEAR_STALE_MS = process.env.IDLEWATCH_USAGE_NEAR_STALE_MS
  ? Number(process.env.IDLEWATCH_USAGE_NEAR_STALE_MS)
  : Math.floor((USAGE_STALE_MS + USAGE_STALE_GRACE_MS) * 0.85)

if (!Number.isFinite(USAGE_NEAR_STALE_MS) || USAGE_NEAR_STALE_MS < 0) {
  console.error(
    `Invalid IDLEWATCH_USAGE_NEAR_STALE_MS: ${process.env.IDLEWATCH_USAGE_NEAR_STALE_MS}. Expected a non-negative number.`
  )
  process.exit(1)
}

const USAGE_REFRESH_REPROBES = process.env.IDLEWATCH_USAGE_REFRESH_REPROBES
  ? Number(process.env.IDLEWATCH_USAGE_REFRESH_REPROBES)
  : 1

if (!Number.isInteger(USAGE_REFRESH_REPROBES) || USAGE_REFRESH_REPROBES < 0) {
  console.error(
    `Invalid IDLEWATCH_USAGE_REFRESH_REPROBES: ${process.env.IDLEWATCH_USAGE_REFRESH_REPROBES}. Expected an integer >= 0.`
  )
  process.exit(1)
}

const USAGE_REFRESH_DELAY_MS = process.env.IDLEWATCH_USAGE_REFRESH_DELAY_MS
  ? Number(process.env.IDLEWATCH_USAGE_REFRESH_DELAY_MS)
  : 250

if (!Number.isFinite(USAGE_REFRESH_DELAY_MS) || USAGE_REFRESH_DELAY_MS < 0) {
  console.error(
    `Invalid IDLEWATCH_USAGE_REFRESH_DELAY_MS: ${process.env.IDLEWATCH_USAGE_REFRESH_DELAY_MS}. Expected a non-negative number.`
  )
  process.exit(1)
}

const USAGE_REFRESH_ON_NEAR_STALE = process.env.IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE
  ? Number(process.env.IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE)
  : 1

if (![0, 1].includes(USAGE_REFRESH_ON_NEAR_STALE)) {
  console.error(
    `Invalid IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE: ${process.env.IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE}. Expected 0 or 1.`
  )
  process.exit(1)
}

const USAGE_IDLE_AFTER_MS = process.env.IDLEWATCH_USAGE_IDLE_AFTER_MS
  ? Number(process.env.IDLEWATCH_USAGE_IDLE_AFTER_MS)
  : 21600000

if (!Number.isFinite(USAGE_IDLE_AFTER_MS) || USAGE_IDLE_AFTER_MS <= 0) {
  console.error(
    `Invalid IDLEWATCH_USAGE_IDLE_AFTER_MS: ${process.env.IDLEWATCH_USAGE_IDLE_AFTER_MS}. Expected a positive number.`
  )
  process.exit(1)
}

const OPENCLAW_LAST_GOOD_MAX_AGE_MS = process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS
  ? Number(process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS)
  : Math.max(USAGE_STALE_MS + USAGE_STALE_GRACE_MS, 120000)

if (process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS && (!Number.isFinite(OPENCLAW_LAST_GOOD_MAX_AGE_MS) || OPENCLAW_LAST_GOOD_MAX_AGE_MS <= 0)) {
  console.error(
    `Invalid IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS: ${process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS}. Expected a positive number.`
  )
  process.exit(1)
}

const OPENCLAW_LAST_GOOD_CACHE_PATH = process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH
  ? path.resolve(process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH)
  : path.join(os.tmpdir(), `idlewatch-openclaw-last-good-${SAFE_HOST}.json`)

let appReady = false
let firebaseConfigError = null
let admin = null

function loadFirebaseAdmin() {
  if (admin) return admin
  try {
    admin = require('firebase-admin')
    return admin
  } catch (err) {
    firebaseConfigError = `Failed to load firebase-admin runtime dependency: ${err.message}`
    return null
  }
}

if (PROJECT_ID || CREDS_FILE || CREDS_JSON || CREDS_B64 || FIRESTORE_EMULATOR_HOST) {
  if (!PROJECT_ID) {
    firebaseConfigError =
      'FIREBASE_PROJECT_ID is missing. Set FIREBASE_PROJECT_ID plus FIREBASE_SERVICE_ACCOUNT_FILE (preferred) or FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_B64. For emulator-only mode, set FIREBASE_PROJECT_ID + FIRESTORE_EMULATOR_HOST.'
  } else if (FIRESTORE_EMULATOR_HOST) {
    const firebaseAdmin = loadFirebaseAdmin()
    if (firebaseAdmin) {
      try {
        firebaseAdmin.initializeApp({ projectId: PROJECT_ID })
        appReady = true
      } catch (err) {
        firebaseConfigError = `Failed to initialize Firebase emulator mode: ${err.message}`
      }
    }
  } else if (!CREDS_FILE && !CREDS_JSON && !CREDS_B64) {
    firebaseConfigError =
      'Firebase credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_FILE (preferred) or FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_B64. For emulator-only mode, set FIRESTORE_EMULATOR_HOST.'
  } else {
    const firebaseAdmin = loadFirebaseAdmin()
    if (firebaseAdmin) {
      try {
        const credsRaw = CREDS_FILE
          ? fs.readFileSync(path.resolve(CREDS_FILE), 'utf8')
          : (CREDS_JSON || Buffer.from(CREDS_B64, 'base64').toString('utf8'))
        const creds = JSON.parse(credsRaw)
        firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.cert(creds), projectId: PROJECT_ID })
        appReady = true
      } catch (err) {
        firebaseConfigError = `Failed to initialize Firebase credentials: ${err.message}`
      }
    }
  }
}

if (firebaseConfigError) {
  console.error(`Firebase configuration error: ${firebaseConfigError}`)
  process.exit(1)
}

if (!appReady) {
  console.error(
    'Firebase is not configured. Running in local-only mode (stdout logging only). Set FIREBASE_PROJECT_ID + FIREBASE_SERVICE_ACCOUNT_FILE (preferred, or FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_B64), or use FIREBASE_PROJECT_ID + FIRESTORE_EMULATOR_HOST for emulator writes.'
  )
}

if (REQUIRE_FIREBASE_WRITES && !appReady) {
  console.error(
    'IDLEWATCH_REQUIRE_FIREBASE_WRITES=1 requires Firebase to be configured. Set FIREBASE_PROJECT_ID with service-account creds (or FIRESTORE_EMULATOR_HOST for emulator mode).'
  )
  process.exit(1)
}

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function appendLocal(row) {
  try {
    ensureDirFor(LOCAL_LOG_PATH)
    fs.appendFileSync(LOCAL_LOG_PATH, `${JSON.stringify(row)}\n`, 'utf8')
  } catch (err) {
    console.error(`Local log append failed (${LOCAL_LOG_PATH}): ${err.message}`)
  }
}

function snapshotCpuTimes() {
  return os.cpus().map((c) => ({ ...c.times }))
}

function cpuPctFromDeltas(previous, current) {
  if (!previous || !current || previous.length !== current.length) return null
  let idle = 0
  let total = 0
  for (let i = 0; i < previous.length; i++) {
    const before = previous[i]
    const after = current[i]
    const didle = after.idle - before.idle
    const dtotal =
      (after.user - before.user) +
      (after.nice - before.nice) +
      (after.sys - before.sys) +
      (after.irq - before.irq) +
      didle
    idle += didle
    total += dtotal
  }
  if (total <= 0) return null
  return Math.max(0, Math.min(100, Number((100 * (1 - idle / total)).toFixed(2))))
}

let previousCpuSnapshot = snapshotCpuTimes()
function cpuPct() {
  const current = snapshotCpuTimes()
  const pct = cpuPctFromDeltas(previousCpuSnapshot, current)
  previousCpuSnapshot = current
  return pct ?? 0
}

const OPENCLAW_USAGE_TTL_MS = Math.max(INTERVAL_MS, 30000)
const MEM_PRESSURE_TTL_MS = Math.max(INTERVAL_MS, 30000)
let openClawUsageCache = {
  at: 0,
  value: {
    usage: null,
    probe: {
      result: OPENCLAW_USAGE_MODE === 'off' ? 'disabled' : 'unavailable',
      attempts: 0,
      sweeps: 0,
      command: null,
      error: null,
      usedFallbackCache: false,
      fallbackAgeMs: null,
      fallbackCacheSource: null
    }
  }
}
let lastGoodOpenClawUsage = (() => {
  const cached = loadLastGoodUsageSnapshot(OPENCLAW_LAST_GOOD_CACHE_PATH)
  if (!cached) return null
  return { at: cached.at, usage: cached.usage, source: 'disk' }
})()
let preferredOpenClawProbe = null
let memPressureCache = { at: 0, value: { pct: null, cls: 'unavailable', source: 'unavailable' } }

function loadMemPressure() {
  if (process.platform !== 'darwin') {
    return { pct: null, cls: 'unavailable', source: 'unsupported' }
  }

  const now = Date.now()
  if (now - memPressureCache.at < MEM_PRESSURE_TTL_MS) return memPressureCache.value
  const sampled = memoryPressureDarwin()
  memPressureCache = { at: now, value: sampled }
  return sampled
}

function resolveOpenClawBinaries() {
  const explicit = process.env.IDLEWATCH_OPENCLAW_BIN?.trim()
  const homeDir = process.env.HOME?.trim()

  if (OPENCLAW_BIN_STRICT && explicit) {
    return [explicit]
  }

  const bins = [
    explicit,
    '/opt/homebrew/bin/openclaw',
    '/usr/local/bin/openclaw',
    '/usr/bin/openclaw',
    '/usr/local/sbin/openclaw',
    '/usr/sbin/openclaw',
    homeDir ? `${homeDir}/.local/bin/openclaw` : null,
    homeDir ? `${homeDir}/bin/openclaw` : null,
    'openclaw'
  ].filter(Boolean)

  const deduped = []
  const seen = new Set()
  for (const binPath of bins) {
    if (seen.has(binPath)) continue
    seen.add(binPath)
    deduped.push(binPath)
  }
  return deduped
}

function loadOpenClawUsage(forceRefresh = false) {
  if (OPENCLAW_USAGE_MODE === 'off') {
    return {
      usage: null,
      probe: {
        result: 'disabled',
        attempts: 0,
        sweeps: 0,
        command: null,
        error: null,
        usedFallbackCache: false,
        fallbackAgeMs: null,
        fallbackCacheSource: null,
        durationMs: null
      }
    }
  }

  const now = Date.now()
  if (!forceRefresh && now - openClawUsageCache.at < OPENCLAW_USAGE_TTL_MS) return openClawUsageCache.value

  const binaries = resolveOpenClawBinaries()
  const subcommands = [
    ['status', '--json'],
    ['session', 'status', '--json'],
    ['session_status', '--json'],
    ['stats', '--json']
  ]

  function runProbe(binPath, args) {
    const startMs = Date.now()
    try {
      const out = execFileSync(binPath, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: OPENCLAW_PROBE_TIMEOUT_MS
      })
      return { out, error: null, status: 'ok', durationMs: Date.now() - startMs }
    } catch (err) {
      const stdoutText = typeof err?.stdout === 'string' ? err.stdout : ''
      const stderrText = typeof err?.stderr === 'string' ? err.stderr : ''
      const stdoutPayload = stdoutText.trim()
      const stderrPayload = stderrText.trim()
      const cmdStatus = err?.status

      if (stdoutPayload || stderrPayload) {
        const candidateOutput = stdoutPayload || stderrPayload
        return {
          out: candidateOutput,
          error: `command-exited-${String(cmdStatus || 'nonzero')}: ${(stderrPayload || 'non-zero-exit').split('\n')[0].slice(0, 120)}`,
          status: 'ok-with-stderr',
          durationMs: Date.now() - startMs
        }
      }

      if (err?.code === 'ENOENT') {
        return { out: null, error: 'openclaw-not-found', status: 'command-error', durationMs: Date.now() - startMs }
      }

      return {
        out: null,
        error: err?.message ? String(err.message).split('\n')[0].slice(0, 180) : 'command-failed',
        status: 'command-error',
        durationMs: Date.now() - startMs
      }
    }
  }

  let attempts = 0
  let sweeps = 0
  let sawCommandError = false
  let sawParseError = false
  let lastError = null

  const evaluateProbe = (binPath, cmdArgs, isPreferred = false) => {
    const cmdText = `${binPath} ${cmdArgs.join(' ')}`
    attempts += 1
    const probeRun = runProbe(binPath, cmdArgs)

    if (probeRun.out !== null) {
      const parsed = parseOpenClawUsage(probeRun.out)
      if (parsed) {
        preferredOpenClawProbe = { binPath, args: cmdArgs }
        const usage = { ...parsed, sourceCommand: cmdText }
        const value = {
          usage,
          probe: {
            result: 'ok',
            attempts,
            sweeps,
            command: cmdText,
            error: probeRun.status === 'ok-with-stderr' ? probeRun.error : null,
            usedFallbackCache: false,
            fallbackAgeMs: null,
            fallbackCacheSource: null,
            durationMs: probeRun.durationMs
          }
        }
        lastGoodOpenClawUsage = { at: now, usage, source: 'memory' }
        persistLastGoodUsageSnapshot(OPENCLAW_LAST_GOOD_CACHE_PATH, { at: now, usage })
        openClawUsageCache = { at: now, value }
        return value
      }

      sawParseError = true
      lastError = 'unrecognized-json-shape'
      preferredOpenClawProbe = isPreferred ? null : preferredOpenClawProbe
      return null
    }

    if (probeRun.status === 'command-error') {
      if (probeRun.error === 'openclaw-not-found') {
        lastError = probeRun.error
        preferredOpenClawProbe = isPreferred ? null : preferredOpenClawProbe
        return null
      }
      sawCommandError = true
      lastError = probeRun.error
      preferredOpenClawProbe = isPreferred ? null : preferredOpenClawProbe
      return null
    }

    return null
  }

  if (preferredOpenClawProbe) {
    sweeps = 1
    const cachedResult = evaluateProbe(preferredOpenClawProbe.binPath, preferredOpenClawProbe.args, true)
    if (cachedResult) {
      return cachedResult
    }
  }

  for (let sweep = 0; sweep <= OPENCLAW_PROBE_RETRIES; sweep++) {
    sweeps = sweep + 1
    for (const binPath of binaries) {
      for (const args of subcommands) {
        const candidateResult = evaluateProbe(binPath, args)
        if (candidateResult) return candidateResult
      }
    }
  }

  const result = sawParseError
    ? 'parse-error'
    : sawCommandError
      ? 'command-error'
      : 'command-missing'

  const fallbackAgeMs = lastGoodOpenClawUsage ? now - lastGoodOpenClawUsage.at : null
  if (lastGoodOpenClawUsage && Number.isFinite(fallbackAgeMs) && fallbackAgeMs <= OPENCLAW_LAST_GOOD_MAX_AGE_MS) {
    const value = {
      usage: { ...lastGoodOpenClawUsage.usage, sourceCommand: `${lastGoodOpenClawUsage.usage.sourceCommand} (cached)` },
      probe: {
        result: 'fallback-cache',
        attempts,
        sweeps,
        command: null,
        error: lastError,
        usedFallbackCache: true,
        fallbackAgeMs,
        fallbackCacheSource: lastGoodOpenClawUsage.source || 'memory',
        durationMs: null
      }
    }
    openClawUsageCache = { at: now, value }
    return value
  }

  const value = {
    usage: null,
    probe: {
      result,
      attempts,
      sweeps,
      command: null,
      error: lastError,
      usedFallbackCache: false,
      fallbackAgeMs: null,
      fallbackCacheSource: null,
      durationMs: null
    }
  }
  openClawUsageCache = { at: now, value }
  return value
}

async function publish(row, retries = 2) {
  if (!appReady || DRY_RUN) return false
  const db = admin.firestore()
  let attempt = 0
  while (attempt <= retries) {
    try {
      await db.collection('metrics').add(row)
      return true
    } catch (err) {
      if (attempt >= retries) throw err
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
      attempt += 1
    }
  }
  return false
}

async function collectSample() {
  const sampleStartMs = Date.now()
  let usageProbe = loadOpenClawUsage()
  let usage = usageProbe.usage
  let usageFreshness = deriveUsageFreshness(usage, sampleStartMs, USAGE_STALE_MS, USAGE_NEAR_STALE_MS, USAGE_STALE_GRACE_MS)
  let usageRefreshAttempted = false
  let usageRefreshRecovered = false
  let usageRefreshAttempts = 0
  let usageRefreshDurationMs = null
  let usageRefreshStartMs = null

  const shouldRefreshForNearStale = USAGE_REFRESH_ON_NEAR_STALE === 1 && usageFreshness.isNearStale
  const canRefreshFromCurrentState = usageProbe.probe.result === 'ok' || usageProbe.probe.result === 'fallback-cache'
  if (usage && (usageFreshness.isPastStaleThreshold || shouldRefreshForNearStale) && canRefreshFromCurrentState) {
    usageRefreshAttempted = true
    usageRefreshStartMs = Date.now()

    for (let attempt = 0; attempt <= USAGE_REFRESH_REPROBES; attempt++) {
      usageRefreshAttempts += 1
      if (attempt > 0 && USAGE_REFRESH_DELAY_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, USAGE_REFRESH_DELAY_MS))
      }

      const refreshedUsageProbe = loadOpenClawUsage(true)
      const refreshedUsage = refreshedUsageProbe.usage
      const refreshedUsageTs = refreshedUsage?.usageTimestampMs
      const previousUsageTs = usage?.usageTimestampMs

      if (Number.isFinite(refreshedUsageTs) && (!Number.isFinite(previousUsageTs) || refreshedUsageTs > previousUsageTs)) {
        usageProbe = refreshedUsageProbe
        usage = refreshedUsage
        usageFreshness = deriveUsageFreshness(usage, Date.now(), USAGE_STALE_MS, USAGE_NEAR_STALE_MS, USAGE_STALE_GRACE_MS)
      }

      if (!usageFreshness.isPastStaleThreshold) break
    }

    usageRefreshDurationMs = usageRefreshStartMs !== null ? Date.now() - usageRefreshStartMs : null
    usageRefreshRecovered = usageFreshness.isPastStaleThreshold === false
  }

  const sampleAtMs = Date.now()
  if (usage) {
    usageFreshness = deriveUsageFreshness(usage, sampleAtMs, USAGE_STALE_MS, USAGE_NEAR_STALE_MS, USAGE_STALE_GRACE_MS)
  }

  const gpu = process.platform === 'darwin'
    ? gpuSampleDarwin()
    : { pct: null, source: 'unsupported', confidence: 'none', sampleWindowMs: null }
  const memPressure = loadMemPressure()
  const usedMemPct = memUsedPct()

  const usageIntegrationStatus = usage
    ? usageFreshness.isStale
      ? 'stale'
      : usage?.integrationStatus === 'partial'
        ? 'ok'
        : (usage?.integrationStatus ?? 'ok')
    : (OPENCLAW_USAGE_MODE === 'off' ? 'disabled' : 'unavailable')

  const source = {
    usage: usage ? 'openclaw' : OPENCLAW_USAGE_MODE === 'off' ? 'disabled' : 'unavailable',
    usageIntegrationStatus,
    usageIngestionStatus: OPENCLAW_USAGE_MODE === 'off'
      ? 'disabled'
      : usage && ['ok', 'fallback-cache'].includes(usageProbe.probe.result)
        ? 'ok'
        : 'unavailable',
    usageActivityStatus: usage
      ? usageFreshness.freshnessState
      : (OPENCLAW_USAGE_MODE === 'off' ? 'disabled' : 'unavailable'),
    usageProbeResult: usageProbe.probe.result,
    usageProbeAttempts: usageProbe.probe.attempts,
    usageProbeSweeps: usageProbe.probe.sweeps,
    usageProbeTimeoutMs: OPENCLAW_PROBE_TIMEOUT_MS,
    usageProbeRetries: OPENCLAW_PROBE_RETRIES,
    usageProbeError: usageProbe.probe.error,
    usageProbeDurationMs: usageProbe.probe.durationMs,
    usageUsedFallbackCache: usageProbe.probe.usedFallbackCache,
    usageFallbackCacheAgeMs: usageProbe.probe.fallbackAgeMs,
    usageFallbackCacheSource: usageProbe.probe.fallbackCacheSource,
    usageFreshnessState: usage ? usageFreshness.freshnessState : null,
    usageNearStale: usage ? usageFreshness.isNearStale : false,
    usagePastStaleThreshold: usage ? usageFreshness.isPastStaleThreshold : false,
    usageRefreshAttempted,
    usageRefreshRecovered,
    usageRefreshAttempts,
    usageRefreshReprobes: USAGE_REFRESH_REPROBES,
    usageRefreshDelayMs: USAGE_REFRESH_DELAY_MS,
    usageRefreshDurationMs,
    usageRefreshOnNearStale: USAGE_REFRESH_ON_NEAR_STALE === 1,
    usageIdleAfterMsThreshold: USAGE_IDLE_AFTER_MS,
    usageIdle: usage ? (Number.isFinite(usageFreshness.usageAgeMs) && usageFreshness.usageAgeMs >= USAGE_IDLE_AFTER_MS) : false,
    usageCommand: usage?.sourceCommand ?? null,
    usageStaleMsThreshold: USAGE_STALE_MS,
    usageNearStaleMsThreshold: USAGE_NEAR_STALE_MS,
    usageStaleGraceMs: USAGE_STALE_GRACE_MS,
    memPressureSource: memPressure.source
  }

  const usageAlert = deriveUsageAlert(source, { usageAgeMs: usageFreshness.usageAgeMs, idleAfterMs: USAGE_IDLE_AFTER_MS })
  source.usageAlertLevel = usageAlert.level
  source.usageAlertReason = usageAlert.reason

  const row = {
    host: HOST,
    ts: sampleAtMs,
    cpuPct: cpuPct(),
    memPct: usedMemPct,
    memUsedPct: usedMemPct,
    memPressurePct: memPressure.pct,
    memPressureClass: memPressure.cls,
    gpuPct: gpu.pct,
    gpuSource: gpu.source,
    gpuConfidence: gpu.confidence,
    gpuSampleWindowMs: gpu.sampleWindowMs,
    tokensPerMin: usage?.tokensPerMin ?? null,
    openclawModel: usage?.model ?? null,
    openclawTotalTokens: usage?.totalTokens ?? null,
    openclawSessionId: usage?.sessionId ?? null,
    openclawAgentId: usage?.agentId ?? null,
    openclawUsageTs: usage?.usageTimestampMs ?? null,
    openclawUsageAgeMs: usageFreshness.usageAgeMs,
    source
  }

  return enrichWithOpenClawFleetTelemetry(row, {
    host: HOST,
    collectedAtMs: sampleAtMs,
    collector: 'idlewatch-agent',
    collectorVersion: pkg.version
  })
}

async function tick() {
  const row = await collectSample()
  console.log(JSON.stringify(row))
  appendLocal(row)
  const published = await publish(row)
  if (REQUIRE_FIREBASE_WRITES && ONCE && !published) {
    throw new Error('Firebase write was required but not executed. Check Firebase configuration and connectivity.')
  }
}

let running = false
let stopped = false

async function loop() {
  if (stopped || running) return
  running = true
  try {
    await tick()
  } catch (e) {
    console.error(e.message)
  } finally {
    running = false
    if (!stopped) setTimeout(loop, INTERVAL_MS)
  }
}

process.on('SIGINT', () => {
  stopped = true
  process.exit(0)
})
process.on('SIGTERM', () => {
  stopped = true
  process.exit(0)
})

if (DRY_RUN || ONCE) {
  const mode = DRY_RUN ? 'dry-run' : 'once'
  console.log(
    `idlewatch-agent ${mode} host=${HOST} intervalMs=${INTERVAL_MS} firebase=${appReady} localLog=${LOCAL_LOG_PATH}`
  )
  tick()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e.message)
      process.exit(1)
    })
} else {
  console.log(
    `idlewatch-agent started host=${HOST} intervalMs=${INTERVAL_MS} firebase=${appReady} localLog=${LOCAL_LOG_PATH} openclawUsage=${OPENCLAW_USAGE_MODE}`
  )
  loop()
}
