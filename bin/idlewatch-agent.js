#!/usr/bin/env node
import fs from 'fs'
import os from 'os'
import path from 'path'
import process from 'process'
import { execFileSync } from 'child_process'
import admin from 'firebase-admin'
import { parseOpenClawUsage } from '../src/openclaw-usage.js'
import { gpuSampleDarwin } from '../src/gpu.js'
import { memUsedPct, memoryPressureDarwin } from '../src/memory.js'
import { deriveUsageFreshness } from '../src/usage-freshness.js'

function printHelp() {
  console.log(`idlewatch-agent\n\nUsage:\n  idlewatch-agent [--dry-run] [--help]\n\nOptions:\n  --dry-run   Collect and print one telemetry sample, then exit without Firebase writes\n  --help      Show this help message\n\nEnvironment:\n  IDLEWATCH_HOST                     Optional custom host label (default: hostname)\n  IDLEWATCH_INTERVAL_MS              Sampling interval in ms (default: 10000)\n  IDLEWATCH_LOCAL_LOG_PATH           Optional NDJSON file path for local sample durability\n  IDLEWATCH_OPENCLAW_USAGE           OpenClaw usage lookup mode: auto|off (default: auto)\n  IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS OpenClaw command timeout per probe in ms (default: 2500)\n  IDLEWATCH_OPENCLAW_PROBE_RETRIES   Extra OpenClaw probe sweep retries after first pass (default: 1)\n  IDLEWATCH_USAGE_STALE_MS           Mark OpenClaw usage stale beyond this age in ms (default: max(interval*3,60000))\n  IDLEWATCH_USAGE_NEAR_STALE_MS      Mark OpenClaw usage as aging beyond this age in ms (default: floor(stale*0.75))\n  IDLEWATCH_USAGE_STALE_GRACE_MS     Extra grace window before status becomes stale (default: min(interval,10000))\n  IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS  Reuse last successful usage snapshot after probe failures up to this age in ms\n  FIREBASE_PROJECT_ID                Firebase project id\n  FIREBASE_SERVICE_ACCOUNT_JSON      Raw JSON service account (preferred)\n  FIREBASE_SERVICE_ACCOUNT_B64       Base64-encoded JSON service account (legacy)\n  FIRESTORE_EMULATOR_HOST            Optional Firestore emulator host; allows local writes without service-account creds\n`)
}

const args = new Set(process.argv.slice(2))
if (args.has('--help') || args.has('-h')) {
  printHelp()
  process.exit(0)
}

const DRY_RUN = args.has('--dry-run')
const HOST = process.env.IDLEWATCH_HOST || os.hostname()
const SAFE_HOST = HOST.replace(/[^a-zA-Z0-9_.-]/g, '_')
const INTERVAL_MS = Number(process.env.IDLEWATCH_INTERVAL_MS || 10000)
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID
const CREDS_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
const CREDS_B64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST
const OPENCLAW_USAGE_MODE = (process.env.IDLEWATCH_OPENCLAW_USAGE || 'auto').toLowerCase()
const OPENCLAW_PROBE_TIMEOUT_MS = Number(process.env.IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS || 2500)
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

const USAGE_NEAR_STALE_MS = process.env.IDLEWATCH_USAGE_NEAR_STALE_MS
  ? Number(process.env.IDLEWATCH_USAGE_NEAR_STALE_MS)
  : Math.floor(USAGE_STALE_MS * 0.75)

if (!Number.isFinite(USAGE_NEAR_STALE_MS) || USAGE_NEAR_STALE_MS < 0) {
  console.error(
    `Invalid IDLEWATCH_USAGE_NEAR_STALE_MS: ${process.env.IDLEWATCH_USAGE_NEAR_STALE_MS}. Expected a non-negative number.`
  )
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

const OPENCLAW_LAST_GOOD_MAX_AGE_MS = process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS
  ? Number(process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS)
  : Math.max(USAGE_STALE_MS + USAGE_STALE_GRACE_MS, 120000)

if (process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS && (!Number.isFinite(OPENCLAW_LAST_GOOD_MAX_AGE_MS) || OPENCLAW_LAST_GOOD_MAX_AGE_MS <= 0)) {
  console.error(
    `Invalid IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS: ${process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS}. Expected a positive number.`
  )
  process.exit(1)
}

let appReady = false
let firebaseConfigError = null

if (PROJECT_ID || CREDS_JSON || CREDS_B64 || FIRESTORE_EMULATOR_HOST) {
  if (!PROJECT_ID) {
    firebaseConfigError =
      'FIREBASE_PROJECT_ID is missing. Set FIREBASE_PROJECT_ID plus FIREBASE_SERVICE_ACCOUNT_JSON (preferred) or FIREBASE_SERVICE_ACCOUNT_B64. For emulator-only mode, set FIREBASE_PROJECT_ID + FIRESTORE_EMULATOR_HOST.'
  } else if (!CREDS_JSON && !CREDS_B64) {
    if (FIRESTORE_EMULATOR_HOST) {
      try {
        admin.initializeApp({ projectId: PROJECT_ID })
        appReady = true
      } catch (err) {
        firebaseConfigError = `Failed to initialize Firebase emulator mode: ${err.message}`
      }
    } else {
      firebaseConfigError =
        'Firebase credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_JSON (preferred) or FIREBASE_SERVICE_ACCOUNT_B64. For emulator-only mode, set FIRESTORE_EMULATOR_HOST.'
    }
  } else {
    try {
      const credsRaw = CREDS_JSON || Buffer.from(CREDS_B64, 'base64').toString('utf8')
      const creds = JSON.parse(credsRaw)
      admin.initializeApp({ credential: admin.credential.cert(creds), projectId: PROJECT_ID })
      appReady = true
    } catch (err) {
      firebaseConfigError = `Failed to initialize Firebase credentials: ${err.message}`
    }
  }
}

if (firebaseConfigError) {
  console.error(`Firebase configuration error: ${firebaseConfigError}`)
  process.exit(1)
}

if (!appReady) {
  console.error(
    'Firebase is not configured. Running in local-only mode (stdout logging only). Set FIREBASE_PROJECT_ID + FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_SERVICE_ACCOUNT_B64), or use FIREBASE_PROJECT_ID + FIRESTORE_EMULATOR_HOST for emulator writes.'
  )
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
      fallbackAgeMs: null
    }
  }
}
let lastGoodOpenClawUsage = null
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
  const bins = [
    explicit,
    '/opt/homebrew/bin/openclaw',
    '/usr/local/bin/openclaw',
    'openclaw'
  ].filter(Boolean)
  return [...new Set(bins)]
}

function loadOpenClawUsage() {
  if (OPENCLAW_USAGE_MODE === 'off') {
    return {
      usage: null,
      probe: { result: 'disabled', attempts: 0, sweeps: 0, command: null, error: null, usedFallbackCache: false, fallbackAgeMs: null }
    }
  }

  const now = Date.now()
  if (now - openClawUsageCache.at < OPENCLAW_USAGE_TTL_MS) return openClawUsageCache.value

  const binaries = resolveOpenClawBinaries()
  const subcommands = [
    ['status', '--json'],
    ['session', 'status', '--json'],
    ['session_status', '--json']
  ]

  let attempts = 0
  let sweeps = 0
  let sawCommandError = false
  let sawParseError = false
  let lastError = null

  for (let sweep = 0; sweep <= OPENCLAW_PROBE_RETRIES; sweep++) {
    sweeps = sweep + 1
    for (const binPath of binaries) {
      for (const args of subcommands) {
        attempts += 1
        const cmdText = `${binPath} ${args.join(' ')}`
        try {
          const out = execFileSync(binPath, args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: OPENCLAW_PROBE_TIMEOUT_MS
          })
          const parsed = parseOpenClawUsage(out)
          if (parsed) {
            const usage = { ...parsed, sourceCommand: cmdText }
            const value = {
              usage,
              probe: { result: 'ok', attempts, sweeps, command: cmdText, error: null, usedFallbackCache: false, fallbackAgeMs: null }
            }
            lastGoodOpenClawUsage = { at: now, usage }
            openClawUsageCache = { at: now, value }
            return value
          }

          sawParseError = true
          lastError = 'unrecognized-json-shape'
        } catch (err) {
          if (err?.code === 'ENOENT') {
            lastError = 'openclaw-not-found'
            continue
          }
          sawCommandError = true
          lastError = err?.message ? String(err.message).split('\n')[0].slice(0, 180) : 'command-failed'
        }
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
        fallbackAgeMs
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
      fallbackAgeMs: null
    }
  }
  openClawUsageCache = { at: now, value }
  return value
}

async function publish(row, retries = 2) {
  if (!appReady || DRY_RUN) return
  const db = admin.firestore()
  let attempt = 0
  while (attempt <= retries) {
    try {
      await db.collection('metrics').add(row)
      return
    } catch (err) {
      if (attempt >= retries) throw err
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
      attempt += 1
    }
  }
}

async function collectSample() {
  const nowMs = Date.now()
  const usageProbe = loadOpenClawUsage()
  const usage = usageProbe.usage
  const usageFreshness = deriveUsageFreshness(usage, nowMs, USAGE_STALE_MS, USAGE_NEAR_STALE_MS, USAGE_STALE_GRACE_MS)
  const gpu = process.platform === 'darwin'
    ? gpuSampleDarwin()
    : { pct: null, source: 'unsupported', confidence: 'none', sampleWindowMs: null }
  const memPressure = loadMemPressure()
  const usedMemPct = memUsedPct()

  const row = {
    host: HOST,
    ts: nowMs,
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
    source: {
      usage: usage ? 'openclaw' : OPENCLAW_USAGE_MODE === 'off' ? 'disabled' : 'unavailable',
      usageIntegrationStatus: usage
        ? usageFreshness.isStale
          ? 'stale'
          : (usage?.integrationStatus ?? 'ok')
        : (OPENCLAW_USAGE_MODE === 'off' ? 'disabled' : 'unavailable'),
      usageProbeResult: usageProbe.probe.result,
      usageProbeAttempts: usageProbe.probe.attempts,
      usageProbeSweeps: usageProbe.probe.sweeps,
      usageProbeTimeoutMs: OPENCLAW_PROBE_TIMEOUT_MS,
      usageProbeRetries: OPENCLAW_PROBE_RETRIES,
      usageProbeError: usageProbe.probe.error,
      usageUsedFallbackCache: usageProbe.probe.usedFallbackCache,
      usageFallbackCacheAgeMs: usageProbe.probe.fallbackAgeMs,
      usageFreshnessState: usage ? usageFreshness.freshnessState : null,
      usageNearStale: usage ? usageFreshness.isNearStale : false,
      usagePastStaleThreshold: usage ? usageFreshness.isPastStaleThreshold : false,
      usageCommand: usage?.sourceCommand ?? null,
      usageStaleMsThreshold: USAGE_STALE_MS,
      usageNearStaleMsThreshold: USAGE_NEAR_STALE_MS,
      usageStaleGraceMs: USAGE_STALE_GRACE_MS,
      memPressureSource: memPressure.source
    }
  }
  return row
}

async function tick() {
  const row = await collectSample()
  console.log(JSON.stringify(row))
  appendLocal(row)
  await publish(row)
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

if (DRY_RUN) {
  console.log(`idlewatch-agent dry-run host=${HOST} intervalMs=${INTERVAL_MS} firebase=${appReady} localLog=${LOCAL_LOG_PATH}`)
  tick().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
} else {
  console.log(
    `idlewatch-agent started host=${HOST} intervalMs=${INTERVAL_MS} firebase=${appReady} localLog=${LOCAL_LOG_PATH} openclawUsage=${OPENCLAW_USAGE_MODE}`
  )
  loop()
}
