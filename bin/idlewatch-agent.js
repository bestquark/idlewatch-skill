#!/usr/bin/env node
import os from 'os'
import process from 'process'
import { execSync } from 'child_process'
import admin from 'firebase-admin'

function printHelp() {
  console.log(`idlewatch-agent\n\nUsage:\n  idlewatch-agent [--dry-run] [--help]\n\nOptions:\n  --dry-run   Collect and print one telemetry sample, then exit without Firebase writes\n  --help      Show this help message\n\nEnvironment:\n  IDLEWATCH_HOST                     Optional custom host label (default: hostname)\n  IDLEWATCH_INTERVAL_MS              Sampling interval in ms (default: 10000)\n  FIREBASE_PROJECT_ID                Firebase project id\n  FIREBASE_SERVICE_ACCOUNT_JSON      Raw JSON service account (preferred)\n  FIREBASE_SERVICE_ACCOUNT_B64       Base64-encoded JSON service account (legacy)\n`)
}

const args = new Set(process.argv.slice(2))
if (args.has('--help') || args.has('-h')) {
  printHelp()
  process.exit(0)
}

const DRY_RUN = args.has('--dry-run')
const HOST = process.env.IDLEWATCH_HOST || os.hostname()
const INTERVAL_MS = Number(process.env.IDLEWATCH_INTERVAL_MS || 10000)
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID
const CREDS_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
const CREDS_B64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64

if (!Number.isFinite(INTERVAL_MS) || INTERVAL_MS <= 0) {
  console.error(`Invalid IDLEWATCH_INTERVAL_MS: ${process.env.IDLEWATCH_INTERVAL_MS}. Expected a positive number.`)
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

function cpuPct(sampleMs = 400) {
  const a = os.cpus().map((c) => ({ ...c.times }))
  const sleep = new Int32Array(new SharedArrayBuffer(4))
  Atomics.wait(sleep, 0, 0, sampleMs)
  const b = os.cpus().map((c) => ({ ...c.times }))
  let idle = 0
  let total = 0
  for (let i = 0; i < a.length; i++) {
    const da = b[i]
    const db = a[i]
    const didle = da.idle - db.idle
    const dtotal = (da.user - db.user) + (da.nice - db.nice) + (da.sys - db.sys) + (da.irq - db.irq) + didle
    idle += didle
    total += dtotal
  }
  return Math.max(0, Math.min(100, Number((100 * (1 - idle / total)).toFixed(2))))
}

function memPct() {
  return Number((((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2))
}

function gpuPctDarwin() {
  try {
    const out = execSync("top -l 1 | grep 'GPU'", { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const m = out.match(/(\d+\.?\d*)%/)
    return m ? Number(m[1]) : null
  } catch {
    return null
  }
}

function tokensPerMinMock() {
  // Placeholder until OpenClaw session usage endpoint wiring is added.
  return Math.round(150 + Math.random() * 700)
}

async function publish(row) {
  if (!appReady || DRY_RUN) return
  const db = admin.firestore()
  await db.collection('metrics').add(row)
}

async function tick() {
  const row = {
    host: HOST,
    ts: Date.now(),
    cpuPct: cpuPct(),
    memPct: memPct(),
    gpuPct: process.platform === 'darwin' ? gpuPctDarwin() : null,
    tokensPerMin: tokensPerMinMock()
  }
  console.log(JSON.stringify(row))
  await publish(row)
}

if (DRY_RUN) {
  console.log(`idlewatch-agent dry-run host=${HOST} intervalMs=${INTERVAL_MS} firebase=${appReady}`)
  tick().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
} else {
  console.log(`idlewatch-agent started host=${HOST} intervalMs=${INTERVAL_MS} firebase=${appReady}`)
  setInterval(() => tick().catch((e) => console.error(e.message)), INTERVAL_MS)
  tick().catch((e) => console.error(e.message))
}
