import test from 'node:test'
import assert from 'node:assert/strict'

import {
  extractJsonCandidates,
  readTelemetryJsonRow,
  stripControlNoise
} from '../scripts/lib/telemetry-row-parser.mjs'

test('extractJsonCandidates finds last JSON object in noisy multiline output', () => {
  const noisy = `\x1b[32m[boot]\x1b[0m starting\n` +
    '{"step":"init"}\n' +
    'heartbeat\n' +
    '{"host":"daemon","ts":123}'

  const candidates = extractJsonCandidates(noisy)

  assert.equal(candidates.length, 2)
  assert.deepEqual(JSON.parse(candidates[1]), { host: 'daemon', ts: 123 })
})

test('extractJsonCandidates handles nested arrays and trailing text', () => {
  const raw = '[{"a":1}]\nnoise\nother {"nested":{"k":2}} tail'
  const candidates = extractJsonCandidates(raw)

  assert.equal(candidates.length, 2)
  assert.deepEqual(JSON.parse(candidates[0]), [{ a: 1 }])
  assert.deepEqual(JSON.parse(candidates[1]), { nested: { k: 2 } })
})

test('readTelemetryJsonRow prefers the last valid JSON candidate', () => {
  const output = `warn\n{"ts": 1,}` +
    `\n{\"ts\": 2, \"host\": \"edge\"}\n`

  const row = readTelemetryJsonRow(output)
  assert.deepEqual(row, { ts: 2, host: 'edge' })
})

test('stripControlNoise removes ANSI control sequences that can break parser', () => {
  const raw = '\x1b[33mwarn\x1b[0m\n{\"host\":\"x\",\"ts\":123}\x1b[?1049l'
  const clean = stripControlNoise(raw)
  assert.ok(clean.includes('{"host":"x","ts":123}'))
  assert.ok(!clean.includes('\u001b['))
})
