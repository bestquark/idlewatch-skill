import test from 'node:test'
import assert from 'node:assert/strict'

import { tuiFallbackMessage } from '../src/enrollment.js'

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
