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
    if (cmd === 'command -v istats') return '/usr/local/bin/istats\n'
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
  assert.deepEqual(calls, ['command -v istats', 'istats cpu temp', 'pmset -g therm'])
})

test('resolves a user gem istats install when it is not on PATH', () => {
  const probe = __thermalTestUtils.resolveTemperatureProbe(
    (cmd) => {
      if (cmd === 'command -v istats') throw new Error('missing')
      if (cmd === 'command -v osx-cpu-temp') throw new Error('missing')
      throw new Error(`unexpected command: ${cmd}`)
    },
    {
      homeDir: '/Users/tester',
      fsModule: {
        readdirSync(dir) {
          assert.equal(dir, '/Users/tester/.gem/ruby')
          return [
            { isDirectory: () => true, name: '3.4.0' }
          ]
        },
        existsSync(filePath) {
          return filePath === '/Users/tester/.gem/ruby/3.4.0/bin/istats'
        }
      }
    }
  )

  assert.deepEqual(probe, {
    cmd: '\'/Users/tester/.gem/ruby/3.4.0/bin/istats\' cpu temp',
    source: 'istats',
    path: '/Users/tester/.gem/ruby/3.4.0/bin/istats'
  })
})
