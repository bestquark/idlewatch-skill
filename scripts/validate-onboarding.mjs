import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const binPath = path.join(repoRoot, 'bin', 'idlewatch-agent.js')
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-onboarding-'))

const requests = []
const server = http.createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })
  req.on('end', () => {
    requests.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body
    })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  })
})

await new Promise((resolve, reject) => {
  server.listen(0, '127.0.0.1', () => resolve())
  server.once('error', reject)
})

const address = server.address()
const cloudIngestUrl = `http://127.0.0.1:${address.port}/api/ingest`

function runQuickstart(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binPath, 'quickstart'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

try {
  const envOut = path.join(tmpRoot, 'generated.env')
  const configDir = path.join(tmpRoot, 'config')
  const localLogPath = path.join(configDir, 'logs', 'validator-box-metrics.ndjson')
  const lastGoodCachePath = path.join(configDir, 'cache', 'validator-box-openclaw-last-good.json')

  const run = await runQuickstart({
    ...process.env,
    IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
    IDLEWATCH_ENROLL_MODE: 'production',
    IDLEWATCH_CLOUD_API_KEY: 'iwk_abcdefghijklmnopqrstuvwxyz123456',
    IDLEWATCH_CLOUD_INGEST_URL: cloudIngestUrl,
    IDLEWATCH_ENROLL_OUTPUT_ENV_FILE: envOut,
    IDLEWATCH_ENROLL_CONFIG_DIR: configDir,
    IDLEWATCH_DEVICE_NAME: 'Validator Box',
    IDLEWATCH_DEVICE_ID: 'validator-box',
    IDLEWATCH_MONITOR_TARGETS: 'cpu,memory',
    IDLEWATCH_OPENCLAW_USAGE: 'off'
  })

  if (run.code !== 0) {
    throw new Error(`quickstart failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`)
  }

  if (!fs.existsSync(envOut)) {
    throw new Error('quickstart did not create output env file')
  }

  const envContent = fs.readFileSync(envOut, 'utf8')
  for (const requiredLine of [
    'IDLEWATCH_DEVICE_NAME=Validator Box',
    'IDLEWATCH_DEVICE_ID=validator-box',
    'IDLEWATCH_MONITOR_TARGETS=cpu,memory',
    'IDLEWATCH_OPENCLAW_USAGE=off',
    `IDLEWATCH_LOCAL_LOG_PATH=${localLogPath}`,
    `IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH=${lastGoodCachePath}`,
    `IDLEWATCH_CLOUD_INGEST_URL=${cloudIngestUrl}`,
    'IDLEWATCH_CLOUD_API_KEY=iwk_abcdefghijklmnopqrstuvwxyz123456',
    'IDLEWATCH_REQUIRE_CLOUD_WRITES=1'
  ]) {
    if (!envContent.includes(requiredLine)) {
      throw new Error(`env file missing ${requiredLine}`)
    }
  }

  if (!run.stdout.includes('✅ Setup complete.')) {
    throw new Error('quickstart success output did not include setup completion summary')
  }

  if (requests.length === 0) {
    throw new Error('quickstart did not send the initial telemetry sample')
  }

  const telemetry = JSON.parse(requests[0].body)
  if (telemetry.deviceId !== 'validator-box') {
    throw new Error('initial telemetry sample used unexpected device id')
  }

  console.log('onboarding validation passed')
} finally {
  await new Promise((resolve) => server.close(resolve))
  fs.rmSync(tmpRoot, { recursive: true, force: true })
}
