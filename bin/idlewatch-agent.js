#!/usr/bin/env node
import fs from 'fs'
import os from 'os'
import path from 'path'
import process from 'process'
import { execSync } from 'child_process'
import admin from 'firebase-admin'
import { parseOpenClawUsage } from '../src/openclaw-usage.js'
import { gpuSampleDarwin } from '../src/gpu.js'

function printHelp() {
  console.log(`idlewatch-agent\n\nUsage:\n  idlewatch-agent [--dry-run] [--help]\n\nOptions:\n  --dry-run   Collect and print one telemetry sample, then exit without Firebase writes\n  --help      Show this help message\n\nEnvironment:\n  IDLEWATCH_HOST                     Optional custom host label (default: hostname)\n  IDLEWATCH_INTERVAL_MS              Sampling interval in ms (default: 10000)\n  IDLEWATCH_LOCAL_LOG_PATH           Optional NDJSON file path for local sample durability\n  IDLEWATCH_OPENCLAW_USAGE           OpenClaw usage lookup mode: auto|off (default: auto)\n  IDLEWATCH_USAGE_STALE_MS           Mark OpenClaw usage stale beyond this age in ms (default: max(interval*3,60000))\n  FIREBASE_PROJECT_ID                Firebase project id\n  FIREBASE_SERVICE_ACCOUNT_JSON      Raw JSON service account (preferred)\n  FIREBASE_SERVICE_ACCOUNT_B64       Base64-encoded JSON service account (legacy)\n`)
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
const OPENCLAW_USAGE_MODE = (process.env.IDLEWATCH_OPENCLAW_USAGE || 'auto').toLowerCase()
const LOCAL_LOG_PATH = process.env.IDLEWATCH_LOCAL_LOG_PATH
  ? path.resolve(process.env.IDLEWATCH_LOCAL_LOG_PATH)
  : path.resolve(process.cwd(), 'logs', `${SAFE_HOST}-metrics.ndjson`)

if (!Number.isFinite(INTERVAL_MS) || INTERVAL_MS <= 0) {
  console.error(`Invalid IDLEWATCH_INTERVAL_MS: ${process.env.IDLEWATCH_INTERVAL_MS}. Expected a positive number.`)
  process.exit(1)
}

const USAGE_STALE_MS = process.env.IDLEWATCH_USAGE_STALE_MS
  ? Number(process.env.IDLEWATCH_USAGE_STALE_MS)
  : Math.max(INTERVAL_MS * 3, 60000)

if (!Number.isFinite(USAGE_STALE_MS) || USAGE_STALE_MS <= 0) {
  console.error(`Invalid IDLEWATCH_USAGE_STALE_MS: ${process.env.IDLEWATCH_USAGE_STALE_MS}. Expected a positive number.`)
  process.exit(1)
}

let appReady = false
let firebaseConfigError = null

if (PROJECT_ID || CREDS_JSON || CREDS_B64) {
  if (!PROJECT_ID) {
    firebaseConfigError =
      'FIREBASE_PROJECT_ID is missing. Set FIREBASE_PROJECT_ID plus FIREBASE_SERVICE_ACCOUNT_JSON (preferred) or FIREBASE_SERVICE_ACCOUNT_B64.'
  } else if (!CREDS_JSON && !CREDS_B64) {
    firebaseConfigError =
      'Firebase credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_JSON (preferred) or FIREBASE_SERVICE_ACCOUNT_B64.'
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
    'Firebase is not configured. Running in local-only mode (stdout logging only). Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT_JSON to enable Firestore writes.'
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

function memPct() {
  return Number((((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2))
}

const OPENCLAW_USAGE_TTL_MS = Math.max(INTERVAL_MS, 30000)
let openClawUsageCache = { at: 0, value: null }

function loadOpenClawUsage() {
  if (OPENCLAW_USAGE_MODE === 'off') return null
  const now = Date.now()
  if (now - openClawUsageCache.at < OPENCLAW_USAGE_TTL_MS) return openClawUsageCache.value

  const commands = [
    'openclaw status --json',
    'openclaw session status --json',
    'openclaw session_status --json'
  ]

  for (const cmd of commands) {
    try {
      const out = execSync(cmd, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 2500
      })
      const parsed = parseOpenClawUsage(out)
      if (parsed) {
        openClawUsageCache = { at: now, value: { ...parsed, sourceCommand: cmd } }
        return openClawUsageCache.value
      }
    } catch {
      // ignore and try next command
    }
  }

  openClawUsageCache = { at: now, value: null }
  return null
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

function deriveUsageFreshness(usage, nowMs) {
  const usageTs = usage?.usageTimestampMs
  if (typeof usageTs !== 'number' || !Number.isFinite(usageTs)) {
    return { usageAgeMs: null, isStale: false }
  }

  const ageMs = nowMs - usageTs
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return { usageAgeMs: null, isStale: false }
  }

  return {
    usageAgeMs: ageMs,
    isStale: ageMs > USAGE_STALE_MS
  }
}

async function collectSample() {
  const nowMs = Date.now()
  const usage = loadOpenClawUsage()
  const usageFreshness = deriveUsageFreshness(usage, nowMs)
  const gpu = process.platform === 'darwin'
    ? gpuSampleDarwin()
    : { pct: null, source: 'unsupported', confidence: 'none', sampleWindowMs: null }

  const row = {
    host: HOST,
    ts: nowMs,
    cpuPct: cpuPct(),
    memPct: memPct(),
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
      usageCommand: usage?.sourceCommand ?? null,
      usageStaleMsThreshold: USAGE_STALE_MS
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
