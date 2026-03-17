import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawn, spawnSync } from 'node:child_process'

export const PROVIDER_QUOTA_DEFAULT_INTERVAL_MS = 15 * 60 * 1000
export const PROVIDER_QUOTA_DEFAULT_TIMEOUT_MS = 4000

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function writeJsonFile(filePath, payload) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 })
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePercent(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, Math.min(100, Number(numeric.toFixed(1))))
}

function normalizeTimestampMs(value) {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? Math.round(value) : Math.round(value * 1000)
  }

  const text = normalizeString(value)
  if (!text) return null

  const numeric = Number(text)
  if (Number.isFinite(numeric)) {
    return numeric > 1_000_000_000_000 ? Math.round(numeric) : Math.round(numeric * 1000)
  }

  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? null : parsed
}

function decodeJwtPayload(token) {
  const text = normalizeString(token)
  if (!text) return null
  const parts = text.split('.')
  if (parts.length < 2) return null

  try {
    const padded = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

function formatClaudePlan(rateLimitTier) {
  const normalized = normalizeString(rateLimitTier).toLowerCase()
  if (!normalized) return null
  if (normalized.includes('enterprise')) return 'Enterprise'
  if (normalized.includes('team')) return 'Team'
  if (normalized.includes('pro')) return 'Claude Pro'
  if (normalized.includes('max')) return 'Claude Max'
  return rateLimitTier
}

function formatGeminiPlan(tierId) {
  const normalized = normalizeString(tierId).toLowerCase()
  if (!normalized) return null
  if (normalized === 'standard-tier') return 'Paid'
  if (normalized === 'free-tier') return 'Free'
  if (normalized === 'legacy-tier') return 'Legacy'
  return tierId
}

function buildWindow({ key, label, usedPercent, remainingPercent = null, windowMinutes = null, resetsAtMs = null, detail = null }) {
  const normalizedUsed = normalizePercent(usedPercent)
  const resolvedRemaining = remainingPercent == null
    ? (normalizedUsed == null ? null : normalizePercent(100 - normalizedUsed))
    : normalizePercent(remainingPercent)

  if (normalizedUsed == null && resolvedRemaining == null) return null

  return {
    key: normalizeString(key) || 'window',
    label: normalizeString(label) || 'Window',
    usedPercent: normalizedUsed,
    remainingPercent: resolvedRemaining,
    windowMinutes: Number.isFinite(Number(windowMinutes)) ? Math.max(0, Math.round(Number(windowMinutes))) : null,
    resetsAtMs: normalizeTimestampMs(resetsAtMs),
    detail: normalizeString(detail) || null
  }
}

function normalizeProviderSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null
  const windows = Array.isArray(snapshot.windows) ? snapshot.windows.map((item) => buildWindow(item)).filter(Boolean) : []
  if (windows.length === 0) return null

  return {
    providerId: normalizeString(snapshot.providerId) || 'provider',
    providerName: normalizeString(snapshot.providerName) || normalizeString(snapshot.providerId) || 'Provider',
    source: normalizeString(snapshot.source) || 'local',
    accountEmail: normalizeString(snapshot.accountEmail) || null,
    accountPlan: normalizeString(snapshot.accountPlan) || null,
    updatedAtMs: normalizeTimestampMs(snapshot.updatedAtMs) || Date.now(),
    windows
  }
}

function commandExists(command, args = ['--help']) {
  const result = spawnSync(command, args, { stdio: 'ignore' })
  return result.status === 0
}

export function providerQuotaSupported() {
  return (
    fs.existsSync(path.join(os.homedir(), '.codex', 'auth.json')) ||
    fs.existsSync(path.join(os.homedir(), '.claude', '.credentials.json')) ||
    fs.existsSync(path.join(os.homedir(), '.gemini', 'oauth_creds.json')) ||
    commandExists('codex') ||
    commandExists('claude') ||
    commandExists('gemini')
  )
}

export function defaultProviderQuotaCacheFile(host = 'device') {
  const safeHost = String(host || 'device').replace(/[^a-zA-Z0-9_.-]/g, '_') || 'device'
  return path.join(os.homedir(), '.idlewatch', 'cache', `${safeHost}-provider-quota.json`)
}

export function loadProviderQuotaCache(cachePath) {
  const data = readJsonFile(cachePath)
  if (!data || typeof data !== 'object') return null

  const providerQuotas = Array.isArray(data.providerQuotas)
    ? data.providerQuotas.map((item) => normalizeProviderSnapshot(item)).filter(Boolean)
    : []

  return {
    updatedAtMs: normalizeTimestampMs(data.updatedAtMs) || null,
    providerQuotas
  }
}

function saveProviderQuotaCache(cachePath, payload) {
  writeJsonFile(cachePath, payload)
}

function readLineStream(stream, onLine) {
  let buffer = ''
  stream.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed) onLine(trimmed)
    }
  })
}

async function probeCodexQuota({ nowMs = Date.now(), timeoutMs = PROVIDER_QUOTA_DEFAULT_TIMEOUT_MS } = {}) {
  return await new Promise((resolve, reject) => {
    let child
    try {
      child = spawn('codex', ['-s', 'read-only', '-a', 'untrusted', 'app-server'], {
        stdio: ['pipe', 'pipe', 'ignore']
      })
    } catch (error) {
      reject(error)
      return
    }

    const pending = new Map()
    let settled = false
    let requestId = 1

    const finish = (err, value = null) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      try {
        child.kill('SIGTERM')
      } catch {
        // no-op
      }
      if (err) reject(err)
      else resolve(value)
    }

    const send = (payload) => {
      try {
        child.stdin.write(`${JSON.stringify(payload)}\n`)
      } catch (error) {
        finish(error)
      }
    }

    const request = (method, params = {}) => new Promise((resolveRequest, rejectRequest) => {
      const id = requestId
      requestId += 1
      pending.set(id, { resolve: resolveRequest, reject: rejectRequest })
      send({ id, method, params })
    })

    const timeout = setTimeout(() => finish(new Error('codex_rpc_timeout')), timeoutMs)

    child.once('error', (error) => finish(error))
    child.once('exit', (code, signal) => {
      if (!settled) finish(new Error(`codex_rpc_exit_${code ?? 'null'}_${signal ?? 'none'}`))
    })

    readLineStream(child.stdout, (line) => {
      let message
      try {
        message = JSON.parse(line)
      } catch {
        return
      }

      if (message.id == null) return
      const entry = pending.get(Number(message.id))
      if (!entry) return
      pending.delete(Number(message.id))

      if (message.error?.message) {
        entry.reject(new Error(String(message.error.message)))
        return
      }

      entry.resolve(message.result ?? null)
    })

    ;(async () => {
      try {
        await request('initialize', { clientInfo: { name: 'idlewatch', version: '0.1.0' } })
        send({ method: 'initialized', params: {} })

        const [limitsResult, accountResult] = await Promise.all([
          request('account/rateLimits/read'),
          request('account/read').catch(() => null)
        ])

        const limits = limitsResult?.rateLimits
        if (!limits) throw new Error('codex_rate_limits_missing')

        const primary = buildWindow({
          key: 'session',
          label: '5h',
          usedPercent: limits.primary?.usedPercent,
          windowMinutes: limits.primary?.windowDurationMins,
          resetsAtMs: limits.primary?.resetsAt
        })
        const secondary = buildWindow({
          key: 'weekly',
          label: '7d',
          usedPercent: limits.secondary?.usedPercent,
          windowMinutes: limits.secondary?.windowDurationMins,
          resetsAtMs: limits.secondary?.resetsAt
        })

        const snapshot = normalizeProviderSnapshot({
          providerId: 'codex',
          providerName: 'Codex',
          source: 'codex-rpc',
          accountEmail: normalizeString(accountResult?.account?.email),
          accountPlan: normalizeString(accountResult?.account?.planType || limits.planType),
          updatedAtMs: nowMs,
          windows: [primary, secondary].filter(Boolean)
        })

        if (!snapshot) throw new Error('codex_snapshot_empty')
        finish(null, snapshot)
      } catch (error) {
        finish(error)
      }
    })()
  })
}

function parseClaudeCredentials() {
  const filePath = path.join(os.homedir(), '.claude', '.credentials.json')
  const raw = readJsonFile(filePath)
  const oauth = raw?.claudeAiOauth
  const accessToken = normalizeString(oauth?.accessToken || oauth?.access_token)
  if (!accessToken) return null

  const expiresAtMs = normalizeTimestampMs(oauth?.expiresAt || oauth?.expires_at)
  if (expiresAtMs && expiresAtMs <= Date.now()) return null

  return {
    accessToken,
    accountPlan: formatClaudePlan(oauth?.rateLimitTier || oauth?.rate_limit_tier)
  }
}

async function probeClaudeQuota({ nowMs = Date.now(), timeoutMs = PROVIDER_QUOTA_DEFAULT_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
  const credentials = parseClaudeCredentials()
  if (!credentials?.accessToken || typeof fetchImpl !== 'function') return null

  const response = await fetchImpl('https://api.anthropic.com/api/oauth/usage', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20'
    },
    signal: AbortSignal.timeout(timeoutMs)
  })

  if (!response.ok) {
    throw new Error(`claude_usage_http_${response.status}`)
  }

  const payload = await response.json()
  const snapshot = normalizeProviderSnapshot({
    providerId: 'claude',
    providerName: 'Claude',
    source: 'claude-oauth',
    accountPlan: credentials.accountPlan,
    updatedAtMs: nowMs,
    windows: [
      buildWindow({
        key: 'session',
        label: '5h',
        usedPercent: payload?.five_hour?.utilization,
        windowMinutes: 300,
        resetsAtMs: payload?.five_hour?.resets_at
      }),
      buildWindow({
        key: 'weekly',
        label: '7d',
        usedPercent: payload?.seven_day?.utilization,
        windowMinutes: 7 * 24 * 60,
        resetsAtMs: payload?.seven_day?.resets_at
      }),
      buildWindow({
        key: 'weekly-sonnet',
        label: '7d sonnet',
        usedPercent: payload?.seven_day_sonnet?.utilization,
        windowMinutes: 7 * 24 * 60,
        resetsAtMs: payload?.seven_day_sonnet?.resets_at
      }),
      buildWindow({
        key: 'weekly-opus',
        label: '7d opus',
        usedPercent: payload?.seven_day_opus?.utilization,
        windowMinutes: 7 * 24 * 60,
        resetsAtMs: payload?.seven_day_opus?.resets_at
      })
    ].filter(Boolean)
  })

  return snapshot
}

function parseGeminiCredentials() {
  const credsPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json')
  const settingsPath = path.join(os.homedir(), '.gemini', 'settings.json')
  const creds = readJsonFile(credsPath)
  const settings = readJsonFile(settingsPath)
  const authType = normalizeString(settings?.authType || settings?.auth_type || settings?.authentication)
  if (authType && ['api-key', 'vertex-ai'].includes(authType)) return null

  const accessToken = normalizeString(creds?.access_token || creds?.accessToken)
  if (!accessToken) return null

  const expiryMs = normalizeTimestampMs(creds?.expiry_date || creds?.expiryDate)
  if (expiryMs && expiryMs <= Date.now()) return null

  const claims = decodeJwtPayload(creds?.id_token || creds?.idToken)
  return {
    accessToken,
    accountEmail: normalizeString(claims?.email) || null
  }
}

function summarizeGeminiBuckets(payload) {
  const buckets = Array.isArray(payload?.buckets) ? payload.buckets : []
  const byModel = new Map()

  for (const bucket of buckets) {
    const modelId = normalizeString(bucket?.modelId || bucket?.model_id)
    const remainingFraction = Number(bucket?.remainingFraction)
    if (!modelId || !Number.isFinite(remainingFraction)) continue

    const existing = byModel.get(modelId)
    if (!existing || remainingFraction < existing.remainingFraction) {
      byModel.set(modelId, {
        remainingFraction,
        resetTime: bucket?.resetTime || bucket?.reset_time
      })
    }
  }

  return [...byModel.entries()]
    .map(([modelId, bucket]) => buildWindow({
      key: modelId,
      label: modelId.replace(/^gemini-?/i, '').replace(/-/g, ' '),
      remainingPercent: Number(bucket.remainingFraction) * 100,
      usedPercent: 100 - (Number(bucket.remainingFraction) * 100),
      resetsAtMs: bucket.resetTime
    }))
    .filter(Boolean)
}

async function probeGeminiQuota({ nowMs = Date.now(), timeoutMs = PROVIDER_QUOTA_DEFAULT_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
  const credentials = parseGeminiCredentials()
  if (!credentials?.accessToken || typeof fetchImpl !== 'function') return null

  const response = await fetchImpl('https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(timeoutMs)
  })

  if (!response.ok) {
    throw new Error(`gemini_quota_http_${response.status}`)
  }

  const payload = await response.json()
  const windows = summarizeGeminiBuckets(payload)
  if (windows.length === 0) return null

  return normalizeProviderSnapshot({
    providerId: 'gemini',
    providerName: 'Gemini',
    source: 'gemini-oauth',
    accountEmail: credentials.accountEmail,
    updatedAtMs: nowMs,
    windows
  })
}

export async function collectProviderQuotas(options = {}) {
  const nowMs = options.nowMs ?? Date.now()
  const cachePath = options.cachePath || defaultProviderQuotaCacheFile(options.host || 'device')
  const cacheTtlMs = Number.isFinite(Number(options.cacheTtlMs)) ? Math.max(30_000, Number(options.cacheTtlMs)) : PROVIDER_QUOTA_DEFAULT_INTERVAL_MS
  const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Math.max(1000, Number(options.timeoutMs)) : PROVIDER_QUOTA_DEFAULT_TIMEOUT_MS
  const cached = loadProviderQuotaCache(cachePath)
  const cachedAgeMs = cached?.updatedAtMs ? Math.max(0, nowMs - cached.updatedAtMs) : null

  if (cached && cached.providerQuotas.length > 0 && cachedAgeMs != null && cachedAgeMs < cacheTtlMs) {
    return {
      providerQuotas: cached.providerQuotas,
      status: 'cache',
      updatedAtMs: cached.updatedAtMs,
      cacheAgeMs: cachedAgeMs,
      errors: []
    }
  }

  const probes = [
    ['codex', probeCodexQuota],
    ['claude', probeClaudeQuota],
    ['gemini', probeGeminiQuota]
  ]

  const providerQuotas = []
  const errors = []

  for (const [providerId, probe] of probes) {
    try {
      const snapshot = await probe({ nowMs, timeoutMs })
      if (snapshot) providerQuotas.push(snapshot)
    } catch (error) {
      errors.push({
        providerId,
        message: normalizeString(error?.message) || `${providerId}_probe_failed`
      })
    }
  }

  if (providerQuotas.length > 0) {
    saveProviderQuotaCache(cachePath, {
      updatedAtMs: nowMs,
      providerQuotas
    })
    return {
      providerQuotas,
      status: 'fresh',
      updatedAtMs: nowMs,
      cacheAgeMs: 0,
      errors
    }
  }

  if (cached?.providerQuotas?.length) {
    return {
      providerQuotas: cached.providerQuotas,
      status: 'stale-cache',
      updatedAtMs: cached.updatedAtMs,
      cacheAgeMs: cachedAgeMs,
      errors
    }
  }

  return {
    providerQuotas: [],
    status: errors.length > 0 ? 'unavailable' : 'empty',
    updatedAtMs: nowMs,
    cacheAgeMs: cachedAgeMs,
    errors
  }
}
