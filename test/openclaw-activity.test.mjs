import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadOpenClawActivitySummary, parseCronIntervalMs, DAY_WINDOW_MS } from '../src/openclaw-activity.js'

test('parses common cron interval shapes', () => {
  assert.equal(parseCronIntervalMs('*/10 * * * *'), 10 * 60 * 1000)
  assert.equal(parseCronIntervalMs('5-59/10 * * * *'), 10 * 60 * 1000)
  assert.equal(parseCronIntervalMs('0 */4 * * *'), 4 * 60 * 60 * 1000)
  assert.equal(parseCronIntervalMs('0 9 * * *'), 24 * 60 * 60 * 1000)
  assert.equal(parseCronIntervalMs('nonsense'), null)
})

test('loads 24h OpenClaw activity summary from cron history', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-openclaw-activity-'))
  const cronDir = path.join(tmpHome, '.openclaw', 'cron')
  const runsDir = path.join(cronDir, 'runs')
  fs.mkdirSync(runsDir, { recursive: true })

  const nowMs = 1_773_600_000_000

  fs.writeFileSync(path.join(cronDir, 'jobs.json'), JSON.stringify({
    version: 1,
    jobs: [
      {
        id: 'job-a',
        name: 'QA lane',
        enabled: true,
        schedule: { kind: 'cron', expr: '*/10 * * * *' }
      },
      {
        id: 'job-b',
        name: 'Daily report',
        enabled: true,
        schedule: { kind: 'cron', expr: '0 9 * * *' }
      }
    ]
  }), 'utf8')

  fs.writeFileSync(path.join(runsDir, 'job-a.jsonl'), [
    JSON.stringify({ action: 'finished', status: 'ok', runAtMs: nowMs - 2 * 60 * 60 * 1000, durationMs: 120000 }),
    JSON.stringify({ action: 'finished', status: 'error', runAtMs: nowMs - 30 * 60 * 1000, durationMs: 45000 })
  ].join('\n'), 'utf8')

  fs.writeFileSync(path.join(runsDir, 'job-b.jsonl'), [
    JSON.stringify({ action: 'finished', status: 'ok', runAtMs: nowMs - 26 * 60 * 60 * 1000, durationMs: 20000 }),
    JSON.stringify({ action: 'finished', status: 'ok', runAtMs: nowMs - 3 * 60 * 60 * 1000, durationMs: 300000 })
  ].join('\n'), 'utf8')

  const summary = loadOpenClawActivitySummary({ homeDir: tmpHome, nowMs })
  assert.ok(summary)
  assert.equal(summary.source, 'openclaw-cron-runs')
  assert.equal(summary.windowMs, DAY_WINDOW_MS)
  assert.equal(summary.totalActiveSeconds, 465)
  assert.equal(summary.idleSeconds, DAY_WINDOW_MS / 1000 - 465)
  assert.equal(summary.jobs.length, 2)
  assert.equal(summary.jobs[0].label, 'Daily report')
  assert.equal(summary.jobs[0].seconds, 300)
  assert.equal(summary.jobs[1].label, 'QA lane')
  assert.equal(summary.jobs[1].runCount, 2)
  assert.equal(summary.jobs[1].errorCount, 1)
  assert.equal(summary.jobs[1].cycleOccupancyPct, 13.8)
})
