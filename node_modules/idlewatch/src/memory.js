import os from 'os'
import { execSync } from 'child_process'

function clampPct(value) {
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, Number(value.toFixed(2))))
}

function classifyPressure(pct) {
  if (!Number.isFinite(pct)) return 'unavailable'
  if (pct >= 90) return 'critical'
  if (pct >= 75) return 'warning'
  return 'normal'
}

export function parseMemoryPressurePct(raw) {
  if (!raw) return null
  const freeMatch = raw.match(/System-wide memory free percentage:\s*(\d+\.?\d*)%/i)
  if (freeMatch) {
    const freePct = Number(freeMatch[1])
    if (Number.isFinite(freePct)) {
      return clampPct(100 - freePct)
    }
  }

  const pressureMatch = raw.match(/System-wide memory pressure:\s*(\d+\.?\d*)%/i)
  if (pressureMatch) {
    return clampPct(Number(pressureMatch[1]))
  }

  return null
}

export function memUsedPct() {
  return clampPct(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
}

export function memoryPressureDarwin(exec = execSync) {
  try {
    const out = exec('/usr/bin/memory_pressure -Q', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1200
    })
    const pct = parseMemoryPressurePct(out)
    if (pct !== null) {
      return {
        pct,
        cls: classifyPressure(pct),
        source: 'memory_pressure'
      }
    }
  } catch {
    // ignore and return unavailable
  }

  return {
    pct: null,
    cls: 'unavailable',
    source: 'unavailable'
  }
}

export const __memoryTestUtils = {
  clampPct,
  classifyPressure
}
