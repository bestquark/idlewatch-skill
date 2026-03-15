import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'

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
  const currency = kind === 'currency'
    ? String(raw?.currency || 'USD').trim().toUpperCase().slice(0, 8) || 'USD'
    : null
  const suffix = kind === 'number'
    ? String(raw?.suffix || '').trim().slice(0, 12) || null
    : null

  if (!command) return null

  return {
    id: key,
    key,
    label,
    kind,
    command,
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

export function collectCustomMetrics(definitions, exec = execSync) {
  if (!Array.isArray(definitions) || definitions.length === 0) return []

  return definitions.flatMap((definition) => {
    try {
      const output = exec(definition.command, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1500
      })
      const value = parseCustomMetricValue(output)
      if (value == null) return []

      return [{
        id: definition.id,
        key: definition.key,
        label: definition.label,
        kind: definition.kind,
        value,
        currency: definition.currency,
        suffix: definition.suffix,
        command: definition.command
      }]
    } catch {
      return []
    }
  })
}
