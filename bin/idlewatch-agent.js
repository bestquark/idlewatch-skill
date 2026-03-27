#!/usr/bin/env node
import fs from 'fs'
import { accessSync, constants } from 'node:fs'
import http from 'node:http'
import os from 'os'
import path from 'path'
import process from 'process'
import readline from 'node:readline/promises'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'module'
import { parseOpenClawUsage } from '../src/openclaw-usage.js'
import { gpuSampleDarwin } from '../src/gpu.js'
import { memUsedPct, memoryPressureDarwin } from '../src/memory.js'
import { thermalSampleDarwin } from '../src/thermal.js'
import { deriveUsageFreshness } from '../src/usage-freshness.js'
import { deriveUsageAlert } from '../src/usage-alert.js'
import { loadLastGoodUsageSnapshot, persistLastGoodUsageSnapshot } from '../src/openclaw-cache.js'
import { DAY_WINDOW_MS, loadOpenClawActivitySummary } from '../src/openclaw-activity.js'
import { runEnrollmentWizard } from '../src/enrollment.js'
import { enrichWithOpenClawFleetTelemetry } from '../src/telemetry-mapping.js'
import {
  collectProviderQuotas,
  defaultProviderQuotaCacheFile,
  loadProviderQuotaCache,
  PROVIDER_QUOTA_DEFAULT_INTERVAL_MS,
  PROVIDER_QUOTA_DEFAULT_TIMEOUT_MS
} from '../src/provider-quota.js'
import {
  collectCustomMetrics,
  defaultCustomMetricsFile,
  loadCustomMetricDefinitions,
  normalizeCustomMetricDefinition,
  saveCustomMetricDefinitions,
  slugifyMetricKey
} from '../src/custom-telemetry.js'
import { installMenubarApp } from '../scripts/install-macos-menubar.mjs'
import pkg from '../package.json' with { type: 'json' }

function shellQuote(value) {
  if (typeof value !== 'string' || value.length === 0) return "''"
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function detectCliInvocation() {
  const scriptArg = process.argv[1] || ''
  const scriptBase = path.basename(scriptArg)
  const execArgv = process.execArgv || []
  const npmExecPath = String(process.env.npm_execpath || '').toLowerCase()
  const userAgent = String(process.env.npm_config_user_agent || '').toLowerCase()
  const npmCommand = String(process.env.npm_command || '').toLowerCase()
  const npmLifecycleEvent = String(process.env.npm_lifecycle_event || '').toLowerCase()
  const looksLikeRepoScript = scriptBase === 'idlewatch-agent.js' && /(?:^|\/)bin\/idlewatch-agent\.js$/.test(scriptArg)
  const looksLikeGlobalShim = scriptBase === 'idlewatch' || scriptBase === 'idlewatch-agent' || /(?:^|\/)node_modules\/\.bin\/(?:idlewatch|idlewatch-agent)$/.test(scriptArg)
  const looksLikeNpx = npmExecPath.includes('npx-cli') || npmExecPath.endsWith('/npx') || npmCommand === 'exec' || npmLifecycleEvent === 'npx' || (userAgent.includes('npm/') && execArgv.includes('exec'))

  if (looksLikeNpx) return { kind: 'npx', base: 'npx idlewatch' }
  if (looksLikeGlobalShim) return { kind: 'global', base: 'idlewatch' }
  if (looksLikeRepoScript) {
    const relativeScript = path.relative(process.cwd(), scriptArg)
    const displayScript = relativeScript && !relativeScript.startsWith('..') && !path.isAbsolute(relativeScript)
      ? relativeScript
      : scriptArg
    return { kind: 'source', base: `node ${shellQuote(displayScript)}` }
  }

  return { kind: 'global', base: 'idlewatch' }
}

function inferCliCommand(command = '') {
  const { base } = detectCliInvocation()
  return command ? `${base} ${command}` : base
}

function preferredSetupCommand(command = 'quickstart') {
  const suffix = process.stdin.isTTY ? '' : ' --no-tui'
  return inferCliCommand(`${command}${suffix}`)
}

function preferredHelpSetupCommand(command = 'quickstart') {
  const suffix = process.stdin.isTTY ? '' : ' --no-tui'
  const invocation = detectCliInvocation()
  if (invocation.kind === 'source') {
    return `idlewatch ${command}${suffix}`
  }
  return inferCliCommand(`${command}${suffix}`)
}

function preferredRecoveryCommand(command = 'configure') {
  const suffix = process.stdin.isTTY ? '' : ' --no-tui'
  const invocation = detectCliInvocation()
  if (invocation.kind === 'source') {
    return `idlewatch ${command}${suffix}`
  }
  return inferCliCommand(`${command}${suffix}`)
}

function preferredProductCommand(command = '') {
  const invocation = detectCliInvocation()
  if (invocation.kind === 'source') {
    return command ? `idlewatch ${command}` : 'idlewatch'
  }
  return inferCliCommand(command)
}

function levenshteinDistance(a = '', b = '') {
  const left = String(a)
  const right = String(b)
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length

  const prev = Array.from({ length: right.length + 1 }, (_, index) => index)
  const curr = new Array(right.length + 1)

  for (let i = 0; i < left.length; i += 1) {
    curr[0] = i + 1
    for (let j = 0; j < right.length; j += 1) {
      const cost = left[i] === right[j] ? 0 : 1
      curr[j + 1] = Math.min(
        curr[j] + 1,
        prev[j + 1] + 1,
        prev[j] + cost
      )
    }
    for (let j = 0; j < curr.length; j += 1) prev[j] = curr[j]
  }

  return prev[right.length]
}

function suggestKnownSubcommand(value, knownSubcommands) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null

  let best = null
  for (const candidate of knownSubcommands) {
    const lowered = String(candidate).toLowerCase()
    const startsNear = lowered.startsWith(normalized) || normalized.startsWith(lowered)
    const distance = levenshteinDistance(normalized, lowered)
    if (startsNear || distance <= 3) {
      if (!best || distance < best.distance) {
        best = { candidate, distance }
      }
    }
  }

  return best?.candidate || null
}

function launchAgentInfo() {
  const svcLabel = 'com.idlewatch.agent'
  const uid = process.getuid?.() ?? ''
  const domainTarget = `gui/${uid}/${svcLabel}`
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${svcLabel}.plist`)
  return {
    svcLabel,
    uid,
    domain: `gui/${uid}`,
    domainTarget,
    plistPath,
    ownedByCurrentHome: fs.existsSync(plistPath)
  }
}

function probeOwnedLaunchAgentState() {
  if (process.platform !== 'darwin') {
    return { supported: false, ownedByCurrentHome: false, state: 'unsupported', pid: null }
  }

  const info = launchAgentInfo()
  if (!info.ownedByCurrentHome) {
    return { supported: true, ...info, state: 'not-installed', pid: null }
  }

  const probe = spawnSync('launchctl', ['print', info.domainTarget], { timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] })
  if (probe.status !== 0) {
    return { supported: true, ...info, state: 'installed-not-loaded', pid: null }
  }

  const out = String(probe.stdout || '')
  const pidMatch = out.match(/^\s*pid\s*=\s*(\d+)/m)
  return {
    supported: true,
    ...info,
    state: pidMatch ? 'running' : 'loaded',
    pid: pidMatch ? pidMatch[1] : null
  }
}

function launchctlResult(args, options = {}) {
  return spawnSync('launchctl', args, { stdio: 'pipe', ...options })
}

function launchctlOutput(result) {
  const output = [
    result?.error?.message ? String(result.error.message).trim() : '',
    String(result?.stderr || '').trim(),
    String(result?.stdout || '').trim()
  ].filter(Boolean).join('\n').trim()

  if (output) return output
  if (typeof result?.status === 'number') return `launchctl exited with status ${result.status}`
  if (result?.signal) return `launchctl terminated by signal ${result.signal}`
  return ''
}

function backgroundInstallCommandForInvocation(invocation = detectCliInvocation()) {
  if (invocation.kind === 'npx' || invocation.kind === 'source') {
    return 'idlewatch install-agent'
  }
  return inferCliCommand('install-agent')
}

function backgroundInstallHelpCommand(invocation = detectCliInvocation()) {
  if (invocation.kind === 'source' || invocation.kind === 'npx') {
    return 'idlewatch install-agent'
  }
  return inferCliCommand('install-agent')
}

function resolveDurableLaunchAgentProgramArguments() {
  const sourceScriptPath = path.resolve(process.argv[1] || '')
  const pathEntries = String(process.env.PATH || '')
    .split(path.delimiter)
    .map(entry => entry.trim())
    .filter(Boolean)

  for (const entry of pathEntries) {
    const candidate = path.join(entry, 'idlewatch')
    try {
      accessSync(candidate, constants.X_OK)
    } catch {
      continue
    }

    const resolvedCandidate = fs.realpathSync.native?.(candidate) || fs.realpathSync(candidate)
    if (!resolvedCandidate) continue
    if (sourceScriptPath && resolvedCandidate === sourceScriptPath) continue
    if (sourceScriptPath && resolvedCandidate.startsWith(path.dirname(sourceScriptPath) + path.sep)) continue
    if (resolvedCandidate.includes(`${path.sep}.npm${path.sep}_npx${path.sep}`)) continue

    return { programArguments: [candidate, 'run'], targetKind: 'durable-cli' }
  }

  return { programArguments: [process.execPath, process.argv[1], 'run'], targetKind: 'source-script' }
}

function slugifyVisibleDeviceName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function deviceIdentityPreservedAcrossRename(deviceName, deviceId) {
  return Boolean(deviceId) && deviceId !== slugifyVisibleDeviceName(deviceName)
}

function installAgentHelpText() {
  const invocation = detectCliInvocation()
  const installAgentHelpCommand = preferredProductCommand('install-agent')
  const quickstartCommand = preferredHelpSetupCommand('quickstart')

  if (invocation.kind === 'npx') {
    return `Background mode needs a durable install.

Install once: npm install -g idlewatch
If setup isn't saved yet: idlewatch quickstart --no-tui
Turn on background mode: idlewatch install-agent`
  }

  return `${installAgentHelpCommand} — Enable background mode (macOS)

Usage:  ${installAgentHelpCommand}

Enables background mode on macOS.
If setup is already saved, background mode starts right away.
If not, finish setup with ${quickstartCommand}, then run ${installAgentHelpCommand}.`
}

function printSetupNextSteps({ isReconfigure, launchAgentState }) {
  const invocation = detectCliInvocation()
  const installAgentCommand = preferredProductCommand('install-agent')
  const backgroundInstallCommand = invocation.kind === 'npx'
    ? backgroundInstallCommandForInvocation(invocation)
    : preferredProductCommand('install-agent')
  const runCommand = invocation.kind === 'npx'
    ? inferCliCommand('run')
    : preferredProductCommand('run')
  const backgroundAgentRunning = launchAgentState?.state === 'running' || launchAgentState?.state === 'loaded'
  const backgroundAgentInstalledNeedsRefresh = launchAgentState?.state === 'installed-not-loaded'

  if (isReconfigure && backgroundAgentRunning) {
    console.log('\n   Background mode: already running')
    if (invocation.kind === 'npx') {
      console.log(`   Apply changes:    re-run ${backgroundInstallCommand} to apply the saved config`)
      console.log('   This npx run updated the saved config only.')
    } else {
      console.log(`   Apply changes:    re-run ${backgroundInstallCommand} to apply the saved config`)
    }
    console.log(`   Or run now:       ${runCommand}   Run in foreground`)
    return
  }

  if (backgroundAgentInstalledNeedsRefresh) {
    console.log('\n   Background mode is installed and not running yet.')
    console.log(`   Start:    ${backgroundInstallCommand}`)
    console.log(`   It stays off until you run ${backgroundInstallCommand}.`)
    console.log('   It will use the saved config.')
    if (invocation.kind === 'npx') {
      console.log('   This npx run saved the config, but background mode still uses the durable install.')
    }
    console.log('\n   Use it now:')
    console.log(`     ${runCommand}   Run in foreground`)
    return
  }

  if (invocation.kind === 'npx') {
    if (!backgroundAgentRunning) {
      console.log('\n   Background mode is not on yet.')
    }
    console.log('\n   Use it now:')
    console.log(`     ${runCommand}   Run in foreground`)
    console.log('\n   For background mode:')
    console.log('     Install once: npm install -g idlewatch')
    console.log('     Turn on background mode: idlewatch install-agent')
    return
  }

  if (!backgroundAgentRunning) {
    console.log('\n   Background mode is not on yet.')
  }

  console.log('\n   Use it now:')
  console.log(`     ${runCommand}   Run in foreground`)
  console.log('\n   For background mode:')
  console.log(`     ${installAgentCommand}   Turn on background mode`)
}

function bootstrapLaunchAgentWithRetry({ domain, domainTarget, plistPath, alreadyLoaded }) {
  const first = launchctlResult(['bootstrap', domain, plistPath])
  if (first.status === 0 || !alreadyLoaded) return first

  let last = first
  for (const delaySeconds of ['0.15', '0.3', '0.5', '0.75', '1']) {
    const output = launchctlOutput(last)
    const looksLikeStillTearingDown = /bootstrap failed:\s*5\b|input\/output error/i.test(output)
    if (!looksLikeStillTearingDown) return last

    const probe = launchctlResult(['print', domainTarget])
    if (probe.status === 0) return probe

    spawnSync('/bin/sleep', [delaySeconds], { stdio: 'ignore' })
    last = launchctlResult(['bootstrap', domain, plistPath])
    if (last.status === 0) return last
  }

  return last
}

function printHelp() {
  const invocation = detectCliInvocation()
  const cliBase = preferredProductCommand()
  const installAgentSummary = invocation.kind === 'npx'
    ? 'Enable background mode (requires durable install)'
    : 'Enable background mode (macOS)'
  const commands = [
    ['quickstart', 'Set up this device (name, metrics, optional cloud link)'],
    ['configure', 'Update setup (name, metrics, optional cloud link)'],
    ['status', 'Show device config and background mode state'],
    ['run', 'Run the collector in the foreground'],
    ['create', 'Manage custom telemetry metrics'],
    ['dashboard', 'Launch local telemetry dashboard'],
    ['install-agent', installAgentSummary],
    ['uninstall-agent', 'Disable background mode (macOS)'],
    ['menubar', 'Install the macOS menu bar app'],
    ['version', 'Show version']
  ]
  const commandWidth = Math.max(...commands.map(([name]) => name.length))
  const commandLines = commands
    .map(([name, summary]) => `  ${name.padEnd(commandWidth)}   ${summary}`)
    .join('\n')
  console.log(`${cliBase}

Usage:  ${cliBase} <command> [options]

Commands:
${commandLines}

Options:
  --once, --test-publish  Collect one sample, then exit
  --dry-run               Collect and print one sample without publishing
  --json                  Output raw JSON instead of summary (with --once/--dry-run)
  --help                  Show this help
  --help-env              Show all environment variables

Get started:  ${preferredHelpSetupCommand('quickstart')}`)
}

function printHelpEnv() {
  console.log(`idlewatch — environment variables

Most users only need the Common section below.

Common:
  IDLEWATCH_CLOUD_API_KEY              API key from idlewatch.com/api
  IDLEWATCH_CLOUD_INGEST_URL           Ingest endpoint (default: https://api.idlewatch.com/api/ingest)
  IDLEWATCH_LOCAL_LOG_PATH             NDJSON file for local sample durability
  IDLEWATCH_LOCAL_LOG_MAX_MB           Max log size before rotation (default: 10)
  IDLEWATCH_DASHBOARD_PORT             Local dashboard port (default: 4373)
  IDLEWATCH_OPENCLAW_USAGE             OpenClaw usage mode: auto|off (default: auto)
  IDLEWATCH_REQUIRE_CLOUD_WRITES       Require cloud publish in --once mode: 1|0 (default: 0)
  IDLEWATCH_CUSTOM_METRICS_FILE        Custom metrics JSON path (default: ~/.idlewatch/custom-metrics.json)

Tuning:
  IDLEWATCH_HOST                       Custom host label (default: hostname)
  IDLEWATCH_INTERVAL_MS                Sampling interval in ms (default: 10000)
  IDLEWATCH_PROVIDER_QUOTA_INTERVAL_MS Provider quota refresh interval (default: 900000)
  IDLEWATCH_PROVIDER_QUOTA_TIMEOUT_MS  Provider quota probe timeout (default: 4000)
  IDLEWATCH_PUBLISH_TIMEOUT_MS         Cloud publish HTTP timeout (default: 10000)

  ─────────────────────────────────────────────────────────
Probe internals (rarely needed — most users can ignore these):
  IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS  OpenClaw probe timeout (default: 2500)
  IDLEWATCH_OPENCLAW_PROBE_RETRIES     Extra probe retries (default: 1)
  IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES  Max probe output capture (default: 2MB)
  IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES_HARD_CAP  Hard cap for output escalation (default: 16MB)
  IDLEWATCH_USAGE_STALE_MS             Usage stale threshold (default: max(interval*3,60000))
  IDLEWATCH_USAGE_NEAR_STALE_MS        Near-stale threshold
  IDLEWATCH_USAGE_STALE_GRACE_MS       Grace window before stale (default: min(interval,10000))
  IDLEWATCH_USAGE_REFRESH_REPROBES     Stale-threshold reprobes (default: 1)
  IDLEWATCH_USAGE_REFRESH_DELAY_MS     Reprobe delay (default: 250)
  IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE  Refresh on near-stale: 1|0 (default: 1)
  IDLEWATCH_USAGE_IDLE_AFTER_MS        Downgrade stale to idle after (default: 21600000)
  IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS  Reuse last good snapshot up to this age
  IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH  Last good snapshot path

Firebase / emulator:
  IDLEWATCH_REQUIRE_FIREBASE_WRITES    Require Firebase in --once: 1|0 (default: 0)
  FIREBASE_PROJECT_ID                  Firebase project id
  FIREBASE_SERVICE_ACCOUNT_FILE        Service account JSON path
  FIREBASE_SERVICE_ACCOUNT_JSON        Raw service account JSON
  FIREBASE_SERVICE_ACCOUNT_B64         Base64-encoded service account
  FIRESTORE_EMULATOR_HOST              Firestore emulator host`)
}

const require = createRequire(import.meta.url)

function parseEnvValue(rawValue) {
  const value = String(rawValue || '').trim()
  if (!value) return ''

  const quotedWithCommentMatch = value.match(/^(['"])([\s\S]*)\1(?:\s+#.*)?$/)
  if (quotedWithCommentMatch) {
    return quotedWithCommentMatch[2]
  }

  const inlineCommentIndex = value.search(/\s+#/)
  if (inlineCommentIndex >= 0) {
    return value.slice(0, inlineCommentIndex).trim()
  }

  return value
}

function normalizeEnvKey(rawKey) {
  const key = String(rawKey || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^export\s+/, '')
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : ''
}

function parseEnvFileToObject(envFilePath) {
  const raw = fs.readFileSync(envFilePath, 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = normalizeEnvKey(trimmed.slice(0, idx))
    const value = parseEnvValue(trimmed.slice(idx + 1))
    if (key) env[key] = value
  }
  return env
}

function expandSupportedPathVars(value) {
  if (typeof value !== 'string' || !value) return value

  const home = process.env.HOME || os.homedir()
  const tmpdir = process.env.TMPDIR || os.tmpdir()
  const makeShellVarPattern = (name) => new RegExp(`\\$\\{${name}\\}|\\$${name}`, 'g')

  return value
    .replace(/^~(?=$|\/)/, home)
    .replace(makeShellVarPattern('HOME'), home)
    .replace(makeShellVarPattern('TMPDIR'), tmpdir)
}

function resolveEnvPath(value) {
  return path.resolve(expandSupportedPathVars(value))
}

function idlewatchDataDir() {
  return path.join(os.homedir(), '.idlewatch')
}

function defaultPersistedEnvFilePath() {
  const configured = String(process.env.IDLEWATCH_CONFIG_ENV_PATH || '').trim()
  return configured ? resolveEnvPath(configured) : path.join(idlewatchDataDir(), 'idlewatch.env')
}

function formatPathForHelp(value) {
  const resolved = resolveEnvPath(value)
  const home = path.resolve(process.env.HOME || os.homedir())
  if (resolved === home) return '~'
  if (resolved.startsWith(home + path.sep)) {
    return `~/${path.relative(home, resolved)}`
  }
  return resolved
}

function usesDefaultPersistedEnvFile(envFilePath) {
  if (!envFilePath) return false
  return path.resolve(envFilePath) === path.resolve(defaultPersistedEnvFilePath())
}

function resolveCustomMetricsFilePath() {
  const configured = String(process.env.IDLEWATCH_CUSTOM_METRICS_FILE || '').trim()
  return configured ? resolveEnvPath(configured) : defaultCustomMetricsFile()
}

async function runCustomMetricWizard() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('custom_metric_wizard_requires_tty')
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const metricsFile = resolveCustomMetricsFilePath()
  const existing = loadCustomMetricDefinitions(metricsFile)

  try {
    console.log('\nIdleWatch custom telemetry')
    console.log(`Config file: ${metricsFile}`)

    // If metrics exist, offer a menu: create / edit / delete
    if (existing.length > 0) {
      console.log(`\nExisting metrics:`)
      existing.forEach((m, i) => console.log(`  ${i + 1}. ${m.label} (${m.key}) — ${m.command}`))

      const action = (await rl.question('\nAction — 1) Create new  2) Edit existing  3) Delete [1]: ')).trim()

      if (action === '2') {
        // Edit flow
        const which = existing.length === 1
          ? '1'
          : (await rl.question(`Which metric to edit? [1-${existing.length}]: `)).trim()
        const idx = Math.max(0, Math.min(existing.length - 1, (parseInt(which, 10) || 1) - 1))
        const target = existing[idx]

        console.log(`\nEditing "${target.label}" — press Enter to keep current value.`)
        const label = (await rl.question(`Name [${target.label}]: `)).trim() || target.label
        const kindInput = (await rl.question(`Type [${target.kind}]: `)).trim().toLowerCase()
        const command = (await rl.question(`Command [${target.command}]: `)).trim() || target.command

        const kind = ['number', 'currency', 'percent'].includes(kindInput) ? kindInput : target.kind
        let currency = target.currency || ''
        let suffix = target.suffix || ''
        if (kind === 'currency') {
          currency = ((await rl.question(`Currency code [${currency || 'USD'}]: `)).trim() || currency || 'USD').toUpperCase()
          suffix = ''
        } else if (kind === 'number') {
          suffix = (await rl.question(`Suffix [${suffix || 'empty'}]: `)).trim()
          if (suffix === 'empty') suffix = ''
          currency = ''
        } else {
          currency = ''
          suffix = ''
        }

        const definition = normalizeCustomMetricDefinition({ label, key: target.key, kind, command, currency, suffix })
        if (!definition) throw new Error('custom_metric_invalid_definition')

        const next = existing.map((m) => m.key === target.key ? definition : m)
        saveCustomMetricDefinitions(next, metricsFile)
        console.log(`\nUpdated ${definition.label}.`)
        return
      }

      if (action === '3') {
        // Delete flow
        const which = existing.length === 1
          ? '1'
          : (await rl.question(`Which metric to delete? [1-${existing.length}]: `)).trim()
        const idx = Math.max(0, Math.min(existing.length - 1, (parseInt(which, 10) || 1) - 1))
        const target = existing[idx]

        const confirm = (await rl.question(`Delete "${target.label}"? [y/N]: `)).trim().toLowerCase()
        if (confirm !== 'y' && confirm !== 'yes') {
          console.log('Cancelled.')
          return
        }

        const next = existing.filter((m) => m.key !== target.key)
        saveCustomMetricDefinitions(next, metricsFile)
        console.log(`\nDeleted ${target.label}. ${next.length} metric${next.length !== 1 ? 's' : ''} remaining.`)
        return
      }

      // action === '1' or default: fall through to create
    }

    // Create flow
    const label = (await rl.question('Name: ')).trim() || 'Custom metric'
    const keyInput = (await rl.question(`Key [${slugifyMetricKey(label)}]: `)).trim()
    const kindInput = (await rl.question('Type [number/currency/percent] (default number): ')).trim().toLowerCase()
    const command = (await rl.question('Command to run each sample: ')).trim()

    if (!command) throw new Error('custom_metric_command_required')

    let currency = ''
    let suffix = ''
    const kind = ['currency', 'percent'].includes(kindInput) ? kindInput : 'number'
    if (kind === 'currency') {
      currency = ((await rl.question('Currency code [USD]: ')).trim() || 'USD').toUpperCase()
    } else if (kind === 'number') {
      suffix = (await rl.question('Optional suffix [empty]: ')).trim()
    }

    const definition = normalizeCustomMetricDefinition({
      label,
      key: keyInput || slugifyMetricKey(label),
      kind,
      command,
      currency,
      suffix
    })

    if (!definition) throw new Error('custom_metric_invalid_definition')

    const next = [...existing.filter((item) => item.key !== definition.key), definition]
    saveCustomMetricDefinitions(next, metricsFile)

    console.log(`\nSaved ${definition.label}.`)
    console.log(`IdleWatch will track it on the next sample and surface it in the dashboard.`)
  } finally {
    rl.close()
  }
}

function loadPersistedEnvIntoProcess() {
  const envFile = defaultPersistedEnvFilePath()
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

  nextEnv.IDLEWATCH_SETUP_VERIFY = '1'
  return nextEnv
}

const persistedEnv = loadPersistedEnvIntoProcess()

const OPENCLAW_AGENT_TARGETS = ['agent_activity', 'token_usage', 'runtime_state']
const PROVIDER_TARGETS = ['provider_quota']
const OPENCLAW_DERIVED_TARGETS = [...OPENCLAW_AGENT_TARGETS]

function parseMonitorTargets(raw) {
  const allowed = new Set(['cpu', 'memory', 'gpu', 'temperature', 'openclaw', ...OPENCLAW_DERIVED_TARGETS, ...PROVIDER_TARGETS])
  const fallback = ['cpu', 'memory', 'gpu', 'temperature', ...OPENCLAW_DERIVED_TARGETS]

  if (!raw || typeof raw !== 'string') {
    return new Set(fallback)
  }

  const parsed = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => allowed.has(item))
    .flatMap((item) => (item === 'openclaw' ? OPENCLAW_DERIVED_TARGETS : [item]))

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

function formatProviderQuotaSummaryLine(providerQuota) {
  const providerName = String(providerQuota?.providerName || providerQuota?.providerId || 'Provider').trim()
  const windows = Array.isArray(providerQuota?.windows) ? providerQuota.windows : []
  const windowBits = windows
    .slice(0, 2)
    .map((window) => {
      const label = String(window?.label || window?.key || 'window').trim()
      const remaining = Number(window?.remainingPercent)
      const resetAtMs = Number(window?.resetsAtMs)
      const remainingLabel = Number.isFinite(remaining) ? `${Math.round(remaining)}% left` : 'usage signal'
      const resetLabel = Number.isFinite(resetAtMs) && resetAtMs > 0
        ? new Date(resetAtMs).toLocaleString()
        : 'reset unknown'
      return `${label} ${remainingLabel} • ${resetLabel}`
    })
    .join(' | ')

  const accountBits = [providerQuota?.accountPlan, providerQuota?.accountEmail].filter(Boolean).join(' • ')
  return [providerName, accountBits, windowBits].filter(Boolean).join(' — ')
}

function formatProviderConnectionSummaryLine(providerConnection) {
  const providerName = String(providerConnection?.providerName || providerConnection?.providerId || 'Provider').trim()
  const status = String(providerConnection?.status || 'needs_login').trim().replace(/_/g, ' ')
  const accountBits = [providerConnection?.accountPlan, providerConnection?.accountEmail].filter(Boolean).join(' • ')
  const detail = String(providerConnection?.detail || '').trim()
  return [providerName, status, accountBits, detail].filter(Boolean).join(' — ')
}

function resolvePersistedLocalLogPath() {
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

  return null
}

function printUninstallRetentionSummary({ envFile, dataDir, localLogPath, assumeExisting = true }) {
  const defaultLogDir = path.join(dataDir, 'logs')
  const hasSavedConfig = fs.existsSync(envFile)
  const hasKnownLocalLog = Boolean(localLogPath)
  const hasExistingLogTarget = hasKnownLocalLog
    ? fs.existsSync(localLogPath) || fs.existsSync(path.dirname(localLogPath))
    : fs.existsSync(defaultLogDir)

  if (assumeExisting || hasSavedConfig) {
    console.log(`   Saved config stays at ${envFile}`)
  } else {
    console.log(`   Saved config would live at ${envFile}`)
  }

  if (hasKnownLocalLog) {
    if (assumeExisting || hasExistingLogTarget) {
      console.log(`   Local log stays at ${localLogPath}`)
    } else {
      console.log(`   Local log would be written at ${localLogPath}`)
    }
    return
  }

  if (assumeExisting || hasExistingLogTarget) {
    console.log(`   Local logs stay in ${defaultLogDir}`)
  } else {
    console.log(`   Local logs would go in ${defaultLogDir}`)
  }
}

function resolveDashboardLogPath(host) {
  const persistedLogPath = resolvePersistedLocalLogPath()
  if (persistedLogPath) {
    return persistedLogPath
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

function safeParsePersistedEnvFile() {
  const envFile = defaultPersistedEnvFilePath()
  if (!fs.existsSync(envFile)) {
    return { envFile, parsed: {} }
  }

  try {
    return { envFile, parsed: parseEnvFileToObject(envFile) }
  } catch {
    return { envFile, parsed: {} }
  }
}

function buildStatusPayload() {
  const { parsed } = safeParsePersistedEnvFile()
  const metricsEnabled = String(parsed.IDLEWATCH_MONITOR_TARGETS || parsed.IDLEWATCH_METRICS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    deviceName: String(parsed.IDLEWATCH_DEVICE_NAME || os.hostname()).trim(),
    linkStatus: String(parsed.IDLEWATCH_CLOUD_API_KEY ? 'linked' : 'pending'),
    metricsEnabled,
    lastPublishResult: {
      status: parsed.IDLEWATCH_LAST_GOOD_STATUS || 'unknown',
      message: parsed.IDLEWATCH_LAST_GOOD_MESSAGE || 'no recent sample found'
    }
  }
}

function buildLastPublishPayload() {
  const { parsed } = safeParsePersistedEnvFile()

  return {
    lastPublishStatus: parsed.IDLEWATCH_LAST_GOOD_STATUS || 'unknown',
    lastPublishMessage: parsed.IDLEWATCH_LAST_GOOD_MESSAGE || ''
  }
}

function buildRollingLoadSummary(logPath, nowMs = Date.now(), windowMs = DAY_WINDOW_MS) {
  const rows = parseLocalRows(logPath, 20000).filter((row) => Number(row.ts || 0) >= nowMs - windowMs)
  if (rows.length === 0) return null

  const average = (values) => {
    const valid = values.filter((value) => Number.isFinite(value))
    if (valid.length === 0) return null
    return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2))
  }

  const maximum = (values) => {
    const valid = values.filter((value) => Number.isFinite(value))
    if (valid.length === 0) return null
    return Number(Math.max(...valid).toFixed(1))
  }

  return {
    windowMs,
    sampleCount: rows.length,
    cpuAvgPct: average(rows.map((row) => Number(row.cpuPct))),
    memAvgPct: average(rows.map((row) => Number(row.memPct))),
    gpuAvgPct: average(rows.map((row) => Number(row.gpuPct))),
    tempAvgC: average(rows.map((row) => Number(row.deviceTempC))),
    tempMaxC: maximum(rows.map((row) => Number(row.deviceTempC))),
    tokensAvgPerMin: average(rows.map((row) => Number(row.tokensPerMin)))
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

// eslint-disable-next-line no-top-level-await - TUI flow needs async but runs in event loop context
const argv = process.argv.slice(2)
const args = new Set(argv)
const statusRequested = argv[0] === 'status' || argv.includes('--status')
const dashboardRequested = argv[0] === 'dashboard' || argv.includes('--dashboard')
const runRequested = argv[0] === 'run' || argv.includes('--run')
const createRequested = argv[0] === 'create' || argv.includes('--create')
const menubarRequested = argv[0] === 'menubar'
const installAgentRequested = argv[0] === 'install-agent'
const uninstallAgentRequested = argv[0] === 'uninstall-agent'
const versionRequested = args.has('--version') || args.has('-V')
const interactiveDefaultRequested = argv.length === 0 && process.stdin.isTTY && process.stdout.isTTY
const quickstartRequested = argv[0] === 'quickstart' || argv[0] === 'configure' || argv[0] === 'reconfigure' || argv.includes('--quickstart') || argv.includes('--configure') || (interactiveDefaultRequested && !dashboardRequested && !runRequested && !statusRequested && !createRequested && !menubarRequested)
const subcommandOnlyRequested = quickstartRequested || createRequested || dashboardRequested || menubarRequested || installAgentRequested || uninstallAgentRequested

// No args + non-TTY: print help instead of silently doing nothing
if (argv.length === 0 && (!process.stdin.isTTY || !process.stdout.isTTY) && !statusRequested && !runRequested && !dashboardRequested) {
  printHelp()
  process.exit(0)
}

if (args.has('--version') || args.has('-V') || argv[0] === 'version') {
  console.log(`idlewatch ${pkg.version}`)
  process.exit(0)
}

if (args.has('--help-env')) {
  printHelpEnv()
  process.exit(0)
}
if (args.has('--help') || args.has('-h')) {
  const subCmd = argv.find(a => !a.startsWith('-'))
  const quickstartCommand = preferredProductCommand('quickstart')
  const quickstartUsageCommand = preferredHelpSetupCommand('quickstart')
  const quickstartUsage = process.stdin.isTTY ? `${quickstartUsageCommand} [--no-tui]` : quickstartUsageCommand
  const quickstartPromptHint = process.stdin.isTTY
    ? 'Use --no-tui for simple prompts.'
    : 'Uses simple prompts. Set IDLEWATCH_ENROLL_* env vars first.'
  const configureCommand = preferredProductCommand('configure')
  const configureUsageCommand = preferredHelpSetupCommand('configure')
  const configureUsage = process.stdin.isTTY ? `${configureUsageCommand} [--no-tui]` : configureUsageCommand
  const configurePromptHint = process.stdin.isTTY
    ? 'Use --no-tui for simple prompts.'
    : 'Uses simple prompts. Set IDLEWATCH_ENROLL_* env vars first.'
  const statusCommand = preferredProductCommand('status')
  const statusUsageCommand = preferredProductCommand('status')
  const createCommand = preferredProductCommand('create')
  const installAgentCommand = inferCliCommand('install-agent')
  const backgroundInstallCommand = backgroundInstallHelpCommand()
  const uninstallAgentCommand = inferCliCommand('uninstall-agent')
  const menubarCommand = preferredProductCommand('menubar')
  const reconfigureCommand = preferredProductCommand('reconfigure')
  const reconfigureUsageCommand = preferredHelpSetupCommand('reconfigure')
  const reconfigureUsage = process.stdin.isTTY ? `${reconfigureUsageCommand} [--no-tui]` : reconfigureUsageCommand
  const dashboardCommand = preferredProductCommand('dashboard')
  const runCommand = preferredProductCommand('run')
  const subHelp = {
    quickstart: `${quickstartCommand} — Set up this device

Usage:  ${quickstartUsage}

Walks you through device name, metrics, and an optional cloud link.
${quickstartPromptHint}`,
    configure: `${configureCommand} — Update setup

Usage:  ${configureUsage}

Updates device name, metrics, and your optional cloud link.
Existing values are pre-filled so you only change what you need.
${configurePromptHint}
Saved changes apply on the next start.
If background mode is already on, re-run ${backgroundInstallCommand} to apply the saved config.`,
    status: `${statusCommand} — Show device config and background mode state

Usage:  ${statusUsageCommand}

Displays device config, publish mode, enabled metrics, last sample age,
and background mode state.
Config changes saved by quickstart or configure apply on the next start.
If background mode is already on, re-run ${backgroundInstallCommand} to apply the saved config.`,
    create: `${createCommand} — Manage custom telemetry metrics

Usage:  ${createCommand}

Interactive wizard to create, edit, or delete custom metrics.
Each metric has a name, type, and shell command that runs each cycle.`,
    'install-agent': installAgentHelpText(),
    'uninstall-agent': `${preferredProductCommand('uninstall-agent')} — Disable background mode (macOS)

Usage:  ${preferredProductCommand('uninstall-agent')}

Disables background mode on macOS.
Saved config stays at ${formatPathForHelp(defaultPersistedEnvFilePath())} when setup has been saved.
Local logs stay in ~/.idlewatch/logs when local logging is on, so you can re-enable background mode later.
Turn it back on later with idlewatch install-agent.`,
    menubar: `${menubarCommand} — Install macOS menu bar app

Usage:  ${menubarCommand} [--launch] [--force]

Installs the macOS menu bar companion app.
  --launch   Open the app immediately after install
  --force    Reinstall even if already installed`,
    reconfigure: `${reconfigureCommand} — Update setup (alias for configure)

Usage:  ${reconfigureUsage}

Updates device name, metrics, and your optional cloud link.
Existing values are pre-filled so you only change what you need.
${configurePromptHint}
Saved changes apply on the next start.
If background mode is already on, re-run ${backgroundInstallCommand} to apply the saved config.`,
    dashboard: `${dashboardCommand} — Launch local telemetry dashboard

Usage:  ${dashboardCommand}

Starts a local web server showing recent telemetry samples.`,
    run: `${runCommand} — Run the collector in the foreground

Usage:  ${runCommand}

Begins continuous metric collection in the foreground at the configured interval.
Use --once for a single sample or --dry-run to preview without publishing.`
  }
  if (subCmd && subHelp[subCmd]) {
    console.log(subHelp[subCmd])
  } else {
    printHelp()
  }
  process.exit(0)
}

const subcommandPromise = (async () => {
  if (menubarRequested) {
    if (process.platform !== 'darwin') {
      console.error('IdleWatch menubar is only available on macOS.')
      process.exit(1)
    }

    try {
      const forceMenubar = args.has('--force')
      const menubarAppDir = path.join(os.homedir(), 'Applications', 'IdleWatch.app')
      if (!forceMenubar && fs.existsSync(menubarAppDir)) {
        console.log(`IdleWatch menu bar app already installed at ${menubarAppDir}`)
        console.log('Use idlewatch menubar --force to reinstall.')
        if (args.has('--launch')) {
          spawnSync('/usr/bin/open', ['-gj', menubarAppDir], { stdio: 'ignore' })
        }
        process.exit(0)
      }
      const installed = installMenubarApp({ force: true, launch: args.has('--launch') })
      if (!installed) {
        console.error('IdleWatch menubar install skipped.')
        process.exit(1)
      }
      process.exit(0)
    } catch (error) {
      console.error(`IdleWatch menubar install failed: ${error.message}`)
      process.exit(1)
    }
  }

  if (installAgentRequested) {
    if (process.platform !== 'darwin') {
      console.error('Background mode is only available on macOS.')
      process.exit(1)
    }

    const invocation = detectCliInvocation()
    if (invocation.kind === 'npx') {
      console.error('Background mode needs a durable install.')
      console.error('')
      console.error('Install once:              npm install -g idlewatch')
      console.error('Turn on background mode:  idlewatch install-agent')
      console.error('')
      console.error(`Run now:       ${inferCliCommand('run')}`)
      process.exit(1)
    }

    const { svcLabel, uid, domain, domainTarget, plistPath } = launchAgentInfo()
    const plistDir = path.dirname(plistPath)
    const envFile = defaultPersistedEnvFilePath()

    const hasSavedConfig = fs.existsSync(envFile)
    const quickstartCommand = preferredSetupCommand('quickstart')
    const installAgentCommand = preferredProductCommand('install-agent')
    const statusCommand = preferredProductCommand('status')
    const runCommand = preferredProductCommand('run')
    const uninstallAgentCommand = preferredProductCommand('uninstall-agent')

    const { programArguments, targetKind } = resolveDurableLaunchAgentProgramArguments()

    const shouldStartImmediately = hasSavedConfig
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(svcLabel)}</string>
  <key>ProgramArguments</key>
  <array>
${programArguments.map(arg => `    <string>${escapeXml(arg)}</string>`).join('\n')}
  </array>
  <key>RunAtLoad</key>
  <${shouldStartImmediately ? 'true' : 'false'}/>
  <key>KeepAlive</key>
  <${shouldStartImmediately ? 'true' : 'false'}/>
  <key>StandardOutPath</key>
  <string>${escapeXml(path.join(os.homedir(), '.idlewatch', 'logs', 'agent-stdout.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(path.join(os.homedir(), '.idlewatch', 'logs', 'agent-stderr.log'))}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>`

    fs.mkdirSync(plistDir, { recursive: true })
    fs.mkdirSync(path.join(os.homedir(), '.idlewatch', 'logs'), { recursive: true })
    fs.writeFileSync(plistPath, plistContent, 'utf8')

    // LaunchAgents are per-user, not per-HOME. If another IdleWatch agent is already
    // loaded for this macOS user, replace it cleanly with this install.
    const alreadyLoaded = shouldStartImmediately && launchctlResult(['print', domainTarget]).status === 0
    if (alreadyLoaded) {
      launchctlResult(['bootout', domainTarget])
    }

    if (!shouldStartImmediately) {
      console.log('✅ Background mode installed.')
      console.log("   Setup isn't saved yet, so background mode stays off for now.")
      console.log(`   Save setup:   ${preferredHelpSetupCommand('quickstart')}`)
      console.log(`   Run now:      ${preferredProductCommand('run')}`)
      console.log(`   Turn on background mode:  ${preferredProductCommand('install-agent')}`)
      console.log(`   Config path:  ${envFile}`)
      console.log(`   Check:        ${preferredProductCommand('status')}`)
      console.log(`   Remove:       ${preferredProductCommand('uninstall-agent')}  (safe — only turns background mode off)`)
      if (targetKind === 'source-script') {
        console.log('   Background mode will refresh onto a durable idlewatch install automatically if one is available later.')
      }
      process.exit(0)
    }

    const load = bootstrapLaunchAgentWithRetry({ domain, domainTarget, plistPath, alreadyLoaded })
    if (load.status === 0) {
      launchctlResult(['enable', domainTarget])
      const launchAgentState = probeOwnedLaunchAgentState()
      const backgroundAgentRunning = launchAgentState.state === 'running' || launchAgentState.state === 'loaded'

      if (backgroundAgentRunning) {
        console.log(`✅ Background mode ${alreadyLoaded ? 'refreshed' : 'installed'} — IdleWatch is running in the background.`)
        if (alreadyLoaded) {
          console.log('   Background mode is using the saved config.')
        }
      } else {
        console.log(`✅ Background mode ${alreadyLoaded ? 'refreshed' : 'installed'}.`)
        console.log('   Saved config is ready, but background mode is installed and not running yet.')
        console.log(`   Start:        ${installAgentCommand}`)
      }
      console.log(`   Saved config: ${envFile}`)
      console.log(`   Check:        ${statusCommand}`)
      console.log(`   Remove:       ${uninstallAgentCommand}  (safe — only turns background mode off)`)
      if (targetKind === 'source-script') {
        console.log('   Background mode will refresh onto a durable idlewatch install automatically if one is available later.')
      }
    } else {
      const installError = launchctlOutput(load) || 'unknown error'
      console.error('Background mode install failed.')
      if (alreadyLoaded && /bootstrap failed:\s*5\b|input\/output error/i.test(installError)) {
        console.error('IdleWatch turned background mode back on, but macOS did not finish applying the saved config in time.')
        console.error(`Please wait a moment, then run: ${installAgentCommand}`)
      } else {
        console.error(installError)
      }
      console.error(`Plist written to ${plistPath}. IdleWatch background install is shared per macOS user, so only one can be loaded at a time.`)
      process.exit(1)
    }
    process.exit(0)
  }

  if (uninstallAgentRequested) {
    if (process.platform !== 'darwin') {
      console.error('Background mode is only available on macOS.')
      process.exit(1)
    }
    const svcLabel = 'com.idlewatch.agent'
    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${svcLabel}.plist`)
    const uid = process.getuid?.() ?? ''
    const dataDir = idlewatchDataDir()
    const envFile = defaultPersistedEnvFilePath()

    if (!fs.existsSync(plistPath)) {
      const localLogPath = resolvePersistedLocalLogPath()
      console.log('Background mode is already off.')
      printUninstallRetentionSummary({ envFile, dataDir, localLogPath, assumeExisting: false })
      process.exit(0)
    }

    // Unload (stop the agent)
    spawnSync('launchctl', ['bootout', `gui/${uid}/${svcLabel}`], { stdio: 'ignore' })

    // Remove plist
    try {
      fs.unlinkSync(plistPath)
    } catch { /* ignore */ }

    const invocation = detectCliInvocation()
    const localLogPath = resolvePersistedLocalLogPath()
    console.log('✅ Background mode turned off.')
    printUninstallRetentionSummary({ envFile, dataDir, localLogPath })
    console.log(`   Turn it back on: ${backgroundInstallCommandForInvocation(invocation)}`)
    if (invocation.kind === 'npx') {
      console.log('   Background mode still belongs to the durable install, not this one-off npx run.')
    }
    process.exit(0)
  }

  if (dashboardRequested) {
    runLocalDashboard({ host: process.env.IDLEWATCH_HOST || os.hostname() })
    return
  }

  if (createRequested) {
    try {
      await runCustomMetricWizard()
      process.exit(0)
    } catch (error) {
      console.error(`Custom telemetry setup failed: ${error.message}`)
      process.exit(1)
    }
  }

  // eslint-disable-next-line no-top-level-await - TUI flow needs async but runs in event loop context
  if (quickstartRequested) {
    try {
      if (args.has('--no-tui') && !process.stdin.isTTY && !process.env.IDLEWATCH_ENROLL_NON_INTERACTIVE) {
        console.error('Setup cancelled. No changes saved.')
        process.exit(0)
      }

      const isReconfigure = argv[0] === 'configure' || argv[0] === 'reconfigure'
      const result = await runEnrollmentWizard({
        noTui: args.has('--no-tui'),
        preserveSavedDeviceId: isReconfigure
      })

      if (!result?.outputEnvFile || !fs.existsSync(result.outputEnvFile)) {
        throw new Error(`setup_did_not_write_env_file:${result?.outputEnvFile || 'unknown'}`)
      }

      const enrolledEnv = parseEnvFileToObject(result.outputEnvFile)
      const onceRun = spawnSync(process.execPath, [process.argv[1], '--once'], {
        stdio: 'inherit',
        env: buildSetupTestEnv(enrolledEnv)
      })

      if (onceRun.status === 0) {
        const modeLabel = result.mode === 'local' ? 'local-only' : 'cloud'
        const launchAgentState = probeOwnedLaunchAgentState()
        const setupHeadline = isReconfigure
          ? `\n✅ Settings saved for "${result.deviceName}".`
          : `\n✅ Setup complete for "${result.deviceName}".`
        console.log(setupHeadline)
        console.log(`   Mode:   ${modeLabel}`)
        console.log(`   Config: ${result.outputEnvFile}`)
        if (deviceIdentityPreservedAcrossRename(result.deviceName, result.deviceId)) {
          console.log(`   Device ID: ${result.deviceId} (kept from original setup for continuity)`)
        }
        if (result.temperatureHelper?.status === 'installed') {
          console.log(`   Temp:   auto-installed via ${result.temperatureHelper.installer}`)
        } else if (result.temperatureHelper?.status === 'available') {
          console.log(`   Temp:   ${result.temperatureHelper.helper}`)
        } else if (result.temperatureHelper?.status === 'failed') {
          console.log(`   Temp:   thermal state only (${result.temperatureHelper.reason})`)
        }
        if (result.mode === 'local') {
          console.log(`\n   ✓ Local telemetry verified.`)
        } else {
          console.log(`\n   ✓ First sample published to idlewatch.com.`)
          console.log(`   Your device should appear on the dashboard within a few seconds.`)
        }
        printSetupNextSteps({ isReconfigure, launchAgentState })
        process.exit(0)
      }

      console.error(`\n⚠️ Setup saved, but the test sample failed to publish.`)
      console.error(`   Device: ${result.deviceName}`)
      console.error(`   Config: ${result.outputEnvFile}`)
      console.error(`\n   Common fixes:`)
      console.error(`     • Check your API key is valid at idlewatch.com/api`)
      console.error(`     • Verify internet connectivity`)
      console.error(`\n   Retry:  ${inferCliCommand('--once')}`)
      console.error(`   Redo:   ${preferredSetupCommand(isReconfigure ? 'configure' : 'quickstart')}`)
      process.exit(onceRun.status ?? 1)
    } catch (err) {
      if (String(err?.message || '') === 'setup_cancelled') {
        console.error('Setup cancelled. No changes saved.')
        process.exit(0)
      } else if (String(err?.message || '').startsWith('setup_did_not_write_env_file:')) {
        const failedConfigPath = String(err.message).slice('setup_did_not_write_env_file:'.length) || 'the config file'
        console.error(`Enrollment failed: setup could not save config at ${failedConfigPath}.`)
      } else {
        console.error(`Enrollment failed: ${err.message}`)
      }
      process.exit(1)
    }
  }

  return subcommandOnlyRequested
})()

// Reject unknown subcommands before entering the collector path
const KNOWN_SUBCOMMANDS = new Set(['quickstart', 'configure', 'reconfigure', 'status', 'dashboard', 'run', 'create', 'menubar', 'install-agent', 'uninstall-agent', 'version'])
const firstPositional = argv.find(a => !a.startsWith('-'))
if (firstPositional && !KNOWN_SUBCOMMANDS.has(firstPositional)) {
  const suggestion = suggestKnownSubcommand(firstPositional, KNOWN_SUBCOMMANDS)
  const helpCommand = preferredProductCommand('--help')
  const suggestionLine = suggestion ? ` Did you mean "${suggestion}"?` : ''
  console.error(`Unknown command "${firstPositional}".${suggestionLine} Run ${helpCommand} for available commands.`)
  process.exit(1)
}

const DRY_RUN = args.has('--dry-run')
const ONCE = args.has('--once') || args.has('--test-publish')
const JSON_OUTPUT = args.has('--json')
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
const MONITOR_TEMPERATURE = MONITOR_TARGETS.has('temperature')
const MONITOR_AGENT_ACTIVITY = MONITOR_TARGETS.has('agent_activity')
const MONITOR_TOKEN_USAGE = MONITOR_TARGETS.has('token_usage')
const MONITOR_RUNTIME_STATE = MONITOR_TARGETS.has('runtime_state')
const MONITOR_PROVIDER_QUOTA = MONITOR_TARGETS.has('provider_quota')
const MONITOR_OPENCLAW_USAGE = MONITOR_TOKEN_USAGE || MONITOR_RUNTIME_STATE
const EFFECTIVE_OPENCLAW_MODE = MONITOR_OPENCLAW_USAGE ? OPENCLAW_USAGE_MODE : 'off'
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
const CUSTOM_METRICS_FILE = resolveCustomMetricsFilePath()
const CUSTOM_METRIC_DEFINITIONS = loadCustomMetricDefinitions(CUSTOM_METRICS_FILE)
const PROVIDER_QUOTA_INTERVAL_MS = process.env.IDLEWATCH_PROVIDER_QUOTA_INTERVAL_MS
  ? Number(process.env.IDLEWATCH_PROVIDER_QUOTA_INTERVAL_MS)
  : PROVIDER_QUOTA_DEFAULT_INTERVAL_MS
const PROVIDER_QUOTA_TIMEOUT_MS = process.env.IDLEWATCH_PROVIDER_QUOTA_TIMEOUT_MS
  ? Number(process.env.IDLEWATCH_PROVIDER_QUOTA_TIMEOUT_MS)
  : PROVIDER_QUOTA_DEFAULT_TIMEOUT_MS

const PUBLISH_TIMEOUT_MS = Number(process.env.IDLEWATCH_PUBLISH_TIMEOUT_MS || 10000)

const LOCAL_LOG_PATH = process.env.IDLEWATCH_LOCAL_LOG_PATH
  ? resolveEnvPath(process.env.IDLEWATCH_LOCAL_LOG_PATH)
  : path.join(BASE_DIR, 'logs', `${SAFE_HOST}-metrics.ndjson`)
const PROVIDER_QUOTA_CACHE_PATH = defaultProviderQuotaCacheFile(SAFE_HOST)

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

if (!Number.isFinite(PROVIDER_QUOTA_INTERVAL_MS) || PROVIDER_QUOTA_INTERVAL_MS <= 0) {
  console.error(`Invalid IDLEWATCH_PROVIDER_QUOTA_INTERVAL_MS: ${process.env.IDLEWATCH_PROVIDER_QUOTA_INTERVAL_MS}. Expected a positive number.`)
  process.exit(1)
}

if (!Number.isFinite(PROVIDER_QUOTA_TIMEOUT_MS) || PROVIDER_QUOTA_TIMEOUT_MS <= 0) {
  console.error(`Invalid IDLEWATCH_PROVIDER_QUOTA_TIMEOUT_MS: ${process.env.IDLEWATCH_PROVIDER_QUOTA_TIMEOUT_MS}. Expected a positive number.`)
  process.exit(1)
}

if (!Number.isFinite(OPENCLAW_PROBE_MAX_OUTPUT_BYTES) || OPENCLAW_PROBE_MAX_OUTPUT_BYTES <= 0) {
  console.error(
    `Invalid IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES: ${process.env.IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES}. Expected a positive number.`
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
const shouldWarnAboutMissingPublishConfig = !appReady && !hasCloudConfig && !DRY_RUN && !ONCE && !hasAnyFirebaseConfig && !subcommandOnlyRequested

function getPublishModeLabel() {
  if (hasCloudConfig) return 'cloud'
  if (appReady) return 'firebase'
  return 'local-only'
}

function isExpectedLocalOnlyMode() {
  return getPublishModeLabel() === 'local-only'
}

if (statusRequested) {
  const envFile = defaultPersistedEnvFilePath()
  const hasConfig = fs.existsSync(envFile)
  const publishMode = getPublishModeLabel()
  const printStatusField = (label, value) => {
    console.log(`  ${(label + ':').padEnd(19)}${value}`)
  }

  console.log('IdleWatch status')
  console.log('')
  if (!hasConfig) {
    printStatusField('Setup', 'not completed yet')
  }
  printStatusField(hasConfig ? 'Device' : 'Device preview', DEVICE_NAME)
  if (hasConfig && deviceIdentityPreservedAcrossRename(DEVICE_NAME, DEVICE_ID)) {
    printStatusField('Device ID', `${DEVICE_ID} (kept from original setup for continuity)`)
  }
  printStatusField(hasConfig ? 'Publish mode' : 'Publish preview', publishMode)
  if (hasCloudConfig) {
    printStatusField('Cloud link', CLOUD_INGEST_URL)
    printStatusField('API key', `${CLOUD_API_KEY.slice(0, 8)}..${CLOUD_API_KEY.slice(-4)}`)
  }
  const friendlyMetricLabels = {
    cpu: 'CPU',
    memory: 'Memory',
    gpu: 'GPU',
    temperature: 'Temperature',
    agent_activity: 'OpenClaw activity',
    token_usage: 'OpenClaw tokens',
    runtime_state: 'OpenClaw runtime',
    provider_quota: 'Provider quota'
  }
  const metricLabels = [...MONITOR_TARGETS].map((t) => friendlyMetricLabels[t] || t)
  if (hasConfig) {
    printStatusField('Metrics', metricLabels.join(', '))
  } else {
    const defaultMetricPreview = ['CPU', 'Memory', 'GPU', 'Temperature']
    const extraPreview = ['OpenClaw activity', 'OpenClaw tokens', 'OpenClaw runtime', 'Provider quota']
      .filter((label) => metricLabels.includes(label))
    printStatusField('Default metrics', defaultMetricPreview.join(', '))
    if (extraPreview.length > 0) {
      printStatusField('Extras available', extraPreview.join(', '))
    }
  }
  printStatusField(hasConfig ? 'Local log' : 'Local log preview', LOCAL_LOG_PATH || '(none)')
  printStatusField('Config', hasConfig ? envFile : `${envFile} (not saved yet)`)

  // LaunchAgent state
  if (process.platform === 'darwin') {
    const launchAgent = probeOwnedLaunchAgentState()
    if (launchAgent.state === 'running') {
      printStatusField('Background', `running in background (pid ${launchAgent.pid})`)
    } else if (launchAgent.state === 'loaded') {
      printStatusField('Background', 'on (waiting for next check)')
    } else if (launchAgent.state === 'installed-not-loaded') {
      if (hasConfig) {
        printStatusField('Background', 'installed but not running')
      } else {
        printStatusField('Background', 'waiting for setup')
      }
    } else {
      printStatusField('Background', 'off')
    }
  }

  if (MONITOR_PROVIDER_QUOTA) {
    const quotaCache = loadProviderQuotaCache(PROVIDER_QUOTA_CACHE_PATH)
    if (quotaCache?.providerConnections?.length) {
      const ageMs = quotaCache.updatedAtMs ? Math.max(0, Date.now() - quotaCache.updatedAtMs) : null
      const ageLabel = Number.isFinite(ageMs) ? `${Math.round(ageMs / 60000)}m ago` : 'unknown'
      printStatusField('Provider sync', `${quotaCache.providerConnections.length} provider${quotaCache.providerConnections.length === 1 ? '' : 's'} • ${ageLabel}`)
      quotaCache.providerConnections.forEach((providerConnection) => {
        console.log(`    - ${formatProviderConnectionSummaryLine(providerConnection)}`)
      })
    } else {
      printStatusField('Provider sync', 'waiting for first provider status')
    }
    if (quotaCache?.providerQuotas?.length) {
      const ageMs = quotaCache.updatedAtMs ? Math.max(0, Date.now() - quotaCache.updatedAtMs) : null
      const ageLabel = Number.isFinite(ageMs) ? `${Math.round(ageMs / 60000)}m ago` : 'unknown'
      printStatusField('Quota cache', `${quotaCache.providerQuotas.length} provider${quotaCache.providerQuotas.length === 1 ? '' : 's'} • ${ageLabel}`)
      quotaCache.providerQuotas.forEach((providerQuota) => {
        console.log(`    - ${formatProviderQuotaSummaryLine(providerQuota)}`)
      })
    } else {
      printStatusField('Quota cache', 'waiting for first provider snapshot')
    }
  }

  let hasSamples = false
  if (LOCAL_LOG_PATH && fs.existsSync(LOCAL_LOG_PATH)) {
    try {
      const stat = fs.statSync(LOCAL_LOG_PATH)
      const activeBytes = stat.size
      let rotatedBytes = 0
      try { rotatedBytes = fs.statSync(LOCAL_LOG_PATH + '.1').size } catch (_) {}
      const logLabel = rotatedBytes > 0
        ? `${formatBytes(activeBytes)} (+ ${formatBytes(rotatedBytes)} rotated)`
        : formatBytes(activeBytes)
      printStatusField('Log size', logLabel)
      const rows = parseLocalRows(LOCAL_LOG_PATH, 1)
      if (rows.length > 0 && rows[0].ts) {
        hasSamples = true
        const ageMs = Date.now() - Number(rows[0].ts)
        const ageSec = Math.round(ageMs / 1000)
        const agoText = ageSec < 60 ? `${ageSec}s ago` : ageSec < 3600 ? `${Math.round(ageSec / 60)}m ago` : ageSec < 86400 ? `${Math.round(ageSec / 3600)}h ago` : `${Math.round(ageSec / 86400)}d ago`
        printStatusField('Last sample', agoText)
      } else {
        printStatusField('Last sample', '(none yet)')
      }
    } catch { /* ignore stat errors */ }
  } else if (hasConfig) {
    printStatusField('Last sample', '(none yet)')
  }

  // Hint if device name looks like a placeholder
  const placeholderNames = new Set(['test', 'device', 'my-device', 'default', 'localhost', 'unnamed'])
  const isPlaceholderName = hasConfig && placeholderNames.has(DEVICE_NAME.toLowerCase().trim())
  if (isPlaceholderName) {
    console.log(`  ℹ️  Rename this device:  ${preferredRecoveryCommand('configure')}`)
  }

  console.log('')
  if (!hasConfig) {
    console.log(`  Get started:  ${preferredHelpSetupCommand('quickstart')}`)
  } else if (!hasSamples) {
    console.log(`  Test:     ${inferCliCommand('--once')}  (alias: --test-publish)`)
    if (detectCliInvocation().kind === 'npx') {
      console.log(`  Start:    ${inferCliCommand('run')}`)
      const launchAgent = process.platform === 'darwin' ? probeOwnedLaunchAgentState() : null
      if (launchAgent?.state === 'running' || launchAgent?.state === 'loaded') {
        console.log('  Background: already on via the durable install')
      } else if (launchAgent?.state === 'installed-not-loaded') {
        console.log('  Start:    idlewatch install-agent')
      } else {
        console.log('  Install once:              npm install -g idlewatch')
        console.log('  Turn on background mode:  idlewatch install-agent')
      }
    } else {
      console.log(`  Start:    ${inferCliCommand('run')}`)
      if (process.platform === 'darwin') {
        const launchAgent = probeOwnedLaunchAgentState()
        const installAgentCommand = preferredProductCommand('install-agent')
        if (launchAgent.state === 'running' || launchAgent.state === 'loaded') {
          console.log('  Background: already on')
        } else if (launchAgent.state === 'installed-not-loaded') {
          console.log(`  Start:    ${installAgentCommand}`)
        } else {
          console.log(`  Turn on background mode:  ${installAgentCommand}`)
        }
      } else {
        console.log(`  Background mode on macOS:  ${inferCliCommand('install-agent')}`)
      }
    }
  } else if (!isPlaceholderName) {
    const installAgentCommand = preferredProductCommand('install-agent')
    console.log(`  Change:   ${preferredRecoveryCommand('configure')}`)

    if (detectCliInvocation().kind === 'npx') {
      const launchAgent = process.platform === 'darwin' ? probeOwnedLaunchAgentState() : null
      if (launchAgent?.state === 'running' || launchAgent?.state === 'loaded') {
        console.log('  Background: already on via the durable install')
      } else if (launchAgent?.state === 'installed-not-loaded') {
        console.log('  Start:    idlewatch install-agent')
      } else {
        console.log('  Install once:              npm install -g idlewatch')
        console.log('  Turn on background mode:  idlewatch install-agent')
      }
    } else if (process.platform === 'darwin') {
      const launchAgent = probeOwnedLaunchAgentState()
      if (launchAgent.state === 'running' || launchAgent.state === 'loaded') {
        console.log(`  Apply:    re-run ${installAgentCommand} to apply the saved config`)
      } else if (launchAgent.state === 'installed-not-loaded') {
        console.log(`  Start:    ${installAgentCommand}`)
      } else {
        console.log(`  Turn on background mode:  ${installAgentCommand}`)
      }
    } else {
      console.log(`  Background mode on macOS:  ${installAgentCommand}`)
    }
  }
  process.exit(0)
}

if (shouldWarnAboutMissingPublishConfig) {
  console.error(
    `Running in local-only mode — telemetry is saved to disk but not published. Run ${preferredRecoveryCommand('configure')} to add a cloud API key.`
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

const LOCAL_LOG_MAX_BYTES = parseInt(process.env.IDLEWATCH_LOCAL_LOG_MAX_MB || '10', 10) * 1024 * 1024

function rotateLocalLogIfNeeded() {
  try {
    const stat = fs.statSync(LOCAL_LOG_PATH)
    if (stat.size >= LOCAL_LOG_MAX_BYTES) {
      const rotated = LOCAL_LOG_PATH + '.1'
      fs.renameSync(LOCAL_LOG_PATH, rotated)
    }
  } catch (_) { /* file doesn't exist yet — nothing to rotate */ }
}

function appendLocal(row) {
  try {
    ensureDirFor(LOCAL_LOG_PATH)
    rotateLocalLogIfNeeded()
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
          body: JSON.stringify(row),
          signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS)
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
  const dayLoadSummary = buildRollingLoadSummary(LOCAL_LOG_PATH, sampleStartMs)
  const openclawUsageEnabled = EFFECTIVE_OPENCLAW_MODE !== 'off'
  const activitySummary = MONITOR_AGENT_ACTIVITY ? loadOpenClawActivitySummary({ nowMs: sampleStartMs }) : null

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

  let usageProbe = openclawUsageEnabled ? loadOpenClawUsage() : { usage: null, probe: disabledProbe }
  let usage = usageProbe.usage
  let usageFreshness = deriveUsageFreshness(usage, sampleStartMs, USAGE_STALE_MS, USAGE_NEAR_STALE_MS, USAGE_STALE_GRACE_MS)
  let usageRefreshAttempted = false
  let usageRefreshRecovered = false
  let usageRefreshAttempts = 0
  let usageRefreshDurationMs = null
  let usageRefreshStartMs = null

  const shouldRefreshForNearStale = USAGE_REFRESH_ON_NEAR_STALE === 1 && usageFreshness.isNearStale
  const canRefreshFromCurrentState = usageProbe.probe.result === 'ok' || usageProbe.probe.result === 'fallback-cache'

  if (openclawUsageEnabled && usage && (usageFreshness.isPastStaleThreshold || shouldRefreshForNearStale) && canRefreshFromCurrentState) {
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
  const thermals = MONITOR_TEMPERATURE && process.platform === 'darwin'
    ? thermalSampleDarwin()
    : { tempC: null, source: 'disabled', thermalLevel: null, thermalState: MONITOR_TEMPERATURE ? 'unavailable' : 'disabled' }
  const customMetrics = collectCustomMetrics(CUSTOM_METRIC_DEFINITIONS)
  const providerQuotaSummary = MONITOR_PROVIDER_QUOTA
    ? await collectProviderQuotas({
      host: SAFE_HOST,
      cachePath: PROVIDER_QUOTA_CACHE_PATH,
      cacheTtlMs: PROVIDER_QUOTA_INTERVAL_MS,
      timeoutMs: PROVIDER_QUOTA_TIMEOUT_MS
    })
    : { providerQuotas: [], providerConnections: [], status: 'disabled', updatedAtMs: null, cacheAgeMs: null, errors: [] }

  const usageIntegrationStatus = usage
    ? usageFreshness.isStale
      ? 'stale'
      : usage?.integrationStatus === 'partial'
        ? 'ok'
        : (usage?.integrationStatus ?? 'ok')
    : (openclawUsageEnabled ? 'unavailable' : 'disabled')

  const source = {
    monitorTargets: [...MONITOR_TARGETS],
    usage: usage ? 'openclaw' : openclawUsageEnabled ? 'unavailable' : 'disabled',
    usageIntegrationStatus,
    usageIngestionStatus: openclawUsageEnabled
      ? usage && ['ok', 'fallback-cache'].includes(usageProbe.probe.result)
        ? 'ok'
        : 'unavailable'
      : 'disabled',
    usageActivityStatus: usage
      ? usageFreshness.freshnessState
      : (openclawUsageEnabled ? 'unavailable' : 'disabled'),
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
    usageFreshnessState: openclawUsageEnabled
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
    activitySource: activitySummary?.source ?? (MONITOR_AGENT_ACTIVITY ? 'unavailable' : 'disabled'),
    activityWindowMs: MONITOR_AGENT_ACTIVITY ? (activitySummary?.windowMs ?? null) : null,
    thermalSource: thermals.source,
    thermalState: thermals.thermalState,
    providerQuotaStatus: providerQuotaSummary.status,
    providerQuotaCount: providerQuotaSummary.providerQuotas.length,
    providerConnectionCount: providerQuotaSummary.providerConnections.length,
    providerQuotaUpdatedAtMs: providerQuotaSummary.updatedAtMs,
    providerQuotaCacheAgeMs: providerQuotaSummary.cacheAgeMs,
    providerQuotaErrors: providerQuotaSummary.errors,
    providerQuotaIntervalMs: MONITOR_PROVIDER_QUOTA ? PROVIDER_QUOTA_INTERVAL_MS : null,
    customMetricsFile: CUSTOM_METRIC_DEFINITIONS.length > 0 ? CUSTOM_METRICS_FILE : null,
    customMetricsCount: customMetrics.length,
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
    deviceTempC: MONITOR_TEMPERATURE ? thermals.tempC : null,
    thermalLevel: MONITOR_TEMPERATURE ? thermals.thermalLevel : null,
    thermalState: MONITOR_TEMPERATURE ? thermals.thermalState : 'disabled',
    dayWindowMs: dayLoadSummary?.windowMs ?? DAY_WINDOW_MS,
    dayCpuAvgPct: MONITOR_CPU ? (dayLoadSummary?.cpuAvgPct ?? null) : null,
    dayMemAvgPct: MONITOR_MEMORY ? (dayLoadSummary?.memAvgPct ?? null) : null,
    dayGpuAvgPct: MONITOR_GPU ? (dayLoadSummary?.gpuAvgPct ?? null) : null,
    dayTempAvgC: MONITOR_TEMPERATURE ? (dayLoadSummary?.tempAvgC ?? null) : null,
    dayTempMaxC: MONITOR_TEMPERATURE ? (dayLoadSummary?.tempMaxC ?? null) : null,
    dayTokensAvgPerMin: MONITOR_TOKEN_USAGE ? (dayLoadSummary?.tokensAvgPerMin ?? null) : null,
    gpuSource: gpu.source,
    gpuConfidence: gpu.confidence,
    gpuSampleWindowMs: gpu.sampleWindowMs,
    tokensPerMin: MONITOR_TOKEN_USAGE ? (usage?.tokensPerMin ?? null) : null,
    openclawModel: MONITOR_RUNTIME_STATE ? (usage?.model ?? null) : null,
    openclawProvider: MONITOR_RUNTIME_STATE ? (usage?.provider ?? null) : null,
    openclawTotalTokens: MONITOR_TOKEN_USAGE ? (usage?.totalTokens ?? null) : null,
    openclawInputTokens: MONITOR_TOKEN_USAGE ? (usage?.inputTokens ?? null) : null,
    openclawOutputTokens: MONITOR_TOKEN_USAGE ? (usage?.outputTokens ?? null) : null,
    openclawRemainingTokens: openclawUsageEnabled ? (usage?.remainingTokens ?? null) : null,
    openclawPercentUsed: openclawUsageEnabled ? (usage?.percentUsed ?? null) : null,
    openclawContextTokens: openclawUsageEnabled ? (usage?.contextTokens ?? null) : null,
    openclawBudgetKind: openclawUsageEnabled ? (usage?.budgetKind ?? null) : null,
    openclawSessionId: openclawUsageEnabled ? (usage?.sessionId ?? null) : null,
    openclawAgentId: openclawUsageEnabled ? (usage?.agentId ?? null) : null,
    openclawUsageTs: openclawUsageEnabled ? (usage?.usageTimestampMs ?? null) : null,
    openclawUsageAgeMs: openclawUsageEnabled ? usageFreshness.usageAgeMs : null,
    activityWindowMs: MONITOR_AGENT_ACTIVITY ? (activitySummary?.windowMs ?? null) : null,
    activityActiveSeconds: MONITOR_AGENT_ACTIVITY ? (activitySummary?.totalActiveSeconds ?? null) : null,
    activityIdleSeconds: MONITOR_AGENT_ACTIVITY ? (activitySummary?.idleSeconds ?? null) : null,
    activityJobs: MONITOR_AGENT_ACTIVITY ? (activitySummary?.jobs ?? []) : [],
    providerQuotas: providerQuotaSummary.providerQuotas,
    providerConnections: providerQuotaSummary.providerConnections,
    customMetrics,
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

function summarizeSample(row, { verbose = false } = {}) {
  const metrics = new Set()
  const hasValue = (value) => value !== null && value !== undefined
  const selectedMonitorTargets = Array.isArray(row?.source?.monitorTargets) ? row.source.monitorTargets : []
  const hasTemperatureMetric = hasValue(row.deviceTempC)
    || (row.thermalState && row.thermalState !== 'disabled' && row.thermalState !== 'unavailable')
  const hasRuntimeMetric = hasValue(row.openclawModel)
    || hasValue(row.openclawProvider)
    || hasValue(row.openclawUsageTs)
    || hasValue(row.openclawBudgetKind)
    || hasValue(row.openclawSessionId)
    || hasValue(row.openclawAgentId)
  const hasActivityMetric = hasValue(row.activityWindowMs)
    || hasValue(row.activityActiveSeconds)
    || hasValue(row.activityIdleSeconds)
    || (Array.isArray(row.activityJobs) && row.activityJobs.length > 0)

  if (hasValue(row.cpuPct) || selectedMonitorTargets.includes('cpu')) metrics.add('cpu')
  if (hasValue(row.memPct) || selectedMonitorTargets.includes('memory')) metrics.add('memory')
  if (hasValue(row.gpuPct) || selectedMonitorTargets.includes('gpu')) metrics.add('gpu')
  if (hasTemperatureMetric || selectedMonitorTargets.includes('temperature')) metrics.add('temperature')
  if (hasActivityMetric || selectedMonitorTargets.includes('agent_activity')) metrics.add('agent-activity')
  if (hasValue(row.tokensPerMin) || selectedMonitorTargets.includes('token_usage')) metrics.add('openclaw-usage')
  if (hasRuntimeMetric || selectedMonitorTargets.includes('runtime_state')) metrics.add('openclaw-runtime')
  if (
    (Array.isArray(row.providerQuotas) && row.providerQuotas.length > 0)
    || (Array.isArray(row.providerConnections) && row.providerConnections.length > 0)
    || selectedMonitorTargets.includes('provider_quota')
  ) {
    metrics.add('provider-quota')
  }
  if (Array.isArray(row.customMetrics) && row.customMetrics.length > 0) metrics.add('custom')

  const headline = `✅ Sample collected (${metrics.size} metric${metrics.size === 1 ? '' : 's'})`
  if (!verbose) return headline

  const details = []
  const parts = []
  if (row.cpuPct != null) parts.push(`CPU: ${Math.round(row.cpuPct)}%`)
  if (row.memPct != null) parts.push(`Memory: ${Math.round(row.memPct)}%`)
  if (row.gpuPct != null) parts.push(`GPU: ${Math.round(row.gpuPct)}%`)
  if (row.deviceTempC != null && row.deviceTempC > 0) parts.push(`Temp: ${Math.round(row.deviceTempC)}°C`)
  else if (row.thermalState && row.thermalState !== 'disabled' && row.thermalState !== 'unavailable') parts.push(`Temp: ${row.thermalState}`)
  else if (row.deviceTempC === 0) parts.push('Temp: nominal')
  if (parts.length > 0) details.push(`  ${parts.join('  ')}`)

  const oclawParts = []
  if (row.openclawModel) oclawParts.push(row.openclawModel)
  if (row.openclawPercentUsed != null) {
    const pctLabel = row.openclawPercentUsed > 100
      ? `100%+ context used (${Math.round(row.openclawPercentUsed)}% overflow)`
      : `${Math.round(row.openclawPercentUsed)}% context used`
    oclawParts.push(pctLabel)
  }
  if (row.tokensPerMin != null) oclawParts.push(`${Math.round(row.tokensPerMin).toLocaleString()} tok/min`)
  if (oclawParts.length > 0) details.push(`  OpenClaw: ${oclawParts.join(', ')}`)

  return details.length > 0 ? `${details.join('\n')}\n${headline}` : headline
}

async function tick() {
  const row = await collectSample()
  const localUsage = appendLocal(row)
  row.localLogPath = localUsage.path
  row.localLogBytes = localUsage.bytes

  const published = await publish(row)

  if (JSON_OUTPUT) {
    // Machine-readable: add publishResult field and output JSON
    const output = { ...row, publishResult: published ? 'ok' : (DRY_RUN ? 'dry_run' : 'error') }
    if (!published && !DRY_RUN && cloudIngestKickedOut) {
      output.publishError = cloudIngestKickoutReason || 'unauthorized'
    }
    console.log(JSON.stringify(output))
  } else if (ONCE || DRY_RUN || process.env.IDLEWATCH_SETUP_VERIFY === '1') {
    if (DRY_RUN) {
      const summary = summarizeSample(row, { verbose: true })
      console.log(`${summary} — nothing published (dry run)`)
    } else if (published) {
      console.log(summarizeSample(row) + ' and published')
    } else if (isExpectedLocalOnlyMode()) {
      console.log(summarizeSample(row) + ' and saved locally')
    } else {
      const base = summarizeSample(row).replace(/^✅/, '⚠️')
      console.log(base + ' (not published)')
    }
  } else {
    // Continuous run mode: one concise line per cycle
    const ts = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const parts = []
    if (row.cpuPct != null) parts.push(`CPU: ${Math.round(row.cpuPct)}%`)
    if (row.memPct != null) parts.push(`Mem: ${Math.round(row.memPct)}%`)
    if (row.gpuPct != null) parts.push(`GPU: ${Math.round(row.gpuPct)}%`)
    const metricsStr = parts.join(' ')
    if (published) {
      console.log(`${ts} ✅ ${metricsStr} → published`)
    } else {
      console.log(`${ts} ⚠️ ${metricsStr} → not published`)
    }
  }

  if (!DRY_RUN && cloudIngestKickedOut && !cloudIngestKickoutNotified) {
    cloudIngestKickoutNotified = true
    if (!(REQUIRE_CLOUD_WRITES && ONCE)) {
      console.error(`Cloud ingest disabled: API key rejected (${cloudIngestKickoutReason || 'unauthorized'}).`)
      console.error(`  Fix: ${preferredSetupCommand('configure')}  (to update API key)`)
    }
  }

  if (!DRY_RUN && REQUIRE_FIREBASE_WRITES && ONCE && !published) {
    throw new Error('Firebase write was required but not executed. Check Firebase configuration and connectivity.')
  }

  if (!DRY_RUN && REQUIRE_CLOUD_WRITES && ONCE && !published) {
    if (cloudIngestKickedOut) {
      throw new Error(
        `❌ Cloud publish failed for "${DEVICE_NAME}": API key rejected (${cloudIngestKickoutReason || 'unauthorized'}). Run ${preferredRecoveryCommand('configure')} to update your API key.`
      )
    }
    throw new Error(`❌ Cloud publish failed for "${DEVICE_NAME}": check API key and connectivity.`)
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

subcommandPromise
  .then((subcommandHandled) => {
    if (subcommandHandled) return

    if (DRY_RUN || ONCE) {
      const progressStream = JSON_OUTPUT ? process.stderr : process.stdout
      progressStream.write(`${DRY_RUN ? 'Dry-run' : 'Collecting sample'} for "${DEVICE_NAME}" (${getPublishModeLabel()} mode)…\n`)
      tick()
        .then(() => process.exit(0))
        .catch((e) => {
          console.error(e.message)
          process.exit(1)
        })
      return
    }

    const runLog = JSON_OUTPUT ? process.stderr : process.stdout
    runLog.write(`idlewatch started — "${DEVICE_NAME}" (${getPublishModeLabel()} mode, every ${Math.round(INTERVAL_MS / 1000)}s)\n`)
    // Hint about background agent if LaunchAgent is not installed
    try {
      const launchAgentPath = path.join(os.homedir(), 'Library/LaunchAgents/com.idlewatch.agent.plist')
      accessSync(launchAgentPath, constants.F_OK)
    } catch {
      if (detectCliInvocation().kind === 'npx') {
        runLog.write(`Tip: One-off npx runs are great for testing. For background mode, install IdleWatch once and then run idlewatch install-agent.\n`)
      } else {
        runLog.write(`Tip: Run ${inferCliCommand('install-agent')} to run in the background, or ${inferCliCommand('menubar')} for the menu bar app.\n`)
      }
    }
    loop()
  })
  .catch((e) => {
    console.error(e?.message || String(e))
    process.exit(1)
  })
