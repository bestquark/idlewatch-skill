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

  const destination = cachePath
  const dir = path.dirname(destination)
  const tempPath = `${destination}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const serialized = JSON.stringify({ at: payload.at, usage: payload.usage })

  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(tempPath, serialized, 'utf8')
    fs.renameSync(tempPath, destination)
    return true
  } catch {
    return false
  } finally {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
    } catch {
      // best effort cleanup
    }
  }
}
