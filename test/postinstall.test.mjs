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
  assert.match(run.stdout, /idlewatch quickstart/)
  assert.doesNotMatch(run.stdout, /global install:/)
  assert.doesNotMatch(run.stdout, /packaged app:/)
})

test('postinstall keeps the opt-in menubar install hint short', () => {
  const run = runPostinstall({
    IDLEWATCH_INSTALL_MACOS_MENUBAR_ON_INSTALL: '',
    IDLEWATCH_LAUNCH_MENUBAR_ON_INSTALL: ''
  })

  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /Other install paths:/)
  assert.match(run.stdout, /npx idlewatch quickstart/)
  assert.match(run.stdout, /IDLEWATCH_INSTALL_MACOS_MENUBAR_ON_INSTALL=1 npm install -g idlewatch/)
})
