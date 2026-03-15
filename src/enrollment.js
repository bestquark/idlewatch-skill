import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

function defaultConfigDir() {
  return path.join(os.homedir(), '.idlewatch')
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function writeSecureFile(filePath, content) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, content, { encoding: 'utf8', mode: 0o600 })
  try {
    fs.chmodSync(filePath, 0o600)
  } catch {
    // best effort on filesystems that ignore chmod
  }
}

const MONITOR_TARGET_CHOICES = ['cpu', 'memory', 'gpu', 'openclaw']
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..')

function commandExists(bin, args = ['--version']) {
  const result = spawnSync(bin, args, { stdio: 'ignore' })
  return result.status === 0
}

function detectAvailableMonitorTargets() {
  const available = new Set(['cpu', 'memory'])

  if (process.platform === 'darwin' || commandExists('nvidia-smi', ['--help'])) {
    available.add('gpu')
  }

  if (commandExists('openclaw', ['--help'])) {
    available.add('openclaw')
  }

  return [...available]
}

function normalizeMonitorTargets(raw, available) {
  const fallback = ['cpu', 'memory', ...(available.includes('openclaw') ? ['openclaw'] : []), ...(available.includes('gpu') ? ['gpu'] : [])]
  if (!raw) return fallback

  const parsed = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item) => MONITOR_TARGET_CHOICES.includes(item) && available.includes(item))

  if (parsed.length === 0) return fallback
  return [...new Set(parsed)]
}

function normalizeCloudApiKey(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''

  const token = trimmed
    .split(/\s+/)
    .find((part) => part.startsWith('iwk_'))

  if (token) {
    return token.replace(/^['"]|['",]$/g, '')
  }

  return trimmed.replace(/^['"]|['"]$/g, '')
}

function looksLikeCloudApiKey(value) {
  return /^iwk_[A-Za-z0-9_-]{20,}$/.test(String(value || '').trim())
}

function normalizeDeviceName(raw, fallback = os.hostname()) {
  const value = String(raw || '').trim().replace(/\s+/g, ' ')
  return value || fallback
}

function sanitizeDeviceId(raw, fallback = os.hostname()) {
  const base = normalizeDeviceName(raw, fallback).toLowerCase()
  const sanitized = base
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return sanitized || normalizeDeviceName(fallback).replace(/[^a-zA-Z0-9_.-]/g, '_')
}

function cargoAvailable() {
  const cargoProbe = spawnSync('cargo', ['--version'], { stdio: 'ignore' })
  return cargoProbe.status === 0
}

function installRustToolchain() {
  if (cargoAvailable()) return { ok: true, installed: false }
  if (process.env.IDLEWATCH_DISABLE_RUST_INSTALL === '1') return { ok: false, reason: 'install-disabled' }
  if (!process.stdin.isTTY || !process.stdout.isTTY) return { ok: false, reason: 'non-tty' }
  if (!['darwin', 'linux'].includes(process.platform)) return { ok: false, reason: `unsupported-platform:${process.platform}` }

  console.log('IdleWatch TUI needs Rust/Cargo. Installing rustup + Cargo now...')
  const install = spawnSync('sh', ['-c', 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      CARGO_HOME: process.env.CARGO_HOME || path.join(os.homedir(), '.cargo'),
      RUSTUP_HOME: process.env.RUSTUP_HOME || path.join(os.homedir(), '.rustup')
    }
  })

  if (install.status !== 0) return { ok: false, reason: `rustup-install-failed:${install.status ?? 'unknown'}` }

  const cargoBinDir = path.join(process.env.CARGO_HOME || path.join(os.homedir(), '.cargo'), 'bin')
  if (!process.env.PATH?.split(path.delimiter).includes(cargoBinDir)) {
    process.env.PATH = `${cargoBinDir}${path.delimiter}${process.env.PATH || ''}`
  }

  return cargoAvailable() ? { ok: true, installed: true } : { ok: false, reason: 'cargo-still-missing' }
}

function tryRustTui({ configDir, outputEnvFile, autoInstallRust = true }) {
  const disabled = process.env.IDLEWATCH_DISABLE_RUST_TUI === '1'
  if (disabled) return { ok: false, reason: 'disabled' }

  if (!cargoAvailable()) {
    if (autoInstallRust) {
      const installResult = installRustToolchain()
      if (!installResult.ok) return { ok: false, reason: installResult.reason || 'cargo-missing' }
    } else {
      return { ok: false, reason: 'cargo-missing' }
    }
  }

  const manifestPath = path.join(PACKAGE_ROOT, 'tui', 'Cargo.toml')
  if (!fs.existsSync(manifestPath)) return { ok: false, reason: 'manifest-missing', manifestPath }

  const run = spawnSync('cargo', ['run', '--quiet', '--manifest-path', manifestPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      IDLEWATCH_ENROLL_CONFIG_DIR: configDir,
      IDLEWATCH_ENROLL_OUTPUT_ENV_FILE: outputEnvFile
    }
  })

  if (run.status === 0) {
    return { ok: true, manifestPath }
  }

  return { ok: false, reason: `cargo-run-failed:${run.status ?? 'unknown'}`, manifestPath }
}

function promptModeText() {
  return `\n╭───────────────────────────────────────────────╮\n│              IdleWatch Setup Wizard           │\n╰───────────────────────────────────────────────╯\n\nChoose setup mode:\n  1) Managed cloud (recommended)\n     Link this device with an API key from idlewatch.com/api\n  2) Local-only (no cloud writes)\n`
}

export async function runEnrollmentWizard(options = {}) {
  const nonInteractive = options.nonInteractive || process.env.IDLEWATCH_ENROLL_NON_INTERACTIVE === '1'
  const noTui = options.noTui || process.env.IDLEWATCH_NO_TUI === '1'
  const configDir = path.resolve(options.configDir || process.env.IDLEWATCH_ENROLL_CONFIG_DIR || defaultConfigDir())
  const outputEnvFile = path.resolve(options.outputEnvFile || process.env.IDLEWATCH_ENROLL_OUTPUT_ENV_FILE || path.join(configDir, 'idlewatch.env'))

  let mode = options.mode || process.env.IDLEWATCH_ENROLL_MODE || null
  let cloudApiKey = normalizeCloudApiKey(options.cloudApiKey || process.env.IDLEWATCH_CLOUD_API_KEY || null)
  let cloudIngestUrl = options.cloudIngestUrl || process.env.IDLEWATCH_CLOUD_INGEST_URL || 'https://api.idlewatch.com/api/ingest'
  let deviceName = normalizeDeviceName(options.deviceName || process.env.IDLEWATCH_DEVICE_NAME || os.hostname())

  const availableMonitorTargets = detectAvailableMonitorTargets()
  let monitorTargets = normalizeMonitorTargets(
    options.monitorTargets || process.env.IDLEWATCH_MONITOR_TARGETS || '',
    availableMonitorTargets
  )

  if (!nonInteractive && !noTui) {
    const tuiResult = tryRustTui({ configDir, outputEnvFile, autoInstallRust: true })
    if (tuiResult.ok) {
      return {
        mode: 'tui',
        configDir,
        outputEnvFile
      }
    }

    if (!['disabled', 'cargo-missing'].includes(tuiResult.reason || '')) {
      console.warn(`IdleWatch TUI unavailable (${tuiResult.reason || 'unknown'}). Falling back to text setup.`)
    }
  }

  let rl = null
  if (!nonInteractive) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    console.log(promptModeText())
    console.log(`Storage path: ${configDir}`)
    console.log(`Environment file: ${outputEnvFile}`)
    const modeInput = (await rl.question('\nMode [1/2] (default 1): ')).trim() || '1'
    mode = modeInput === '2' ? 'local' : 'production'
    const deviceNameInput = (await rl.question(`Device name [${deviceName}]: `)).trim()
    deviceName = normalizeDeviceName(deviceNameInput || deviceName)
  }

  if (!mode) mode = 'production'
  if (!['production', 'local'].includes(mode)) {
    throw new Error(`Invalid enrollment mode: ${mode}`)
  }

  if ((mode === 'production') && !cloudApiKey) {
    if (!rl) throw new Error('Missing cloud API key (IDLEWATCH_CLOUD_API_KEY).')
    console.log('\nPaste the API key from idlewatch.com/api.')
    cloudApiKey = normalizeCloudApiKey(await rl.question('Cloud API key: '))
  }

  if (!nonInteractive && rl) {
    console.log(`\nDetected monitor targets on this machine: ${availableMonitorTargets.join(', ')}`)
    const suggested = monitorTargets.join(',')
    const monitorInput = (await rl.question(`Monitor targets [${suggested}]: `)).trim()
    monitorTargets = normalizeMonitorTargets(monitorInput || suggested, availableMonitorTargets)
  }

  const safeDeviceId = sanitizeDeviceId(options.deviceId || process.env.IDLEWATCH_DEVICE_ID || deviceName, os.hostname())
  const localLogPath = path.join(configDir, 'logs', `${safeDeviceId}-metrics.ndjson`)
  const localCachePath = path.join(configDir, 'cache', `${safeDeviceId}-openclaw-last-good.json`)

  const envLines = [
    '# Generated by idlewatch-agent quickstart',
    `IDLEWATCH_DEVICE_NAME=${deviceName}`,
    `IDLEWATCH_DEVICE_ID=${safeDeviceId}`,
    `IDLEWATCH_MONITOR_TARGETS=${monitorTargets.join(',')}`,
    `IDLEWATCH_OPENCLAW_USAGE=${monitorTargets.includes('openclaw') ? 'auto' : 'off'}`,
    `IDLEWATCH_LOCAL_LOG_PATH=${localLogPath}`,
    `IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH=${localCachePath}`
  ]

  if (mode === 'local') {
    envLines.push('# Local-only mode (no cloud/Firebase writes).')
  }

  if (mode === 'production') {
    if (!cloudApiKey || !looksLikeCloudApiKey(cloudApiKey)) {
      throw new Error('Cloud API key is invalid. Copy the full key from idlewatch.com/api (starts with iwk_).')
    }
    envLines.push(`IDLEWATCH_CLOUD_INGEST_URL=${cloudIngestUrl}`)
    envLines.push(`IDLEWATCH_CLOUD_API_KEY=${cloudApiKey}`)
    envLines.push('IDLEWATCH_REQUIRE_CLOUD_WRITES=1')
  }

  writeSecureFile(outputEnvFile, `${envLines.join('\n')}\n`)

  if (rl) rl.close()

  return {
    mode,
    configDir,
    outputEnvFile,
    monitorTargets,
    deviceName,
    deviceId: safeDeviceId
  }
}
