import test from 'node:test'
import assert from 'node:assert/strict'
import { collectCustomMetrics, parseCustomMetricValue } from '../src/custom-telemetry.js'

test('parses raw and json custom metric values', () => {
  assert.equal(parseCustomMetricValue('1234.5'), 1234.5)
  assert.equal(parseCustomMetricValue('{"value":42}'), 42)
  assert.equal(parseCustomMetricValue('$1,280.75'), 1280.75)
})

test('collects custom metrics from shell commands', () => {
  const metrics = collectCustomMetrics([
    {
      id: 'stripe-mrr',
      key: 'stripe-mrr',
      label: 'Stripe MRR',
      kind: 'currency',
      command: 'stripe-value',
      currency: 'USD',
      suffix: null
    }
  ], (command) => {
    assert.equal(command, 'stripe-value')
    return '{"value": 1820.25}'
  })

  assert.deepEqual(metrics, [{
    id: 'stripe-mrr',
    key: 'stripe-mrr',
    label: 'Stripe MRR',
    kind: 'currency',
    value: 1820.25,
    currency: 'USD',
    suffix: null,
    command: 'stripe-value'
  }])
})
