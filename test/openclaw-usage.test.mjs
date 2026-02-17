import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseOpenClawUsage } from '../src/openclaw-usage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
}

test('parses openclaw status --json output and chooses best recent session', () => {
  const usage = parseOpenClawUsage(fixture('openclaw-status.json'))
  assert.ok(usage)
  assert.equal(usage.model, 'gpt-5.3-codex')
  assert.equal(usage.totalTokens, 70500)
  assert.equal(usage.sessionId, '90d2a820-6d77-42f0-8db4-12b90f9f7203')
  assert.equal(usage.agentId, 'main')
  assert.equal(usage.usageTimestampMs, 1771278893678)
  assert.equal(usage.integrationStatus, 'ok')
  assert.equal(usage.tokensPerMin, 384545.45)
})

test('parses noisy openclaw output and alternate sessions key names', () => {
  const usage = parseOpenClawUsage(fixture('openclaw-status-noisy.txt'))
  assert.ok(usage)
  assert.equal(usage.model, 'gpt-5.3-codex')
  assert.equal(usage.totalTokens, 222)
  assert.equal(usage.sessionId, 'new')
  assert.equal(usage.usageTimestampMs, 1771278999999)
  assert.equal(usage.integrationStatus, 'ok')
})

test('ignores non-usage JSON noise and parses later status payload', () => {
  const usage = parseOpenClawUsage(fixture('openclaw-status-multi-json.txt'))
  assert.ok(usage)
  assert.equal(usage.model, 'gpt-5.3-codex')
  assert.equal(usage.totalTokens, 333)
  assert.equal(usage.sessionId, 'new')
  assert.equal(usage.usageTimestampMs, 1771279012345)
  assert.equal(usage.integrationStatus, 'ok')
})

test('parses generic usage payloads', () => {
  const usage = parseOpenClawUsage(JSON.stringify({
    usage: {
      model: 'gpt-5.3-codex',
      totalTokens: 1234,
      tokensPerMinute: 45.67
    },
    sessionId: 'abc',
    agentId: 'main',
    updatedAt: 123456
  }))

  assert.deepEqual(usage, {
    model: 'gpt-5.3-codex',
    totalTokens: 1234,
    tokensPerMin: 45.67,
    sessionId: 'abc',
    agentId: 'main',
    usageTimestampMs: 123456000,
    integrationStatus: 'ok'
  })
})

test('returns null for invalid payload', () => {
  assert.equal(parseOpenClawUsage('not-json'), null)
})

test('parses status payloads with stringified numeric fields and stale token marker fallback', () => {
  const usage = parseOpenClawUsage(fixture('openclaw-status-strings.json'))
  assert.ok(usage)
  assert.equal(usage.model, 'claude-opus-4-6')
  assert.equal(usage.totalTokens, 450)
  assert.equal(usage.tokensPerMin, 45)
  assert.equal(usage.sessionId, 'b7e1f8')
  assert.equal(usage.agentId, 'agent-2')
  assert.equal(usage.usageTimestampMs, 1771278820000)
  assert.equal(usage.integrationStatus, 'ok')
})

test('converts epoch-seconds usage timestamps to milliseconds', () => {
  const usage = parseOpenClawUsage(fixture('openclaw-status-epoch-seconds.json'))
  assert.ok(usage)
  assert.equal(usage.sessionId, 'sec-session')
  assert.equal(usage.agentId, 'agent-sec')
  assert.equal(usage.usageTimestampMs, 1771278800000)
  assert.equal(usage.integrationStatus, 'ok')
})

test('parses stats payloads with nested usage totals', () => {
  const usage = parseOpenClawUsage(fixture('openclaw-stats.json'))
  assert.ok(usage)
  assert.equal(usage.model, 'claude-opus-4-6')
  assert.equal(usage.totalTokens, 4560)
  assert.equal(usage.tokensPerMin, 123.45)
  assert.equal(usage.sessionId, 'sess-stats-01')
  assert.equal(usage.agentId, 'agent-stats')
  assert.equal(usage.usageTimestampMs, 1771279012345)
  assert.equal(usage.integrationStatus, 'ok')
})

test('parses status payload with nested sessions object and totals in totals.nested field', () => {
  const raw = fixture('openclaw-status-nested-recent.json')
  const usage = parseOpenClawUsage(raw)
  assert.ok(usage)
  assert.equal(usage.model, 'gpt-5.3-codex-spark')
  assert.equal(usage.totalTokens, 21737)
  assert.equal(usage.tokensPerMin, 32502.31)
  assert.equal(usage.sessionId, 'sess-1')
  assert.equal(usage.agentId, 'agent-007')
  assert.equal(usage.usageTimestampMs, 1739703000000)
  assert.equal(usage.integrationStatus, 'ok')
})

test('parses wrapped status payload with direct session array and nested usage totals', () => {
  const usage = parseOpenClawUsage(fixture('openclaw-status-wrap-session-object.json'))
  assert.ok(usage)
  assert.equal(usage.model, 'claude-opus-4.6')
  assert.equal(usage.totalTokens, 789)
  assert.equal(usage.tokensPerMin, 12.5)
  assert.equal(usage.sessionId, 'wrapped-session-a')
  assert.equal(usage.agentId, 'agent-wrap')
  assert.equal(usage.usageTimestampMs, Date.parse('2026-02-17T09:00:00Z'))
  assert.equal(usage.integrationStatus, 'ok')
})

test('parses status payload where sessions is an object map keyed by session id', () => {
  const usage = parseOpenClawUsage(fixture('openclaw-status-session-map.json'))
  assert.ok(usage)
  assert.equal(usage.model, 'claude-opus-4-6')
  assert.equal(usage.totalTokens, 1200)
  assert.equal(usage.sessionId, 'map-backup-1')
  assert.equal(usage.agentId, 'agent-map-backup')
  assert.equal(usage.usageTimestampMs, 1771278950000)
  assert.equal(usage.integrationStatus, 'ok')
})

test('selects active session from result.session payload shape', () => {
  const usage = parseOpenClawUsage(fixture('openclaw-status-result-session.json'))
  assert.ok(usage)
  assert.equal(usage.model, 'gpt-5.3-codex')
  assert.equal(usage.totalTokens, 1111)
  assert.equal(usage.tokensPerMin, 1234.56)
  assert.equal(usage.sessionId, 'result-session-1')
  assert.equal(usage.agentId, 'agent-result')
  assert.equal(usage.usageTimestampMs, 1771279000000)
  assert.equal(usage.integrationStatus, 'ok')
})

test('ignores metadata defaults key in session maps and still selects most recent real session', () => {
  const usage = parseOpenClawUsage(fixture('openclaw-status-session-map-with-defaults.json'))
  assert.ok(usage)
  assert.equal(usage.model, 'claude-opus-4-6')
  assert.equal(usage.totalTokens, 2222)
  assert.equal(usage.sessionId, 'map-main-2')
  assert.equal(usage.agentId, 'agent-map-main-2')
  assert.equal(usage.usageTimestampMs, 1771278960000)
  assert.equal(usage.integrationStatus, 'ok')
})

test('uses top-level default model when no sessions are available', () => {
  const sample = '{"defaultModel":"claude-opus-4-6","sessions":{"recent":[]}}'
  const usage = parseOpenClawUsage(sample)
  assert.equal(usage.model, 'claude-opus-4-6')
  assert.equal(usage.totalTokens, null)
  assert.equal(usage.integrationStatus, 'partial')
})

test('parses stderr payload even when command exits non-zero', () => {
  const sample = '{"not": "json"}\n{ "sessions": { "recent": [ { "model": "gpt", "totalTokens": 1 } ] } }'
  const got = parseOpenClawUsage(sample)
  assert.equal(got.model, 'gpt')
  assert.equal(got.totalTokens, 1)
  assert.equal(got.integrationStatus, 'ok')
})
