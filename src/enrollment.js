import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline/promises'

async function questionOrCancel(rl, prompt) {
  const answer = await rl.question(prompt)
  if (answer === '' && process.stdin.readableEnded) {
    throw new Error('setup_cancelled')
  }
  return answer
}
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { providerQuotaSupported } from './provider-quota.js'
import { resolveTemperatureProbe } from './thermal.js'

function defaultConfigDir() {
  return path.join(os.homedir(), '.idlewatch')
}

function machineName() {
  if (process.platform === 'darwin') {
    const macName = spawnSync('scutil', ['--get', 'ComputerName'], { encoding: 'utf8' })
    if (macName.status === 0) {
      const value = String(macName.stdout || '').trim()
      if (value) return value
    }
  }

  const hostName = String(os.hostname() || '').trim()
  if (hostName) return hostName

  const envHost = String(process.env.HOSTNAME || '').trim()
  if (envHost) return envHost

  return 'IdleWatch Device'
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

const OPENCLAW_AGENT_TARGETS = ['agent_activity', 'token_usage', 'runtime_state']
const PROVIDER_TARGETS = ['provider_quota']
const OPENCLAW_DERIVED_TARGETS = [...OPENCLAW_AGENT_TARGETS]
const MONITOR_TARGET_CHOICES = ['cpu', 'memory', 'gpu', 'temperature', 'openclaw', ...OPENCLAW_DERIVED_TARGETS, ...PROVIDER_TARGETS]
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
  if (process.platform === 'darwin') {
    available.add('temperature')
  }

  if (commandExists('openclaw', ['--help'])) {
    OPENCLAW_DERIVED_TARGETS.forEach((target) => available.add(target))
  }
  if (providerQuotaSupported()) {
    PROVIDER_TARGETS.forEach((target) => available.add(target))
  }

  return [...available]
}

function fallbackMonitorTargets(available) {
  return [
    'cpu',
    'memory',
    ...(available.includes('gpu') ? ['gpu'] : []),
    ...(available.includes('temperature') ? ['temperature'] : []),
    ...OPENCLAW_DERIVED_TARGETS.filter((target) => available.includes(target))
  ]
}

function normalizeMonitorTargets(raw, available) {
  const fallback = fallbackMonitorTargets(available)
  if (!raw) return fallback

  const parsed = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item) => MONITOR_TARGET_CHOICES.includes(item))
    .flatMap((item) => (item === 'openclaw' ? OPENCLAW_DERIVED_TARGETS : [item]))
    .filter((item) => available.includes(item))

  if (parsed.length === 0) return fallback
  return [...new Set(parsed)]
}

function ensureMonitorTargetsOrThrow(raw, available) {
  const normalizedRaw = String(raw || '').trim()
  if (!normalizedRaw) return fallbackMonitorTargets(available)

  const explicitlyRequested = normalizedRaw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  const validRequested = explicitlyRequested.filter((item) => MONITOR_TARGET_CHOICES.includes(item))
  const parsed = validRequested
    .flatMap((item) => (item === 'openclaw' ? OPENCLAW_DERIVED_TARGETS : [item]))
    .filter((item) => available.includes(item))

  if (parsed.length > 0) return [...new Set(parsed)]

  const invalidRequested = explicitlyRequested.filter((item) => !MONITOR_TARGET_CHOICES.includes(item))
  const availableList = available.join(', ')
  const invalidHint = invalidRequested.length > 0
    ? ` Unknown: ${invalidRequested.join(', ')}.`
    : ''
  throw new Error(`No valid metrics were selected.${invalidHint} Choose one or more of: ${availableList}.`)
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

function normalizeDeviceName(raw, fallback = machineName()) {
  const value = String(raw || '').trim().replace(/\s+/g, ' ')
  return value || fallback
}

function sanitizeDeviceId(raw, fallback = machineName()) {
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

function bundledTuiBinaryPath() {
  const override = String(process.env.IDLEWATCH_TUI_BIN || '').trim()
  if (override) return path.resolve(override)

  const platform = process.platform
  const arch = process.arch
  const ext = platform === 'win32' ? '.exe' : ''
  return path.join(PACKAGE_ROOT, 'tui', 'bin', `${platform}-${arch}`, `idlewatch-setup${ext}`)
}

function parseEnvValue(rawValue) {
  const value = String(rawValue || '').trim()
  if (!value) return ''

  const quote = value[0]
  if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
    return value.slice(1, -1)
  }

  return value
}

function normalizeEnvKey(rawKey) {
  const key = String(rawKey || '').trim().replace(/^export\s+/, '')
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : ''
}

function parseEnrollmentResultFromEnvFile(outputEnvFile, { configDir, fallbackDeviceName }) {
  if (!outputEnvFile || !fs.existsSync(outputEnvFile)) return null

  let raw = ''
  try {
    raw = fs.readFileSync(outputEnvFile, 'utf8')
  } catch {
    return null
  }

  const parsed = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = normalizeEnvKey(trimmed.slice(0, idx))
    const value = parseEnvValue(trimmed.slice(idx + 1))
    if (key) parsed[key] = value
  }

  const deviceName = normalizeDeviceName(parsed.IDLEWATCH_DEVICE_NAME || fallbackDeviceName || machineName())
  const deviceId = sanitizeDeviceId(parsed.IDLEWATCH_DEVICE_ID || deviceName, machineName())
  const monitorTargets = normalizeMonitorTargets(parsed.IDLEWATCH_MONITOR_TARGETS || '', detectAvailableMonitorTargets())
  const mode = looksLikeCloudApiKey(parsed.IDLEWATCH_CLOUD_API_KEY || '') ? 'production' : 'local'

  return {
    mode,
    configDir,
    outputEnvFile,
    monitorTargets,
    deviceName,
    deviceId
  }
}

function tryBundledRustTui({ configDir, outputEnvFile }) {
  const binPath = bundledTuiBinaryPath()
  if (!fs.existsSync(binPath)) return { ok: false, reason: 'bundled-binary-missing', binPath }

  try {
    fs.chmodSync(binPath, 0o755)
  } catch {
    // best effort
  }

  const run = spawnSync(binPath, [], {
    stdio: 'inherit',
    env: {
      ...process.env,
      IDLEWATCH_ENROLL_CONFIG_DIR: configDir,
      IDLEWATCH_ENROLL_OUTPUT_ENV_FILE: outputEnvFile
    }
  })

  if (run.status === 0) return { ok: true, binPath }
  return { ok: false, reason: `bundled-binary-failed:${run.status ?? 'unknown'}`, binPath }
}

function tryRustTui({ configDir, outputEnvFile }) {
  const disabled = process.env.IDLEWATCH_DISABLE_RUST_TUI === '1'
  if (disabled) return { ok: false, reason: 'disabled' }

  const bundled = tryBundledRustTui({ configDir, outputEnvFile })
  if (bundled.ok) return bundled

  if (!cargoAvailable()) {
    return bundled.reason === 'bundled-binary-missing'
      ? { ok: false, reason: 'bundled-binary-missing-and-cargo-missing', binPath: bundled.binPath }
      : { ok: false, reason: 'cargo-missing' }
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

export function promptModeText({ isReconfigure = false } = {}) {
  const title = isReconfigure ? 'IdleWatch Reconfigure' : 'IdleWatch Setup'
  return `\n${title}\n\nSetup mode:\n  1) Cloud link — publish with an API key from idlewatch.com/api\n  2) Local-only — keep samples on this Mac\n`
}

function monitorTargetsNeedOpenClawUsage(monitorTargets) {
  return monitorTargets.some((item) => OPENCLAW_AGENT_TARGETS.includes(item) && item !== 'agent_activity')
}

function ensureTemperatureTelemetryHelper(monitorTargets, { nonInteractive = false } = {}) {
  if (process.platform !== 'darwin' || !monitorTargets.includes('temperature')) {
    return { status: 'not-required', helper: null }
  }

  const existing = resolveTemperatureProbe()
  if (existing) {
    return { status: 'available', helper: existing.source }
  }

  console.log('\nTemperature telemetry selected. Installing a macOS temperature helper for direct Celsius readings…')

  const installRuns = []
  const runInstall = (label, command, args) => {
    const run = spawnSync(command, args, {
      encoding: 'utf8',
      stdio: nonInteractive ? 'pipe' : 'inherit'
    })
    installRuns.push({
      label,
      command,
      args,
      status: run.status,
      stderr: String(run.stderr || '').trim()
    })
    return run.status === 0
  }

  if (commandExists('brew', ['--version'])) {
    runInstall('brew', 'brew', ['install', 'osx-cpu-temp'])
    const brewProbe = resolveTemperatureProbe()
    if (brewProbe) {
      return { status: 'installed', helper: brewProbe.source, installer: 'brew' }
    }
  }

  if (commandExists('gem', ['--version'])) {
    runInstall('gem', 'gem', ['install', 'iStats', '--user-install', '--no-document'])
    const gemProbe = resolveTemperatureProbe()
    if (gemProbe) {
      return { status: 'installed', helper: gemProbe.source, installer: 'gem' }
    }
  }

  const lastFailure = installRuns.findLast((attempt) => attempt.status !== 0)
  const detail = lastFailure?.stderr || installRuns.map((attempt) => `${attempt.label}:${attempt.status}`).join(', ') || 'no_supported_installer'
  return {
    status: 'failed',
    helper: null,
    reason: detail
  }
}

export async function runEnrollmentWizard(options = {}) {
  const nonInteractive = options.nonInteractive || process.env.IDLEWATCH_ENROLL_NON_INTERACTIVE === '1'
  const noTui = options.noTui || process.env.IDLEWATCH_NO_TUI === '1'
  const configDir = path.resolve(options.configDir || process.env.IDLEWATCH_ENROLL_CONFIG_DIR || defaultConfigDir())
  const outputEnvFile = path.resolve(options.outputEnvFile || process.env.IDLEWATCH_ENROLL_OUTPUT_ENV_FILE || path.join(configDir, 'idlewatch.env'))

  // Load existing saved config for reconfigure defaults
  let existingConfig = null
  if (fs.existsSync(outputEnvFile)) {
    existingConfig = parseEnrollmentResultFromEnvFile(outputEnvFile, { configDir, fallbackDeviceName: machineName() })
  }

  let mode = options.mode || process.env.IDLEWATCH_ENROLL_MODE || null
  if (!mode && nonInteractive && existingConfig?.mode) {
    mode = existingConfig.mode
  }
  let cloudApiKey = normalizeCloudApiKey(options.cloudApiKey || process.env.IDLEWATCH_CLOUD_API_KEY || null)
  let cloudIngestUrl = options.cloudIngestUrl || process.env.IDLEWATCH_CLOUD_INGEST_URL || 'https://api.idlewatch.com/api/ingest'
  
  // Device name persists across reinstall - reuse from config or prompt to confirm
  const hasExistingDeviceName = existingConfig?.deviceName && String(existingConfig.deviceName).trim()
  let deviceName = normalizeDeviceName(
    options.deviceName || process.env.IDLEWATCH_ENROLL_DEVICE_NAME || process.env.IDLEWATCH_DEVICE_NAME ||
    (hasExistingDeviceName ? existingConfig.deviceName : null) || machineName()
  )

  const availableMonitorTargets = detectAvailableMonitorTargets()
  const requestedMonitorTargets = options.monitorTargets || process.env.IDLEWATCH_ENROLL_MONITOR_TARGETS || process.env.IDLEWATCH_MONITOR_TARGETS || ''
  let monitorTargets = ensureMonitorTargetsOrThrow(requestedMonitorTargets, availableMonitorTargets)

  if (!nonInteractive && !noTui) {
    const tuiResult = tryRustTui({ configDir, outputEnvFile })
    const tuiEnrollment = parseEnrollmentResultFromEnvFile(outputEnvFile, { configDir, fallbackDeviceName: deviceName })
    if (tuiResult.ok) {
      const enrollment = tuiEnrollment || {
        mode: 'tui',
        configDir,
        outputEnvFile
      }
      const temperatureHelper = ensureTemperatureTelemetryHelper(enrollment.monitorTargets || monitorTargets, { nonInteractive })
      return {
        ...enrollment,
        temperatureHelper
      }
    }

    if (tuiEnrollment) {
      const temperatureHelper = ensureTemperatureTelemetryHelper(tuiEnrollment.monitorTargets || monitorTargets, { nonInteractive })
      return {
        ...tuiEnrollment,
        temperatureHelper
      }
    }

    if (tuiResult.reason === 'bundled-binary-missing-and-cargo-missing') {
      console.warn('TUI setup not available for this platform. Using text prompts.')
    } else if (!['disabled', 'cargo-missing', 'bundled-binary-missing'].includes(tuiResult.reason || '')) {
      console.warn(`IdleWatch TUI unavailable (${tuiResult.reason || 'unknown'}). Falling back to text setup.`)
    }
  }

  let rl = null
  if (!nonInteractive) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const isReconfigure = !!existingConfig
    const currentMode = existingConfig?.mode || null
    const modeDefault = currentMode === 'local' ? '2' : '1'
    console.log(promptModeText({ isReconfigure }))
    if (isReconfigure) {
      console.log(`Current device: ${existingConfig.deviceName} (${currentMode === 'production' ? 'cloud' : 'local-only'})`)
    }
    const modeInput = (await questionOrCancel(rl, `\nMode [1/2] (default ${modeDefault}): `)).trim() || modeDefault
    mode = modeInput === '2' ? 'local' : 'production'
    const deviceNameInput = (await questionOrCancel(rl, `Device name [${deviceName}]: `)).trim()
    deviceName = normalizeDeviceName(deviceNameInput || deviceName)
  }

  if (!mode) mode = 'production'
  if (!['production', 'local'].includes(mode)) {
    throw new Error(`Invalid enrollment mode: ${mode}. Choose "production" (cloud) or "local".`)
  }

  if ((mode === 'production') && !cloudApiKey) {
    // Try to reuse existing saved API key when reconfiguring
    if (existingConfig?.mode === 'production' && fs.existsSync(outputEnvFile)) {
      try {
        const raw = fs.readFileSync(outputEnvFile, 'utf8')
        for (const line of raw.split(/\r?\n/)) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const idx = trimmed.indexOf('=')
          if (idx <= 0) continue
          const key = normalizeEnvKey(trimmed.slice(0, idx))
          if (key !== 'IDLEWATCH_CLOUD_API_KEY') continue
          const savedKey = normalizeCloudApiKey(parseEnvValue(trimmed.slice(idx + 1)))
          if (looksLikeCloudApiKey(savedKey)) {
            cloudApiKey = savedKey
            break
          }
        }
      } catch { /* ignore */ }
    }

    if (!cloudApiKey) {
      if (!rl) throw new Error('Missing cloud API key (IDLEWATCH_CLOUD_API_KEY).')
      console.log('\nPaste the API key from idlewatch.com/api.')
      for (let attempt = 0; attempt < 3; attempt++) {
        cloudApiKey = normalizeCloudApiKey(await questionOrCancel(rl, 'Cloud API key: '))
        if (looksLikeCloudApiKey(cloudApiKey)) break
        if (attempt < 2) console.log('That doesn\'t look right — API keys start with iwk_ (copy from idlewatch.com/api).')
        else cloudApiKey = ''
      }
    } else if (rl) {
      const masked = cloudApiKey.slice(0, 8) + '…' + cloudApiKey.slice(-4)
      console.log(`\nUsing saved API key: ${masked}`)
      const changeKey = (await questionOrCancel(rl, 'Keep this key? [Y/n]: ')).trim().toLowerCase()
      if (changeKey === 'n' || changeKey === 'no') {
        console.log('Paste the new API key from idlewatch.com/api.')
        for (let attempt = 0; attempt < 3; attempt++) {
          cloudApiKey = normalizeCloudApiKey(await questionOrCancel(rl, 'Cloud API key: '))
          if (looksLikeCloudApiKey(cloudApiKey)) break
          if (attempt < 2) console.log('That doesn\'t look right — API keys start with iwk_ (copy from idlewatch.com/api).')
          else cloudApiKey = ''
        }
      }
    }
  }

  if (!nonInteractive && rl) {
    const friendlyTargetLabels = {
      cpu: 'CPU', memory: 'Memory', gpu: 'GPU', temperature: 'Temperature',
      agent_activity: 'OpenClaw activity', token_usage: 'OpenClaw tokens',
      runtime_state: 'OpenClaw runtime', provider_quota: 'Provider quota'
    }
    const friendlyAvailable = availableMonitorTargets.map(t => friendlyTargetLabels[t] || t)
    console.log(`\nAvailable metrics: ${friendlyAvailable.join(', ')}`)
    const suggested = monitorTargets.join(',')
    const friendlySuggested = monitorTargets.map(t => friendlyTargetLabels[t] || t).join(', ')
    console.log(`Selected: ${friendlySuggested}`)
    const monitorInput = (await questionOrCancel(rl, `Metrics [${suggested}]: `)).trim()
    monitorTargets = ensureMonitorTargetsOrThrow(monitorInput || suggested, availableMonitorTargets)
  }

  const safeDeviceId = sanitizeDeviceId(
    options.deviceId || process.env.IDLEWATCH_ENROLL_DEVICE_ID || (options.preserveSavedDeviceId ? existingConfig?.deviceId : null) || deviceName,
    machineName()
  )
  const localLogPath = path.join(configDir, 'logs', `${safeDeviceId}-metrics.ndjson`)
  const localCachePath = path.join(configDir, 'cache', `${safeDeviceId}-openclaw-last-good.json`)

  const envLines = [
    '# Generated by idlewatch-agent',
    `IDLEWATCH_DEVICE_NAME=${deviceName}`,
    `IDLEWATCH_DEVICE_ID=${safeDeviceId}`,
    `IDLEWATCH_MONITOR_TARGETS=${monitorTargets.join(',')}`,
    `IDLEWATCH_OPENCLAW_USAGE=${monitorTargetsNeedOpenClawUsage(monitorTargets) ? 'auto' : 'off'}`,
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

  if (rl) rl.close()

  // Write config file immediately during wizard for P2 - env persistence fix
  writeSecureFile(outputEnvFile, `${envLines.join('\n')}\n`)
  console.log(`Config saved to: ${outputEnvFile}`)

  const temperatureHelper = ensureTemperatureTelemetryHelper(monitorTargets, { nonInteractive })

  return {
    mode,
    configDir,
    outputEnvFile,
    monitorTargets,
    temperatureHelper,
    deviceName,
    deviceId: safeDeviceId
  }
}
