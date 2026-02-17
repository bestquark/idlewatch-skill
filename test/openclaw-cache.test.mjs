import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadLastGoodUsageSnapshot, persistLastGoodUsageSnapshot } from '../src/openclaw-cache.js'

test('persists and reloads last-good usage snapshot', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'idlewatch-cache-test-'))
  const cachePath = path.join(dir, 'last-good.json')
  const now = Date.now()

  const saved = persistLastGoodUsageSnapshot(cachePath, {
    at: now - 500,
    usage: { model: 'gpt-5.3-codex', totalTokens: 12345 }
  })
  assert.equal(saved, true)

  const loaded = loadLastGoodUsageSnapshot(cachePath, now)
  assert.ok(loaded)
  assert.equal(loaded.usage.model, 'gpt-5.3-codex')
  assert.equal(loaded.usage.totalTokens, 12345)
  assert.ok(Number.isFinite(loaded.ageMs) && loaded.ageMs >= 0)

  rmSync(dir, { recursive: true, force: true })
})

test('returns null on corrupt cache payload', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'idlewatch-cache-test-'))
  const cachePath = path.join(dir, 'last-good.json')

  persistLastGoodUsageSnapshot(cachePath, {
    at: Date.now(),
    usage: { model: 'ok' }
  })

  // corrupt file after write
  writeFileSync(cachePath, '{nope', 'utf8')

  const loaded = loadLastGoodUsageSnapshot(cachePath)
  assert.equal(loaded, null)

  rmSync(dir, { recursive: true, force: true })
})
