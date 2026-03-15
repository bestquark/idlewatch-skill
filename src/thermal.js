import { execSync } from 'child_process'

function clampTempC(value) {
  if (!Number.isFinite(value)) return null
  return Number(value.toFixed(1))
}

function parseIstatsTemperature(text) {
  if (!text) return null
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*(?:°\s*[CF]|deg(?:rees)?\s*[CF]?)/i) || text.match(/(-?\d+(?:\.\d+)?)/)
  return match ? clampTempC(Number(match[1])) : null
}

function parseOsxCpuTemp(text) {
  if (!text) return null
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*°?\s*C/i)
  return match ? clampTempC(Number(match[1])) : null
}

function parsePmsetThermal(text) {
  if (!text) return { level: null, state: 'unavailable' }
  const normalized = text.toLowerCase()

  if (normalized.includes('no thermal warning level has been recorded')) {
    return { level: 0, state: 'nominal' }
  }

  const match = text.match(/thermal warning level[^0-9]*([0-9]+)/i)
  if (!match) return { level: null, state: 'unavailable' }

  const level = Number(match[1])
  if (!Number.isFinite(level)) return { level: null, state: 'unavailable' }

  if (level <= 0) return { level, state: 'nominal' }
  if (level === 1) return { level, state: 'elevated' }
  if (level === 2) return { level, state: 'high' }
  return { level, state: 'critical' }
}

export function thermalSampleDarwin(exec = execSync) {
  const probes = [
    {
      cmd: 'istats cpu temp',
      source: 'istats',
      parse: parseIstatsTemperature,
      timeoutMs: 1200
    },
    {
      cmd: 'osx-cpu-temp',
      source: 'osx-cpu-temp',
      parse: parseOsxCpuTemp,
      timeoutMs: 1200
    }
  ]

  for (const probe of probes) {
    try {
      const out = exec(probe.cmd, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: probe.timeoutMs
      })
      const tempC = probe.parse(out)
      if (tempC != null) {
        const pressure = parsePmsetThermal(
          exec('pmset -g therm', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 1000
          })
        )
        return {
          tempC,
          source: probe.source,
          thermalLevel: pressure.level,
          thermalState: pressure.state
        }
      }
    } catch {
      // keep probing
    }
  }

  try {
    const pressure = parsePmsetThermal(
      exec('pmset -g therm', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1000
      })
    )
    return {
      tempC: null,
      source: 'pmset-therm',
      thermalLevel: pressure.level,
      thermalState: pressure.state
    }
  } catch {
    return {
      tempC: null,
      source: 'unavailable',
      thermalLevel: null,
      thermalState: 'unavailable'
    }
  }
}

export const __thermalTestUtils = {
  clampTempC,
  parseIstatsTemperature,
  parseOsxCpuTemp,
  parsePmsetThermal
}
