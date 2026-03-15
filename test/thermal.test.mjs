import test from 'node:test'
import assert from 'node:assert/strict'
import { __thermalTestUtils, thermalSampleDarwin } from '../src/thermal.js'

test('parses istats temperature output', () => {
  assert.equal(__thermalTestUtils.parseIstatsTemperature('CPU temp: 57.38°C'), 57.4)
})

test('parses osx-cpu-temp output', () => {
  assert.equal(__thermalTestUtils.parseOsxCpuTemp('61.2°C\n'), 61.2)
})

test('parses pmset thermal state', () => {
  assert.deepEqual(
    __thermalTestUtils.parsePmsetThermal('Note: No thermal warning level has been recorded'),
    { level: 0, state: 'nominal' }
  )
})

test('thermal sampler prefers explicit temp probe and falls back to pmset state', () => {
  const calls = []
  const sample = thermalSampleDarwin((cmd) => {
    calls.push(cmd)
    if (cmd === 'istats cpu temp') return 'CPU temp: 53.1°C'
    if (cmd === 'pmset -g therm') return 'Note: No thermal warning level has been recorded'
    throw new Error(`unexpected command: ${cmd}`)
  })

  assert.deepEqual(sample, {
    tempC: 53.1,
    source: 'istats',
    thermalLevel: 0,
    thermalState: 'nominal'
  })
  assert.deepEqual(calls, ['istats cpu temp', 'pmset -g therm'])
})
