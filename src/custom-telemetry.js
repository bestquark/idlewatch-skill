import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'

export const DEFAULT_CUSTOM_METRIC_INTERVAL_MS = 5 * 60 * 1000
export const MIN_CUSTOM_METRIC_INTERVAL_MS = 30 * 1000
export const DEFAULT_CUSTOM_METRIC_TIMEOUT_MS = 1200
export const MAX_CUSTOM_METRIC_TIMEOUT_MS = 2500

export function defaultCustomMetricsFile() {
  return path.join(os.homedir(), '.idlewatch', 'custom-metrics.json')
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

export function slugifyMetricKey(value) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'custom-metric'
}

export function normalizeCustomMetricDefinition(raw, index = 0) {
  const label = String(raw?.label || raw?.name || `Custom metric ${index + 1}`).trim() || `Custom metric ${index + 1}`
  const key = slugifyMetricKey(raw?.key || label)
  const kind = ['number', 'currency', 'percent'].includes(String(raw?.kind || '').trim().toLowerCase())
    ? String(raw.kind).trim().toLowerCase()
    : 'number'
  const command = String(raw?.command || '').trim()
  const intervalMs = Math.max(
    MIN_CUSTOM_METRIC_INTERVAL_MS,
    Number(raw?.intervalMs || raw?.refreshIntervalMs || DEFAULT_CUSTOM_METRIC_INTERVAL_MS) || DEFAULT_CUSTOM_METRIC_INTERVAL_MS
  )
  const timeoutMs = Math.min(
    MAX_CUSTOM_METRIC_TIMEOUT_MS,
    Math.max(250, Number(raw?.timeoutMs || DEFAULT_CUSTOM_METRIC_TIMEOUT_MS) || DEFAULT_CUSTOM_METRIC_TIMEOUT_MS)
  )
  const currency = kind === 'currency'
    ? String(raw?.currency || 'USD').trim().toUpperCase().slice(0, 8) || 'USD'
    : null
  const suffix = kind === 'number'
    ? String(raw?.suffix || '').trim().slice(0, 12) || null
    : null
  const allowNetwork = raw?.allowNetwork === true || raw?.allowNetwork === 'true' || raw?.allowNetwork === 1 || raw?.allowNetwork === '1'

  if (!command) return null

  return {
    id: key,
    key,
    label,
    kind,
    command,
    intervalMs,
    timeoutMs,
    allowNetwork,
    currency,
    suffix
  }
}

export function loadCustomMetricDefinitions(filePath = defaultCustomMetricsFile()) {
  try {
    if (!fs.existsSync(filePath)) return []
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!Array.isArray(raw)) return []
    return raw
      .map((item, index) => normalizeCustomMetricDefinition(item, index))
      .filter(Boolean)
  } catch {
    return []
  }
}

export function saveCustomMetricDefinitions(definitions, filePath = defaultCustomMetricsFile()) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(definitions, null, 2)}\n`, 'utf8')
}

export function parseCustomMetricValue(raw) {
  if (raw == null) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null

  const trimmed = String(raw).trim()
  if (!trimmed) return null

  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed === 'number') return Number.isFinite(parsed) ? parsed : null
    if (parsed && typeof parsed === 'object') {
      const nested = Number(parsed.value)
      return Number.isFinite(nested) ? nested : null
    }
  } catch {
    // fall back to raw numeric parsing
  }

  const numeric = Number(trimmed.replace(/[$,%\s,]+/g, ''))
  return Number.isFinite(numeric) ? numeric : null
}

export function looksLikeNetworkCommand(command) {
  const source = String(command || '').trim().toLowerCase()
  if (!source) return false
  if (/\bhttps?:\/\//.test(source)) return true
  if (/\b(curl|wget|httpie|powershell|invoke-webrequest|invoke-restmethod)\b/.test(source)) return true
  if (/\b(node|bun|deno)\b[\s\S]*\bfetch\s*\(/.test(source)) return true
  return false
}

export function collectCustomMetrics(definitions, optionsOrExec = execSync) {
  if (!Array.isArray(definitions) || definitions.length === 0) return []

  const legacyExec = typeof optionsOrExec === 'function' ? optionsOrExec : null
  const options = legacyExec ? {} : (optionsOrExec || {})
  const exec = legacyExec || options.exec || execSync
  const nowMs = Number(options.nowMs || Date.now())
  const cache = options.cache instanceof Map ? options.cache : new Map()
  const allowNetworkCommands = options.allowNetworkCommands === true

  return definitions.flatMap((definition) => {
    const cached = cache.get(definition.key)
    if (cached && Number.isFinite(cached.at) && nowMs - cached.at < Math.max(MIN_CUSTOM_METRIC_INTERVAL_MS, Number(definition.intervalMs || DEFAULT_CUSTOM_METRIC_INTERVAL_MS))) {
      return cached.metric ? [cached.metric] : []
    }

    if (looksLikeNetworkCommand(definition.command) && !allowNetworkCommands && definition.allowNetwork !== true) {
      cache.set(definition.key, { at: nowMs, metric: null, blocked: 'network-command' })
      return []
    }

    try {
      const output = exec(definition.command, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: Math.min(MAX_CUSTOM_METRIC_TIMEOUT_MS, Math.max(250, Number(definition.timeoutMs || DEFAULT_CUSTOM_METRIC_TIMEOUT_MS)))
      })
      const value = parseCustomMetricValue(output)
      if (value == null) {
        cache.set(definition.key, { at: nowMs, metric: null })
        return []
      }

      const metric = {
        id: definition.id,
        key: definition.key,
        label: definition.label,
        kind: definition.kind,
        value,
        currency: definition.currency,
        suffix: definition.suffix,
        command: definition.command
      }
      cache.set(definition.key, { at: nowMs, metric })
      return [metric]
    } catch {
      cache.set(definition.key, { at: nowMs, metric: cached?.metric || null })
      return []
    }
  })
}
