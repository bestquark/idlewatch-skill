#!/usr/bin/env node
import os from 'os'
import process from 'process'
import { execSync } from 'child_process'
import admin from 'firebase-admin'

const HOST = process.env.IDLEWATCH_HOST || os.hostname()
const INTERVAL_MS = Number(process.env.IDLEWATCH_INTERVAL_MS || 10000)
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID
const CREDS_B64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64

let appReady = false
if (PROJECT_ID && CREDS_B64) {
  const creds = JSON.parse(Buffer.from(CREDS_B64, 'base64').toString('utf8'))
  admin.initializeApp({ credential: admin.credential.cert(creds), projectId: PROJECT_ID })
  appReady = true
}

function cpuPct(sampleMs = 400) {
  const a = os.cpus().map((c) => ({ ...c.times }))
  const sleep = new Int32Array(new SharedArrayBuffer(4))
  Atomics.wait(sleep, 0, 0, sampleMs)
  const b = os.cpus().map((c) => ({ ...c.times }))
  let idle = 0,
    total = 0
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
  if (!appReady) return
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

console.log(`idlewatch-agent started host=${HOST} intervalMs=${INTERVAL_MS} firebase=${appReady}`)
setInterval(() => tick().catch((e) => console.error(e.message)), INTERVAL_MS)
tick().catch((e) => console.error(e.message))
