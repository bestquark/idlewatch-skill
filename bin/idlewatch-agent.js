#!/usr/bin/env node
import fs from 'fs'
import { accessSync, constants } from 'node:fs'
import http from 'node:http'
import os from 'os'
import path from 'path'
import process from 'process'
import { spawnSync } from 'node:child_process'
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
  console.log(`idlewatch\n\nUsage:\n  idlewatch [quickstart|configure|dashboard|run] [--dry-run] [--once] [--help]\n\nOptions:\n  quickstart  Run first-run setup and save local IdleWatch config\n  configure   Alias for quickstart; reopen setup to change device name, API key, or metrics\n  dashboard   Launch local dashboard from local IdleWatch logs\n  run         Start the background collector using saved local config\n  --no-tui    Skip the Rust TUI and use plain text setup without installing Cargo\n  --dry-run   Collect and print one telemetry sample, then exit without remote writes\n  --once      Collect and publish one telemetry sample, then exit\n  --help      Show this help message\n\nQuickstart:\n  1. Create an API key on idlewatch.com/api\n  2. Run: idlewatch quickstart\n  3. Pick a device name and metrics\n  4. IdleWatch saves your local config and sends a first sample\n\nEnvironment:\n  IDLEWATCH_HOST                     Optional custom host label (default: hostname)\n  IDLEWATCH_INTERVAL_MS              Sampling interval in ms (default: 10000)\n  IDLEWATCH_LOCAL_LOG_PATH           Optional NDJSON file path for local sample durability\n  IDLEWATCH_DASHBOARD_PORT           Local dashboard HTTP port (default: 4373)\n  IDLEWATCH_OPENCLAW_USAGE           OpenClaw usage lookup mode: auto|off (default: auto)\n  IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS OpenClaw command timeout per probe in ms (default: 2500)\n  IDLEWATCH_OPENCLAW_PROBE_RETRIES   Extra OpenClaw probe sweep retries after first pass (default: 1)\n  IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES   Max per-command OpenClaw probe output capture in bytes before truncation (default: 2097152 / 2MB)\n  IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES_HARD_CAP  Hard cap for auto-retry output capture escalation (default: 16777216 / 16MB)\n  IDLEWATCH_USAGE_STALE_MS           Mark OpenClaw usage stale beyond this age in ms (default: max(interval*3,60000))\n  IDLEWATCH_USAGE_NEAR_STALE_MS      Mark OpenClaw usage as aging beyond this age in ms (default: floor((stale+grace)*0.85))\n  IDLEWATCH_USAGE_STALE_GRACE_MS     Extra grace window before status becomes stale (default: min(interval,10000))\n  IDLEWATCH_USAGE_REFRESH_REPROBES   Forced uncached reprobes when usage crosses stale threshold (default: 1)\n  IDLEWATCH_USAGE_REFRESH_DELAY_MS   Delay between forced stale-threshold reprobes in ms (default: 250)\n  IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE Trigger refresh when usage is near-stale: 1|0 (default: 1)\n  IDLEWATCH_USAGE_IDLE_AFTER_MS      Downgrade stale usage alerts to idle notice beyond this age in ms (default: 21600000)\n  IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS  Reuse last successful usage snapshot after probe failures up to this age in ms\n  IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH Persist/reuse last successful usage snapshot across restarts (default: ~/.idlewatch/cache/<host>-openclaw-last-good.json)\n  IDLEWATCH_CLOUD_INGEST_URL         Optional cloud ingest endpoint (e.g. https://idlewatch.com/api/ingest)\n  IDLEWATCH_CLOUD_API_KEY            Cloud API key from idlewatch.com/api for device linking\n  IDLEWATCH_REQUIRE_CLOUD_WRITES     Require cloud publish path in --once mode: 1|0 (default: 0)\n\nAdvanced Firebase / emulator mode:\n  IDLEWATCH_REQUIRE_FIREBASE_WRITES  Require Firebase publish path in --once mode: 1|0 (default: 0)\n  FIREBASE_PROJECT_ID                Firebase project id\n  FIREBASE_SERVICE_ACCOUNT_FILE      Path to service account JSON file (preferred for production)\n  FIREBASE_SERVICE_ACCOUNT_JSON      Raw JSON service account (supported, less secure than file path)\n  FIREBASE_SERVICE_ACCOUNT_B64       Base64-encoded JSON service account (legacy)\n  FIRESTORE_EMULATOR_HOST            Optional Firestore emulator host; allows local writes without service-account creds\n`)
}

const require = createRequire(import.meta.url)

function parseEnvFileToObject(envFilePath) {
  const raw = fs.readFileSync(envFilePath, 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (key) env[key] = value
  }
  return env
}

function expandSupportedPathVars(value) {
  if (typeof value !== 'string' || !value) return value

  const home = process.env.HOME || os.homedir()
  const tmpdir = process.env.TMPDIR || os.tmpdir()

  return value
    .replace(/^~(?=$|\/)/, home)
    .replace(/\$\{HOME\}|\$HOME/g, home)
    .replace(/\$\{TMPDIR\}|\$TMPDIR/g, tmpdir)
}

function resolveEnvPath(value) {
  return path.resolve(expandSupportedPathVars(value))
}

function loadPersistedEnvIntoProcess() {
  const envFile = path.join(os.homedir(), '.idlewatch', 'idlewatch.env')
  if (!fs.existsSync(envFile)) return null

  try {
    const parsed = parseEnvFileToObject(envFile)
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key]) continue
      process.env[key] = key.endsWith('_PATH') ? expandSupportedPathVars(value) : value
    }
    return { envFile, parsed }
  } catch (error) {
    console.error(`Failed to load persisted IdleWatch config from ${envFile}: ${error.message}`)
    return null
  }
}

function buildSetupTestEnv(enrolledEnv) {
  const nextEnv = { ...process.env }

  for (const key of Object.keys(nextEnv)) {
    if (
      key.startsWith('IDLEWATCH_') ||
      key.startsWith('FIREBASE_') ||
      key === 'GOOGLE_APPLICATION_CREDENTIALS'
    ) {
      delete nextEnv[key]
    }
  }

  for (const [key, value] of Object.entries(enrolledEnv || {})) {
    nextEnv[key] = key.endsWith('_PATH') ? expandSupportedPathVars(value) : value
  }

  return nextEnv
}

const persistedEnv = loadPersistedEnvIntoProcess()

function parseMonitorTargets(raw) {
  const allowed = new Set(['cpu', 'memory', 'gpu', 'openclaw'])
  const fallback = ['cpu', 'memory', 'openclaw', 'gpu']

  if (!raw || typeof raw !== 'string') {
    return new Set(fallback)
  }

  const parsed = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => allowed.has(item))

  if (parsed.length === 0) return new Set(fallback)
  return new Set(parsed)
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const fixed = value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)
  return `${fixed} ${units[unit]}`
}

function resolveDashboardLogPath(host) {
  if (process.env.IDLEWATCH_LOCAL_LOG_PATH) {
    return resolveEnvPath(process.env.IDLEWATCH_LOCAL_LOG_PATH)
  }

  const envFile = path.join(os.homedir(), '.idlewatch', 'idlewatch.env')
  if (fs.existsSync(envFile)) {
    try {
      const parsed = parseEnvFileToObject(envFile)
      if (parsed.IDLEWATCH_LOCAL_LOG_PATH) {
        return resolveEnvPath(parsed.IDLEWATCH_LOCAL_LOG_PATH)
      }
    } catch {
      // ignore malformed env file and fallback
    }
  }

  const safeHost = host.replace(/[^a-zA-Z0-9_.-]/g, '_')
  return path.join(os.homedir(), '.idlewatch', 'logs', `${safeHost}-metrics.ndjson`)
}

function parseLocalRows(logPath, maxLines = 2500) {
  if (!fs.existsSync(logPath)) return []

  try {
    const raw = fs.readFileSync(logPath, 'utf8')
    const lines = raw.split(/\r?\n/).filter(Boolean)
    const selected = lines.slice(Math.max(0, lines.length - maxLines))

    return selected
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter((item) => item && Number.isFinite(Number(item.ts)))
      .sort((a, b) => Number(a.ts) - Number(b.ts))
  } catch {
    return []
  }
}

function buildTokenDailyEstimate(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []

  const totals = new Map()
  const previousBySource = new Map()

  for (const row of rows) {
    const ts = Number(row.ts || 0)
    const tokensPerMin = Math.max(0, Number(row.tokensPerMin || 0))
    const sourceKey = `${row.hostId || row.host || 'host'}::${row.deviceId || row.device || 'device'}`
    const prevTs = previousBySource.get(sourceKey)

    if (Number.isFinite(prevTs) && ts > prevTs && tokensPerMin > 0) {
      const deltaMinutes = Math.max(0, Math.min(10, (ts - prevTs) / 60000))
      const estimate = tokensPerMin * deltaMinutes
      const day = new Date(ts)
      const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      totals.set(dayKey, (totals.get(dayKey) || 0) + estimate)
    }

    previousBySource.set(sourceKey, ts)
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, tokens]) => ({ day: day.slice(5), tokens: Math.round(tokens) }))
}

function buildLocalDashboardPayload(logPath) {
  const rows = parseLocalRows(logPath)
  let bytes = 0
  try {
    bytes = fs.statSync(logPath).size
  } catch {
    bytes = 0
  }

  const series = rows.map((row) => ({
    ts: Number(row.ts || 0),
    cpu: Number(row.cpuPct || 0),
    memory: Number(row.memPct || 0),
    gpu: Number(row.gpuPct || 0),
    tokens: Number(row.tokensPerMin || 0)
  }))

  return {
    logPath,
    logBytes: bytes,
    logSizeHuman: formatBytes(bytes),
    sampleCount: rows.length,
    latestTs: rows.length ? Number(rows[rows.length - 1].ts || 0) : null,
    series,
    tokenDaily: buildTokenDailyEstimate(rows)
  }
}

function renderLocalDashboardHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>IdleWatch local dashboard</title>
    <style>
      body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin:0; background:#0a0c1a; color:#eef1ff; }
      .wrap { max-width: 1080px; margin: 30px auto; padding: 0 16px; }
      .grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap:10px; }
      .card { background:#121633; border:1px solid #2a2f5b; border-radius:12px; padding:12px; }
      .label { color:#9ba5d8; font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
      .value { margin-top:6px; font-size:18px; }
      .chart { margin-top:10px; background:#121633; border:1px solid #2a2f5b; border-radius:12px; padding:12px; }
      canvas { width:100% !important; height:280px !important; }
      code { background:#1a1f42; border:1px solid #2f356e; border-radius:6px; padding:2px 6px; }
      .sub { color:#98a2d6; font-size:13px; }
      a { color:#7ce4ff; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  </head>
  <body>
    <main class="wrap">
      <h1>IdleWatch local dashboard</h1>
      <p class="sub">Live view from your local NDJSON log file.</p>
      <div class="grid">
        <div class="card"><div class="label">Log path</div><div class="value"><code id="log-path">—</code></div></div>
        <div class="card"><div class="label">Storage</div><div class="value" id="log-size">—</div></div>
        <div class="card"><div class="label">Samples</div><div class="value" id="sample-count">—</div></div>
        <div class="card"><div class="label">Last sample</div><div class="value" id="last-sample">—</div></div>
      </div>
      <div class="chart"><h3>System load (%)</h3><canvas id="system-chart"></canvas></div>
      <div class="chart"><h3>Tokens / min</h3><canvas id="tokens-chart"></canvas></div>
      <div class="chart"><h3>Token / day (estimate)</h3><canvas id="daily-chart"></canvas></div>
    </main>
    <script>
      const fmt = (n) => Number.isFinite(n) ? n.toLocaleString() : '—';
      const fmtTs = (ts) => Number.isFinite(ts) && ts > 0 ? new Date(ts).toLocaleString() : '—';
      let systemChart, tokensChart, dailyChart;

      function draw(payload) {
        document.getElementById('log-path').textContent = payload.logPath || '—';
        document.getElementById('log-size').textContent = payload.logSizeHuman || '0 B';
        document.getElementById('sample-count').textContent = fmt(payload.sampleCount || 0);
        document.getElementById('last-sample').textContent = fmtTs(payload.latestTs);

        const labels = (payload.series || []).map((r) => new Date(r.ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));
        const cpu = (payload.series || []).map((r) => r.cpu ?? 0);
        const memory = (payload.series || []).map((r) => r.memory ?? 0);
        const gpu = (payload.series || []).map((r) => r.gpu ?? 0);
        const tokens = (payload.series || []).map((r) => r.tokens ?? 0);
        const dayLabels = (payload.tokenDaily || []).map((r) => r.day);
        const dayTokens = (payload.tokenDaily || []).map((r) => r.tokens);

        if (systemChart) systemChart.destroy();
        if (tokensChart) tokensChart.destroy();
        if (dailyChart) dailyChart.destroy();

        systemChart = new Chart(document.getElementById('system-chart'), {
          type: 'line',
          data: {
            labels,
            datasets: [
              { label: 'CPU', data: cpu, borderColor: '#00c853', tension: 0.2, pointRadius: 0 },
              { label: 'Memory', data: memory, borderColor: '#2979ff', tension: 0.2, pointRadius: 0 },
              { label: 'GPU', data: gpu, borderColor: '#a855f7', tension: 0.2, pointRadius: 0 }
            ]
          },
          options: { responsive:true, plugins:{legend:{labels:{color:'#d8defa'}}}, scales:{x:{ticks:{color:'#9aa2d8'}}, y:{min:0,max:100,ticks:{color:'#9aa2d8'}}} }
        });

        tokensChart = new Chart(document.getElementById('tokens-chart'), {
          type: 'line',
          data: { labels, datasets: [{ label: 'Tokens/min', data: tokens, borderColor: '#ff7a18', tension: 0.2, pointRadius: 0 }] },
          options: { responsive:true, plugins:{legend:{labels:{color:'#d8defa'}}}, scales:{x:{ticks:{color:'#9aa2d8'}}, y:{ticks:{color:'#9aa2d8'}}} }
        });

        dailyChart = new Chart(document.getElementById('daily-chart'), {
          type: 'bar',
          data: { labels: dayLabels, datasets: [{ label: 'Tokens/day', data: dayTokens, backgroundColor: '#22d3ee' }] },
          options: { responsive:true, plugins:{legend:{labels:{color:'#d8defa'}}}, scales:{x:{ticks:{color:'#9aa2d8'}}, y:{ticks:{color:'#9aa2d8'}}} }
        });
      }

      async function refresh() {
        const response = await fetch('/api/local-status', { cache: 'no-store' });
        const payload = await response.json();
        draw(payload);
      }

      refresh();
      setInterval(refresh, 10000);
    </script>
  </body>
</html>`
}

function openUrl(url) {
  try {
    if (process.platform === 'darwin') {
      spawnSync('open', [url], { stdio: 'ignore' })
    } else if (process.platform === 'win32') {
      spawnSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' })
    } else {
      spawnSync('xdg-open', [url], { stdio: 'ignore' })
    }
  } catch {
    // no-op
  }
}

function runLocalDashboard({ host }) {
  const logPath = resolveDashboardLogPath(host)
  const portRaw = Number(process.env.IDLEWATCH_DASHBOARD_PORT || 4373)
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 4373

  const server = http.createServer((req, res) => {
    if (req.url === '/api/local-status') {
      const payload = buildLocalDashboardPayload(logPath)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(payload))
      return
    }

    if (req.url === '/health') {
      const payload = buildLocalDashboardPayload(logPath)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, logPath: payload.logPath, samples: payload.sampleCount }))
      return
    }

    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(renderLocalDashboardHtml())
  })

  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`
    const payload = buildLocalDashboardPayload(logPath)
    console.log(`idlewatch local dashboard ready: ${url}`)
    console.log(`log file: ${payload.logPath} (${payload.logSizeHuman})`)
    openUrl(url)
  })

  server.on('error', (err) => {
    console.error(`Local dashboard failed: ${err.message}`)
    process.exit(1)
  })
}

const argv = process.argv.slice(2)
const args = new Set(argv)
const dashboardRequested = argv[0] === 'dashboard' || argv.includes('--dashboard')
const runRequested = argv[0] === 'run' || argv.includes('--run')
const interactiveDefaultRequested = argv.length === 0 && process.stdin.isTTY && process.stdout.isTTY
const quickstartRequested = argv[0] === 'quickstart' || argv[0] === 'configure' || argv.includes('--quickstart') || argv.includes('--configure') || (interactiveDefaultRequested && !dashboardRequested && !runRequested)
if (args.has('--help') || args.has('-h')) {
  printHelp()
  process.exit(0)
}

if (dashboardRequested) {
  const host = process.env.IDLEWATCH_HOST || os.hostname()
  runLocalDashboard({ host })
  await new Promise(() => {})
}

if (quickstartRequested) {
  try {
    const result = await runEnrollmentWizard({ noTui: args.has('--no-tui') })

    if (!result?.outputEnvFile || !fs.existsSync(result.outputEnvFile)) {
      throw new Error(`setup_did_not_write_env_file:${result?.outputEnvFile || 'unknown'}`)
    }

    const enrolledEnv = parseEnvFileToObject(result.outputEnvFile)
    const onceRun = spawnSync(process.execPath, [process.argv[1], '--once'], {
      stdio: 'inherit',
      env: buildSetupTestEnv(enrolledEnv)
    })

    if (onceRun.status === 0) {
      console.log(`✅ Setup complete. Mode=${result.mode} device=${result.deviceName} envFile=${result.outputEnvFile}`)
      console.log('Initial telemetry sample sent successfully.')
      process.exit(0)
    }

    console.error(`⚠️ Setup is not finished yet. Mode=${result.mode} device=${result.deviceName} envFile=${result.outputEnvFile}`)
    console.error('The first required telemetry sample did not publish successfully, so this device may not be linked yet.')
    console.error('Retry with: idlewatch --once')
    console.error('Or rerun: idlewatch quickstart')
    console.error(`Advanced/manual fallback: set -a; source "${result.outputEnvFile}"; set +a && idlewatch --once`)
    process.exit(onceRun.status ?? 1)
  } catch (err) {
    if (String(err?.message || '') === 'setup_cancelled') {
      console.error('Enrollment cancelled before saving config.')
    } else if (String(err?.message || '').startsWith('setup_did_not_write_env_file:')) {
      console.error(`Enrollment failed: setup did not save idlewatch.env (${String(err.message).split(':').slice(1).join(':')}).`)
    } else {
      console.error(`Enrollment failed: ${err.message}`)
    }
    process.exit(1)
  }
}

const DRY_RUN = args.has('--dry-run')
const ONCE = args.has('--once')
const DEVICE_NAME = (process.env.IDLEWATCH_DEVICE_NAME || process.env.IDLEWATCH_HOST || os.hostname()).trim()
const DEVICE_ID = (process.env.IDLEWATCH_DEVICE_ID || DEVICE_NAME)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_.-]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'device'
const HOST = process.env.IDLEWATCH_HOST || os.hostname()
const SAFE_HOST = DEVICE_ID.replace(/[^a-zA-Z0-9_.-]/g, '_')
const INTERVAL_MS = Number(process.env.IDLEWATCH_INTERVAL_MS || 10000)
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID
const CREDS_FILE = process.env.FIREBASE_SERVICE_ACCOUNT_FILE
const CREDS_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
const CREDS_B64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST
const OPENCLAW_USAGE_MODE = (process.env.IDLEWATCH_OPENCLAW_USAGE || 'auto').toLowerCase()
const MONITOR_TARGETS = parseMonitorTargets(process.env.IDLEWATCH_MONITOR_TARGETS)
const MONITOR_CPU = MONITOR_TARGETS.has('cpu')
const MONITOR_MEMORY = MONITOR_TARGETS.has('memory')
const MONITOR_GPU = MONITOR_TARGETS.has('gpu')
const MONITOR_OPENCLAW = MONITOR_TARGETS.has('openclaw')
const EFFECTIVE_OPENCLAW_MODE = MONITOR_OPENCLAW ? OPENCLAW_USAGE_MODE : 'off'
const REQUIRE_FIREBASE_WRITES = process.env.IDLEWATCH_REQUIRE_FIREBASE_WRITES === '1'
const CLOUD_INGEST_URL = (process.env.IDLEWATCH_CLOUD_INGEST_URL || '').trim()
const CLOUD_API_KEY = (process.env.IDLEWATCH_CLOUD_API_KEY || '').trim().replace(/^['"]|['"]$/g, '')
const REQUIRE_CLOUD_WRITES = process.env.IDLEWATCH_REQUIRE_CLOUD_WRITES === '1'
let cloudIngestKickedOut = false
let cloudIngestKickoutReason = null
let cloudIngestKickoutNotified = false
const OPENCLAW_PROBE_TIMEOUT_MS = Number(process.env.IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS || 2500)
const OPENCLAW_PROBE_MAX_OUTPUT_BYTES = process.env.IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES
  ? Number(process.env.IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES)
  : 2 * 1024 * 1024
const OPENCLAW_PROBE_MAX_OUTPUT_BYTES_HARD_CAP = process.env.IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES_HARD_CAP
  ? Number(process.env.IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES_HARD_CAP)
  : 16 * 1024 * 1024
const OPENCLAW_BIN_STRICT = process.env.IDLEWATCH_OPENCLAW_BIN_STRICT === '1'
const OPENCLAW_PROBE_RETRIES = process.env.IDLEWATCH_OPENCLAW_PROBE_RETRIES
  ? Number(process.env.IDLEWATCH_OPENCLAW_PROBE_RETRIES)
  : 1
const BASE_DIR = path.join(os.homedir(), '.idlewatch')

const LOCAL_LOG_PATH = process.env.IDLEWATCH_LOCAL_LOG_PATH
  ? resolveEnvPath(process.env.IDLEWATCH_LOCAL_LOG_PATH)
  : path.join(BASE_DIR, 'logs', `${SAFE_HOST}-metrics.ndjson`)

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

if (!Number.isFinite(OPENCLAW_PROBE_MAX_OUTPUT_BYTES) || OPENCLAW_PROBE_MAX_OUTPUT_BYTES <= 0) {
  console.error(
    `Invalid IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES: undefined. Expected a positive number.`
  )
  process.exit(1)
}

if (!Number.isFinite(OPENCLAW_PROBE_MAX_OUTPUT_BYTES_HARD_CAP) || OPENCLAW_PROBE_MAX_OUTPUT_BYTES_HARD_CAP < OPENCLAW_PROBE_MAX_OUTPUT_BYTES) {
  console.error(
    `Invalid IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES_HARD_CAP: ${process.env.IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES_HARD_CAP}. Must be a number >= IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES.`
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
  ? resolveEnvPath(process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH)
  : path.join(BASE_DIR, 'cache', `${SAFE_HOST}-openclaw-last-good.json`)

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

const hasAnyFirebaseConfig = Boolean(PROJECT_ID || CREDS_FILE || CREDS_JSON || CREDS_B64 || FIRESTORE_EMULATOR_HOST)
const hasCloudConfig = Boolean(CLOUD_INGEST_URL && CLOUD_API_KEY)
const shouldWarnAboutMissingPublishConfig = !appReady && !hasCloudConfig && !DRY_RUN && !hasAnyFirebaseConfig

function getPublishModeLabel() {
  if (hasCloudConfig) return 'cloud'
  if (appReady) return 'firebase'
  return 'local-only'
}

if (shouldWarnAboutMissingPublishConfig) {
  console.error(
    'No publish target is configured yet. Running in local-only mode. Run idlewatch quickstart to link cloud ingest, or configure Firebase/emulator mode if you need that path.'
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

function getLocalLogUsage() {
  try {
    const stat = fs.statSync(LOCAL_LOG_PATH)
    return {
      path: LOCAL_LOG_PATH,
      bytes: Number(stat.size || 0)
    }
  } catch {
    return {
      path: LOCAL_LOG_PATH,
      bytes: 0
    }
  }
}

function appendLocal(row) {
  try {
    ensureDirFor(LOCAL_LOG_PATH)
    fs.appendFileSync(LOCAL_LOG_PATH, `${JSON.stringify(row)}\n`, 'utf8')
  } catch (err) {
    console.error(`Local log append failed (${LOCAL_LOG_PATH}): ${err.message}`)
  }
  return getLocalLogUsage()
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
      result: EFFECTIVE_OPENCLAW_MODE === 'off' ? 'disabled' : 'unavailable',
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

function gpuSampleNvidiaSmi() {
  try {
    const probe = spawnSync(
      'nvidia-smi',
      ['--query-gpu=utilization.gpu', '--format=csv,noheader,nounits'],
      { encoding: 'utf8', timeout: 1500, maxBuffer: 256 * 1024 }
    )

    if (probe.error || probe.status !== 0) {
      return { pct: null, source: 'nvidia-smi-unavailable', confidence: 'none', sampleWindowMs: null }
    }

    const values = (probe.stdout || '')
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((value) => Number.isFinite(value) && value >= 0)

    if (values.length === 0) {
      return { pct: null, source: 'nvidia-smi-empty', confidence: 'none', sampleWindowMs: null }
    }

    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    return {
      pct: Math.max(0, Math.min(100, average)),
      source: 'nvidia-smi',
      confidence: 'medium',
      sampleWindowMs: null
    }
  } catch {
    return { pct: null, source: 'nvidia-smi-error', confidence: 'none', sampleWindowMs: null }
  }
}

function resolveOpenClawBinaries() {
  const explicit = (process.env.IDLEWATCH_OPENCLAW_BIN?.trim()) || (process.env.IDLEWATCH_OPENCLAW_BIN_HINT?.trim())
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
    homeDir ? `${homeDir}/.npm-global/bin/openclaw` : null,
    homeDir ? `${homeDir}/.nvm/versions/node/${process.version}/bin/openclaw` : null,
    '/opt/homebrew/lib/node_modules/.bin/openclaw',
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
  if (EFFECTIVE_OPENCLAW_MODE === 'off') {
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
    ['usage', '--json'],
    ['session', 'status', '--json'],
    ['session_status', '--json'],
    ['stats', '--json']
  ]

  const pathEntries = (process.env.PATH || '').split(':').filter(Boolean)

  function isExecutable(candidate) {
    try {
      accessSync(candidate, constants.X_OK)
      return true
    } catch {
      return false
    }
  }

  function hasPathExecutable(binName) {
    for (const entry of pathEntries) {
      const candidate = path.join(entry, binName)
      if (isExecutable(candidate)) return true
    }
    return false
  }

  function isBinaryAvailable(binPath) {
    if (binPath.includes('/')) {
      return isExecutable(binPath)
    }

    return hasPathExecutable(binPath)
  }

  // Build an augmented PATH for probe subprocesses so that #!/usr/bin/env node
  // scripts (like openclaw) can locate the node binary even when the packaged
  // app runs with a restricted PATH (e.g. /usr/bin:/bin:/usr/sbin:/sbin).
  const probeEnv = (() => {
    const currentPath = process.env.PATH || ''
    const extraDirs = new Set()

    // Add directory of the running node binary (handles packaged + nvm setups)
    const nodeDir = path.dirname(process.execPath)
    if (nodeDir && nodeDir !== '.') extraDirs.add(nodeDir)

    // Common Homebrew / system node locations
    for (const dir of ['/opt/homebrew/bin', '/usr/local/bin', `${process.env.HOME || ''}/.local/bin`]) {
      if (dir) extraDirs.add(dir)
    }

    const pathDirs = currentPath.split(':').filter(Boolean)
    const augmented = [...new Set([...extraDirs, ...pathDirs])].join(':')
    return { ...process.env, PATH: augmented }
  })()

  function runProbe(binPath, args) {
    const startMs = Date.now()
    let limit = OPENCLAW_PROBE_MAX_OUTPUT_BYTES

    while (limit <= OPENCLAW_PROBE_MAX_OUTPUT_BYTES_HARD_CAP) {
      try {
        const result = spawnSync(binPath, args, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: OPENCLAW_PROBE_TIMEOUT_MS,
          maxBuffer: limit,
          env: probeEnv
        })

        const stdoutPayload = typeof result.stdout === 'string' ? result.stdout.trim() : ''
        const stderrPayload = typeof result.stderr === 'string' ? result.stderr.trim() : ''
        const status = result.status === 0 ? 'ok' : 'ok-with-stderr'
        const commandStatus = result.status
        const combinedOutput = [stdoutPayload, stderrPayload].filter(Boolean).join('\n')

        if (combinedOutput) {
          return {
            out: combinedOutput,
            error: status === 'ok'
              ? null
              : `command-exited-${String(commandStatus || 'nonzero')}: ${(stderrPayload || 'non-zero-exit').split('\n')[0].slice(0, 120)}`,
            status,
            maxBuffer: limit,
            durationMs: Date.now() - startMs
          }
        }

        if (result.error?.code === 'ENOENT') {
          return {
            out: null,
            error: 'openclaw-not-found',
            status: 'command-error',
            maxBuffer: limit,
            durationMs: Date.now() - startMs
          }
        }

        if (result.status !== 0) {
          return {
            out: null,
            error: `command-exited-${String(commandStatus || 'nonzero')}`,
            status: 'command-error',
            maxBuffer: limit,
            durationMs: Date.now() - startMs
          }
        }

        return { out: null, error: null, status: 'ok', maxBuffer: limit, durationMs: Date.now() - startMs }
      } catch (err) {
        const stdoutText = typeof err?.stdout === 'string' ? err.stdout : ''
        const stderrText = typeof err?.stderr === 'string' ? err.stderr : ''
        const stdoutPayload = stdoutText.trim()
        const stderrPayload = stderrText.trim()
        const cmdStatus = err?.status

        if ((err?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' || err?.code === 'ENOBUFS') && limit < OPENCLAW_PROBE_MAX_OUTPUT_BYTES_HARD_CAP) {
          limit = Math.min(limit * 2, OPENCLAW_PROBE_MAX_OUTPUT_BYTES_HARD_CAP)
          continue
        }

        if (stdoutPayload || stderrPayload) {
          const candidateOutput = [stdoutPayload, stderrPayload].filter(Boolean).join('\n')
          return {
            out: candidateOutput,
            error: `command-exited-${String(cmdStatus || 'nonzero')}: ${(stderrPayload || 'non-zero-exit').split('\n')[0].slice(0, 120)}`,
            status: 'ok-with-stderr',
            maxBuffer: limit,
            durationMs: Date.now() - startMs
          }
        }

        if (err?.code === 'ENOENT') {
          return { out: null, error: 'openclaw-not-found', status: 'command-error', maxBuffer: limit, durationMs: Date.now() - startMs }
        }

        return {
          out: null,
          error: err?.message ? String(err.message).split('\n')[0].slice(0, 180) : 'command-failed',
          status: 'command-error',
          maxBuffer: limit,
          durationMs: Date.now() - startMs
        }
      }
    }

    return {
      out: null,
      error: 'command-failed: max-buffer-limit-reached',
      status: 'command-error',
      maxBuffer: limit,
      durationMs: Date.now() - startMs
    }
  }

  let attempts = 0
  let sweeps = 0
  let sawCommandError = false
  let sawParseError = false
  let sawCommandMissing = false
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
        sawCommandMissing = true
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
    if (!isBinaryAvailable(preferredOpenClawProbe.binPath)) {
      preferredOpenClawProbe = null
    } else {
      const cachedResult = evaluateProbe(preferredOpenClawProbe.binPath, preferredOpenClawProbe.args, true)
      if (cachedResult) return cachedResult
    }
  }

  for (let sweep = 0; sweep <= OPENCLAW_PROBE_RETRIES; sweep++) {
    sweeps = sweep + 1
    let sweepHasPotentialExecutable = false

    for (const binPath of binaries) {
      const candidateExecutable = isBinaryAvailable(binPath)
      if (!candidateExecutable) {
        continue
      }

      sweepHasPotentialExecutable = true
      for (const args of subcommands) {
        const candidateResult = evaluateProbe(binPath, args)
        if (candidateResult) return candidateResult
      }
    }

    if (
      sawCommandMissing &&
      !sawCommandError &&
      !sawParseError &&
      !sweepHasPotentialExecutable
    ) {
      break
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
  if (DRY_RUN) return false

  if (CLOUD_INGEST_URL && CLOUD_API_KEY) {
    if (cloudIngestKickedOut) return false

    let attempt = 0
    while (attempt <= retries) {
      try {
        const response = await fetch(CLOUD_INGEST_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-idlewatch-key': CLOUD_API_KEY
          },
          body: JSON.stringify(row)
        })

        if (!response.ok) {
          let detail = null
          try {
            const payload = await response.json()
            detail = payload?.detail || payload?.error || payload?.message || null
          } catch {
            try {
              detail = (await response.text())?.slice(0, 180) || null
            } catch {
              detail = null
            }
          }

          if (response.status === 401 || response.status === 403) {
            cloudIngestKickedOut = true
            cloudIngestKickoutReason = detail || `http_${response.status}`
            return false
          }

          throw new Error(`cloud_ingest_failed_${response.status}`)
        }
        return true
      } catch (err) {
        if (cloudIngestKickedOut) throw err
        if (attempt >= retries) throw err
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
        attempt += 1
      }
    }
    return false
  }

  if (!appReady) return false
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
  const openclawEnabled = EFFECTIVE_OPENCLAW_MODE !== 'off'

  const disabledProbe = {
    result: 'disabled',
    attempts: 0,
    sweeps: 0,
    error: null,
    durationMs: null,
    usedFallbackCache: false,
    fallbackAgeMs: null,
    fallbackCacheSource: null
  }

  let usageProbe = openclawEnabled ? loadOpenClawUsage() : { usage: null, probe: disabledProbe }
  let usage = usageProbe.usage
  let usageFreshness = deriveUsageFreshness(usage, sampleStartMs, USAGE_STALE_MS, USAGE_NEAR_STALE_MS, USAGE_STALE_GRACE_MS)
  let usageRefreshAttempted = false
  let usageRefreshRecovered = false
  let usageRefreshAttempts = 0
  let usageRefreshDurationMs = null
  let usageRefreshStartMs = null

  const shouldRefreshForNearStale = USAGE_REFRESH_ON_NEAR_STALE === 1 && usageFreshness.isNearStale
  const canRefreshFromCurrentState = usageProbe.probe.result === 'ok' || usageProbe.probe.result === 'fallback-cache'

  if (openclawEnabled && usage && (usageFreshness.isPastStaleThreshold || shouldRefreshForNearStale) && canRefreshFromCurrentState) {
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

  const gpu = MONITOR_GPU
    ? (process.platform === 'darwin'
      ? gpuSampleDarwin()
      : gpuSampleNvidiaSmi())
    : { pct: null, source: 'disabled', confidence: 'none', sampleWindowMs: null }

  const memPressure = MONITOR_MEMORY
    ? loadMemPressure()
    : { pct: null, cls: 'disabled', source: 'disabled' }

  const usedMemPct = MONITOR_MEMORY ? memUsedPct() : null

  const usageIntegrationStatus = usage
    ? usageFreshness.isStale
      ? 'stale'
      : usage?.integrationStatus === 'partial'
        ? 'ok'
        : (usage?.integrationStatus ?? 'ok')
    : (openclawEnabled ? 'unavailable' : 'disabled')

  const source = {
    monitorTargets: [...MONITOR_TARGETS],
    usage: usage ? 'openclaw' : openclawEnabled ? 'unavailable' : 'disabled',
    usageIntegrationStatus,
    usageIngestionStatus: openclawEnabled
      ? usage && ['ok', 'fallback-cache'].includes(usageProbe.probe.result)
        ? 'ok'
        : 'unavailable'
      : 'disabled',
    usageActivityStatus: usage
      ? usageFreshness.freshnessState
      : (openclawEnabled ? 'unavailable' : 'disabled'),
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
    usageFreshnessState: openclawEnabled
      ? usage
        ? usageFreshness.freshnessState
        : null
      : 'disabled',
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
    memPressureSource: memPressure.source,
    cloudIngestionStatus: CLOUD_INGEST_URL && CLOUD_API_KEY
      ? cloudIngestKickedOut ? 'kicked-out' : 'enabled'
      : 'disabled',
    cloudIngestionReason: cloudIngestKickoutReason
  }

  const usageAlert = deriveUsageAlert(source, { usageAgeMs: usageFreshness.usageAgeMs, idleAfterMs: USAGE_IDLE_AFTER_MS })
  source.usageAlertLevel = usageAlert.level
  source.usageAlertReason = usageAlert.reason

  const row = {
    host: HOST,
    hostId: HOST,
    hostName: HOST,
    deviceId: DEVICE_ID,
    deviceName: DEVICE_NAME,
    ts: sampleAtMs,
    cpuPct: MONITOR_CPU ? cpuPct() : null,
    memPct: MONITOR_MEMORY ? usedMemPct : null,
    memUsedPct: MONITOR_MEMORY ? usedMemPct : null,
    memPressurePct: MONITOR_MEMORY ? memPressure.pct : null,
    memPressureClass: MONITOR_MEMORY ? memPressure.cls : 'disabled',
    gpuPct: MONITOR_GPU ? gpu.pct : null,
    gpuSource: gpu.source,
    gpuConfidence: gpu.confidence,
    gpuSampleWindowMs: gpu.sampleWindowMs,
    tokensPerMin: MONITOR_OPENCLAW ? (usage?.tokensPerMin ?? null) : null,
    openclawModel: MONITOR_OPENCLAW ? (usage?.model ?? null) : null,
    openclawTotalTokens: MONITOR_OPENCLAW ? (usage?.totalTokens ?? null) : null,
    openclawSessionId: MONITOR_OPENCLAW ? (usage?.sessionId ?? null) : null,
    openclawAgentId: MONITOR_OPENCLAW ? (usage?.agentId ?? null) : null,
    openclawUsageTs: MONITOR_OPENCLAW ? (usage?.usageTimestampMs ?? null) : null,
    openclawUsageAgeMs: MONITOR_OPENCLAW ? usageFreshness.usageAgeMs : null,
    localLogPath: LOCAL_LOG_PATH,
    localLogBytes: null,
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
  const localUsage = appendLocal(row)
  row.localLogPath = localUsage.path
  row.localLogBytes = localUsage.bytes

  console.log(JSON.stringify(row))

  const published = await publish(row)

  if (cloudIngestKickedOut && !cloudIngestKickoutNotified) {
    cloudIngestKickoutNotified = true
    console.error(
      `Cloud ingest disabled: API key rejected (${cloudIngestKickoutReason || 'unauthorized'}). Run idlewatch quickstart to link a new key.`
    )
  }

  if (REQUIRE_FIREBASE_WRITES && ONCE && !published) {
    throw new Error('Firebase write was required but not executed. Check Firebase configuration and connectivity.')
  }

  if (REQUIRE_CLOUD_WRITES && ONCE && !published) {
    if (cloudIngestKickedOut) {
      throw new Error(
        `Cloud API key was rejected (${cloudIngestKickoutReason || 'unauthorized'}). This device was disconnected. Run idlewatch quickstart with a new API key.`
      )
    }
    throw new Error('Cloud write was required but not executed. Check API key and cloud connectivity.')
  }
}

let running = false
let stopped = false
let inflightTick = null

async function loop() {
  if (stopped || running) return
  running = true
  try {
    inflightTick = tick()
    await inflightTick
  } catch (e) {
    console.error(e.message)
  } finally {
    inflightTick = null
    running = false
    if (!stopped) setTimeout(loop, INTERVAL_MS)
  }
}

async function gracefulShutdown(signal) {
  if (stopped) return
  stopped = true
  if (inflightTick) {
    console.log(`idlewatch received ${signal}, waiting for in-flight sample…`)
    try { await inflightTick } catch { /* already logged */ }
  }
  console.log('idlewatch stopped')
  process.exit(0)
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

if (DRY_RUN || ONCE) {
  const mode = DRY_RUN ? 'dry-run' : 'once'
  console.log(
    `idlewatch ${mode} host=${HOST} device=${DEVICE_NAME} deviceId=${DEVICE_ID} intervalMs=${INTERVAL_MS} publish=${getPublishModeLabel()} localLog=${LOCAL_LOG_PATH} env=${persistedEnv?.envFile || 'process'}`
  )
  tick()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e.message)
      process.exit(1)
    })
} else {
  console.log(
    `idlewatch started host=${HOST} device=${DEVICE_NAME} deviceId=${DEVICE_ID} intervalMs=${INTERVAL_MS} publish=${getPublishModeLabel()} localLog=${LOCAL_LOG_PATH} monitorTargets=${[...MONITOR_TARGETS].join(',')} openclawUsage=${EFFECTIVE_OPENCLAW_MODE} env=${persistedEnv?.envFile || 'process'}`
  )
  loop()
}
