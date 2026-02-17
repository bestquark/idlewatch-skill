import fs from 'node:fs'
import path from 'node:path'

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function loadLastGoodUsageSnapshot(cachePath, nowMs = Date.now()) {
  if (!cachePath) return null

  try {
    if (!fs.existsSync(cachePath)) return null
    const raw = fs.readFileSync(cachePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!isFiniteNumber(parsed?.at) || typeof parsed?.usage !== 'object' || parsed.usage === null) return null

    return {
      at: parsed.at,
      usage: parsed.usage,
      ageMs: Math.max(0, nowMs - parsed.at)
    }
  } catch {
    return null
  }
}

export function persistLastGoodUsageSnapshot(cachePath, payload) {
  if (!cachePath || !payload || !isFiniteNumber(payload.at) || typeof payload.usage !== 'object' || payload.usage === null) {
    return false
  }

  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true })
    fs.writeFileSync(cachePath, JSON.stringify({ at: payload.at, usage: payload.usage }), 'utf8')
    return true
  } catch {
    return false
  }
}
