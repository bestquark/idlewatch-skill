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
    usageTimestampMs: 123456,
    integrationStatus: 'ok'
  })
})

test('returns null for invalid payload', () => {
  assert.equal(parseOpenClawUsage('not-json'), null)
})
