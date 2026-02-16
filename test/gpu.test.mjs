import test from 'node:test'
import assert from 'node:assert/strict'
import { gpuSampleDarwin, __gpuTestUtils } from '../src/gpu.js'

const { parseIoregGpuUtilization, parseGpuPercent } = __gpuTestUtils

test('parses ioreg AGX performance statistics device utilization', () => {
  const sample = `"PerformanceStatistics" = {"Renderer Utilization %"=12,"Device Utilization %"=34,"Tiler Utilization %"=5}`
  assert.equal(parseIoregGpuUtilization(sample), 34)
})

test('parses powermetrics gpu residency percent', () => {
  const sample = 'GPU HW active residency: 18.25%\nGPU SW requested state: 5'
  assert.equal(parseGpuPercent(sample, 'powermetrics'), 18.25)
})

test('gpu sampler prefers ioreg when available', () => {
  const fakeExec = (cmd) => {
    if (cmd.includes('AGXAccelerator')) {
      return `"PerformanceStatistics" = {"Device Utilization %"=41}`
    }
    throw new Error('unexpected fallback')
  }

  const gpu = gpuSampleDarwin(fakeExec)
  assert.deepEqual(gpu, {
    pct: 41,
    source: 'ioreg-agx',
    confidence: 'high',
    sampleWindowMs: null
  })
})
