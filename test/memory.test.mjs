import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMemoryPressurePct, memoryPressureDarwin } from '../src/memory.js'

test('parseMemoryPressurePct derives pressure from free percentage output', () => {
  const raw = 'System-wide memory free percentage: 24%\nPages free: 12345.'
  assert.equal(parseMemoryPressurePct(raw), 76)
})

test('parseMemoryPressurePct supports explicit pressure output', () => {
  const raw = 'System-wide memory pressure: 67.5%\n'
  assert.equal(parseMemoryPressurePct(raw), 67.5)
})

test('memoryPressureDarwin returns unavailable when command fails', () => {
  const sample = memoryPressureDarwin(() => {
    throw new Error('boom')
  })

  assert.deepEqual(sample, {
    pct: null,
    cls: 'unavailable',
    source: 'unavailable'
  })
})

test('memoryPressureDarwin returns classified value when parse succeeds', () => {
  const sample = memoryPressureDarwin(() => 'System-wide memory free percentage: 12%')

  assert.deepEqual(sample, {
    pct: 88,
    cls: 'warning',
    source: 'memory_pressure'
  })
})
