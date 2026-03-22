import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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

function quoteShellPath(filePath) {
  return `'${String(filePath).replace(/'/g, `'\\''`)}'`
}

function detectCommandPath(commandName, exec = execSync) {
  try {
    const output = String(exec(`command -v ${commandName}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 600
    }) || '').trim()
    return output || null
  } catch {
    return null
  }
}

function findUserGemBinary(commandName, {
  fsModule = fs,
  homeDir = os.homedir()
} = {}) {
  const rubyRoot = path.join(homeDir, '.gem', 'ruby')
  try {
    const entries = fsModule.readdirSync(rubyRoot, { withFileTypes: true })
    const versions = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

    for (const version of versions) {
      const candidate = path.join(rubyRoot, version, 'bin', commandName)
      if (fsModule.existsSync(candidate)) return candidate
    }
  } catch {
    // ignore missing gem home
  }
  return null
}

export function resolveTemperatureProbe(exec = execSync, options = {}) {
  const shellIstats = detectCommandPath('istats', exec)
  if (shellIstats) {
    return { cmd: 'istats cpu temp', source: 'istats', path: shellIstats }
  }

  const gemIstats = findUserGemBinary('istats', options)
  if (gemIstats) {
    return { cmd: `${quoteShellPath(gemIstats)} cpu temp`, source: 'istats', path: gemIstats }
  }

  const shellOsxCpuTemp = detectCommandPath('osx-cpu-temp', exec)
  if (shellOsxCpuTemp) {
    return { cmd: 'osx-cpu-temp', source: 'osx-cpu-temp', path: shellOsxCpuTemp }
  }

  for (const candidate of ['/opt/homebrew/bin/osx-cpu-temp', '/usr/local/bin/osx-cpu-temp']) {
    if (fs.existsSync(candidate)) {
      return { cmd: quoteShellPath(candidate), source: 'osx-cpu-temp', path: candidate }
    }
  }

  return null
}

export function thermalSampleDarwin(exec = execSync) {
  const preferredProbe = resolveTemperatureProbe(exec)
  const probes = preferredProbe
    ? [{
        ...preferredProbe,
        parse: preferredProbe.source === 'istats' ? parseIstatsTemperature : parseOsxCpuTemp,
        timeoutMs: 1200
      }]
    : []

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
  detectCommandPath,
  findUserGemBinary,
  parseIstatsTemperature,
  parseOsxCpuTemp,
  parsePmsetThermal,
  resolveTemperatureProbe
}
