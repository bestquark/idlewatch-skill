import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveSetupModeChoice, tuiFallbackMessage } from '../src/enrollment.js'

test('tuiFallbackMessage keeps routine fallback copy minimal', () => {
  assert.equal(tuiFallbackMessage('bundled-binary-missing-and-cargo-missing'), 'Using text setup.')
  assert.equal(tuiFallbackMessage('cargo-missing'), 'Using text setup.')
  assert.equal(tuiFallbackMessage('bundled-binary-missing'), 'Using text setup.')
  assert.equal(tuiFallbackMessage('disabled'), 'Using text setup.')
  assert.equal(tuiFallbackMessage(undefined), 'Using text setup.')
})

test('tuiFallbackMessage avoids leaking internal reason codes in unexpected fallback cases', () => {
  const message = tuiFallbackMessage('cargo-run-failed:101')
  assert.equal(message, 'TUI setup is unavailable here. Using text setup.')
  assert.doesNotMatch(message, /cargo-run-failed/)
})

test('resolveSetupModeChoice keeps setup mode selection explicit and local-friendly', () => {
  assert.deepEqual(resolveSetupModeChoice('', '1'), { ok: true, choice: '1', mode: 'production' })
  assert.deepEqual(resolveSetupModeChoice('', '2'), { ok: true, choice: '2', mode: 'local' })
  assert.deepEqual(resolveSetupModeChoice('1', '2'), { ok: true, choice: '1', mode: 'production' })
  assert.deepEqual(resolveSetupModeChoice('2', '1'), { ok: true, choice: '2', mode: 'local' })
  assert.deepEqual(resolveSetupModeChoice(' 2 ', '1'), { ok: true, choice: '2', mode: 'local' })
  assert.deepEqual(resolveSetupModeChoice('3', '1'), {
    ok: false,
    choice: '3',
    message: 'Choose 1 for Cloud link or 2 for Local-only.'
  })
})
