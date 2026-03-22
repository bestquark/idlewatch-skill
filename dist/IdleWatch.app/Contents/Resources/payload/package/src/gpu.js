import { execSync } from 'child_process'

function clampPct(value) {
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, Number(value.toFixed(2))))
}

function parseFirstPercent(text) {
  if (!text) return null
  const m = text.match(/(\d+\.?\d*)\s*%/)
  return m ? clampPct(Number(m[1])) : null
}

function parseIoregGpuUtilization(text) {
  if (!text) return null

  const preferredKeys = [
    'Device Utilization %',
    'Renderer Utilization %',
    'Tiler Utilization %'
  ]

  for (const key of preferredKeys) {
    const re = new RegExp(`"${key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}"\\s*=\\s*(\\d+\\.?\\d*)`, 'i')
    const m = text.match(re)
    if (m) return clampPct(Number(m[1]))
  }

  return null
}

function parseGpuPercent(text, source) {
  if (source.startsWith('ioreg')) return parseIoregGpuUtilization(text)

  if (source === 'top-grep') {
    const gpuLines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /gpu/i.test(line) && /%/.test(line))
      .join('\n')

    return parseFirstPercent(gpuLines)
  }

  return parseFirstPercent(text)
}

export function gpuSampleDarwin(exec = execSync) {
  const probes = [
    {
      cmd: '/usr/sbin/ioreg -r -d 1 -w0 -c AGXAccelerator',
      source: 'ioreg-agx',
      confidence: 'high',
      sampleWindowMs: null,
      timeoutMs: 1500
    },
    {
      cmd: '/usr/sbin/ioreg -r -d 1 -w0 -c IOGPU',
      source: 'ioreg-iogpu',
      confidence: 'medium',
      sampleWindowMs: null,
      timeoutMs: 1500
    },
    {
      cmd: 'powermetrics --samplers gpu_power -n 1 -i 1000',
      source: 'powermetrics',
      confidence: 'high',
      sampleWindowMs: 1000,
      timeoutMs: 1800
    },
    {
      cmd: "top -l 1 | grep -i 'GPU'",
      source: 'top-grep',
      confidence: 'low',
      sampleWindowMs: null,
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

      const pct = parseGpuPercent(out, probe.source)
      if (pct !== null) {
        return {
          pct,
          source: probe.source,
          confidence: probe.confidence,
          sampleWindowMs: probe.sampleWindowMs
        }
      }
    } catch {
      // ignore and continue
    }
  }

  return {
    pct: null,
    source: 'unavailable',
    confidence: 'none',
    sampleWindowMs: null
  }
}

export const __gpuTestUtils = {
  parseFirstPercent,
  parseIoregGpuUtilization,
  parseGpuPercent,
  clampPct
}
