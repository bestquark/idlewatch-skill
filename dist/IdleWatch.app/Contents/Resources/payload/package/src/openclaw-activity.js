import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const DAY_WINDOW_MS = 24 * 60 * 60 * 1000

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function readJsonLines(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

export function parseCronIntervalMs(expr) {
  const value = String(expr || '').trim()
  if (!value) return null

  const parts = value.split(/\s+/)
  if (parts.length !== 5) return null

  const [minute, hour] = parts
  const minuteStepMatch = minute.match(/^(?:\*|\d+-\d+)\/(\d+)$/)
  if (minuteStepMatch && hour === '*') {
    const minutes = Number(minuteStepMatch[1])
    return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : null
  }

  if (/^\d+$/.test(minute) && /^\*\/(\d+)$/.test(hour)) {
    const hours = Number(hour.slice(2))
    return Number.isFinite(hours) && hours > 0 ? hours * 60 * 60 * 1000 : null
  }

  if (/^\d+$/.test(minute) && hour === '*') return 60 * 60 * 1000
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) return 24 * 60 * 60 * 1000
  return null
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function loadOpenClawActivitySummary(options = {}) {
  const homeDir = options.homeDir || os.homedir()
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now()
  const windowMs = Number.isFinite(options.windowMs) ? options.windowMs : DAY_WINDOW_MS
  const cutoffMs = nowMs - windowMs
  const openclawDir = path.join(homeDir, '.openclaw')
  const jobsPath = path.join(openclawDir, 'cron', 'jobs.json')
  const runsDir = path.join(openclawDir, 'cron', 'runs')

  const jobsPayload = readJson(jobsPath)
  const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : []

  if (jobs.length === 0 || !fs.existsSync(runsDir)) return null

  const jobsById = new Map(jobs.map((job) => [String(job.id || ''), job]).filter(([id]) => id))
  const summaries = new Map()

  for (const entry of fs.readdirSync(runsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue

    const jobId = entry.name.replace(/\.jsonl$/, '')
    const job = jobsById.get(jobId)
    const runs = readJsonLines(path.join(runsDir, entry.name))

    for (const run of runs) {
      const runAtMs = Number(run.runAtMs ?? run.ts ?? 0)
      const durationMs = Number(run.durationMs ?? 0)
      const runStatus = String(run.status || 'unknown')

      if (!Number.isFinite(runAtMs) || runAtMs < cutoffMs) continue
      if (!Number.isFinite(durationMs) || durationMs <= 0) continue
      if (run.action && run.action !== 'finished') continue

      const intervalMs = parseCronIntervalMs(job?.schedule?.expr)
      const summary = summaries.get(jobId) || {
        id: jobId,
        label: String(job?.name || run.summary || jobId).trim() || jobId,
        kind: String(job?.schedule?.kind || '').trim() || 'cron',
        intervalMs,
        enabled: Boolean(job?.enabled),
        totalDurationMs: 0,
        runCount: 0,
        okCount: 0,
        errorCount: 0,
        maxDurationMs: 0,
        lastRunAtMs: 0,
        lastStatus: 'unknown'
      }

      summary.totalDurationMs += durationMs
      summary.runCount += 1
      summary.maxDurationMs = Math.max(summary.maxDurationMs, durationMs)
      summary.lastRunAtMs = Math.max(summary.lastRunAtMs, runAtMs)
      summary.lastStatus = runStatus

      if (runStatus === 'error') summary.errorCount += 1
      else summary.okCount += 1

      summaries.set(jobId, summary)
    }
  }

  const jobsSummary = [...summaries.values()]
    .filter((item) => item.runCount > 0 && item.totalDurationMs > 0)
    .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
    .map((item) => {
      const avgDurationMs = item.totalDurationMs / item.runCount
      const cycleOccupancyPct = item.intervalMs && item.intervalMs > 0
        ? round(Math.min(100, (avgDurationMs / item.intervalMs) * 100), 1)
        : null

      return {
        id: item.id,
        label: item.label,
        kind: item.kind,
        enabled: item.enabled,
        intervalMs: item.intervalMs,
        runCount: item.runCount,
        okCount: item.okCount,
        errorCount: item.errorCount,
        seconds: round(item.totalDurationMs / 1000, 1) ?? 0,
        avgDurationMs: round(avgDurationMs, 0) ?? 0,
        maxDurationMs: round(item.maxDurationMs, 0) ?? 0,
        cycleOccupancyPct,
        lastRunAtMs: item.lastRunAtMs,
        lastStatus: item.lastStatus
      }
    })

  if (jobsSummary.length === 0) return null

  const totalActiveSeconds = jobsSummary.reduce((sum, item) => sum + Math.max(0, Number(item.seconds || 0)), 0)

  return {
    source: 'openclaw-cron-runs',
    windowMs,
    totalActiveSeconds: round(totalActiveSeconds, 1) ?? 0,
    idleSeconds: round(Math.max(0, windowMs / 1000 - totalActiveSeconds), 1) ?? 0,
    jobs: jobsSummary
  }
}
