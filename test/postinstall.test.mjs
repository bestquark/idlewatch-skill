import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCRIPT = path.resolve(__dirname, '../scripts/postinstall.mjs')

function runPostinstall(extraEnv = {}) {
  return spawnSync(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      npm_config_global: 'true',
      ...extraEnv
    },
    encoding: 'utf8'
  })
}

test('postinstall stays CLI-first by default', () => {
  const run = runPostinstall({
    IDLEWATCH_INSTALL_MACOS_MENUBAR_ON_INSTALL: '',
    IDLEWATCH_LAUNCH_MENUBAR_ON_INSTALL: ''
  })

  assert.equal(run.status, 0, run.stderr)
  assert.doesNotMatch(run.stdout, /IdleWatch menubar app installed at/)
  assert.match(run.stdout, /Set up this device:/)
  assert.match(run.stdout, /idlewatch quickstart --no-tui\n/)
  assert.doesNotMatch(run.stdout, /idlewatch quickstart\n/)
  assert.doesNotMatch(run.stdout, /plain text fallback/)
  assert.doesNotMatch(run.stdout, /npx idlewatch quickstart/)
  assert.doesNotMatch(run.stdout, /global install:/)
  assert.doesNotMatch(run.stdout, /packaged app:/)
})

test('postinstall keeps the durable install handoff neat and macOS guidance user-facing', () => {
  const run = runPostinstall({
    IDLEWATCH_INSTALL_MACOS_MENUBAR_ON_INSTALL: '',
    IDLEWATCH_LAUNCH_MENUBAR_ON_INSTALL: ''
  })

  assert.equal(run.status, 0, run.stderr)
  assert.doesNotMatch(run.stdout, /Try it once:/)
  assert.doesNotMatch(run.stdout, /Other install paths:/)
  assert.doesNotMatch(run.stdout, /npx idlewatch quickstart --no-tui/)
  assert.doesNotMatch(run.stdout, /npx idlewatch quickstart\n/)
  assert.match(run.stdout, /Set up this device:\n\s+idlewatch quickstart --no-tui/)
  assert.doesNotMatch(run.stdout, /plain text fallback/)
  assert.match(run.stdout, /Optional on macOS:\n\s+idlewatch install-agent\s+# turn on background mode/)
  assert.match(run.stdout, /\n\s+idlewatch menubar\s+# menu bar app/)
  assert.doesNotMatch(run.stdout, /Optional on macOS: idlewatch install-agent/)
  assert.doesNotMatch(run.stdout, /Optional on macOS: idlewatch menubar/)
  assert.doesNotMatch(run.stdout, /IDLEWATCH_INSTALL_MACOS_MENUBAR_ON_INSTALL=1 npm install -g idlewatch/)
})

test('postinstall stays quiet for non-global installs by default', () => {
  const run = runPostinstall({
    npm_config_global: 'false',
    IDLEWATCH_INSTALL_MACOS_MENUBAR_ON_INSTALL: '',
    IDLEWATCH_LAUNCH_MENUBAR_ON_INSTALL: ''
  })

  assert.equal(run.status, 0, run.stderr)
  assert.equal(run.stdout.trim(), '')
})

test('postinstall can still print the setup handoff when explicitly requested', () => {
  const run = runPostinstall({
    npm_config_global: 'false',
    IDLEWATCH_POSTINSTALL_ALWAYS_PRINT: '1',
    IDLEWATCH_INSTALL_MACOS_MENUBAR_ON_INSTALL: '',
    IDLEWATCH_LAUNCH_MENUBAR_ON_INSTALL: ''
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /Set up this device:/)
  assert.match(run.stdout, /idlewatch quickstart --no-tui\n/)
  assert.doesNotMatch(run.stdout, /idlewatch quickstart\n/)
  assert.doesNotMatch(run.stdout, /plain text fallback/)
})
