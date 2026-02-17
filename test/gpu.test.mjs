import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gpuSampleDarwin, __gpuTestUtils } from '../src/gpu.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8').trim()

const { parseIoregGpuUtilization, parseGpuPercent } = __gpuTestUtils

test('parses ioreg AGX performance statistics device utilization', () => {
  const sample = fixture('gpu-agx.txt')
  assert.equal(parseIoregGpuUtilization(sample), 34)
})

test('parses ioreg IOGPU performance statistics when AGX is unavailable', () => {
  const sample = fixture('gpu-iogpu.txt')
  assert.equal(parseIoregGpuUtilization(sample), 1.2)
})

test('parses powermetrics GPU residency percent', () => {
  const sample = 'GPU HW active residency: 18.25%\nGPU SW requested state: 5'
  assert.equal(parseGpuPercent(sample, 'powermetrics'), 18.25)
})

test('parses top grep fallback output', () => {
  const sample = fixture('gpu-top-grep.txt')
  assert.equal(parseGpuPercent(sample, 'top-grep'), 7.8)
})

test('gpu sampler captures three distinct macOS telemetry sources deterministically', () => {
  const fakeExec = (cmd) => {
    if (cmd.includes('AGXAccelerator')) {
      return fixture('gpu-agx.txt')
    }
    if (cmd.includes('IOGPU')) {
      return fixture('gpu-iogpu.txt')
    }
    if (cmd.includes('powermetrics')) {
      return 'GPU HW active residency: 11.11%\nGPU SW requested state: 5'
    }
    if (cmd.includes('top -l 1 | grep -i \'GPU\'')) {
      return fixture('gpu-top-grep.txt')
    }
    throw new Error(`unexpected command in test: ${cmd}`)
  }

  const gpu = gpuSampleDarwin(fakeExec)
  assert.deepEqual(gpu, {
    pct: 34,
    source: 'ioreg-agx',
    confidence: 'high',
    sampleWindowMs: null
  })
})
