import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const INSTALL_SCRIPT = path.join(ROOT, 'scripts', 'install-macos-launch-agent.sh')
const UNINSTALL_SCRIPT = path.join(ROOT, 'scripts', 'uninstall-macos-launch-agent.sh')

function writeExecutable(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8')
  fs.chmodSync(filePath, 0o755)
}

test('packaged macOS launch-agent scripts keep background-mode wording calm', { skip: process.platform !== 'darwin' }, () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-home-'))
  const fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-bin-'))
  const fakeLaunchctl = path.join(fakeBinDir, 'launchctl')
  const fakeAppPath = path.join(tempHome, 'Applications', 'IdleWatch.app')
  const fakeAppBin = path.join(fakeAppPath, 'Contents', 'MacOS', 'IdleWatch')

  try {
    fs.mkdirSync(path.dirname(fakeAppBin), { recursive: true })
    writeExecutable(fakeAppBin, '#!/usr/bin/env bash\nexit 0\n')
    fs.mkdirSync(path.join(tempHome, '.idlewatch'), { recursive: true })
    fs.writeFileSync(path.join(tempHome, '.idlewatch', 'idlewatch.env'), 'IDLEWATCH_DEVICE_NAME=QA Box\n', 'utf8')

    writeExecutable(fakeLaunchctl, `#!/usr/bin/env bash
set -euo pipefail
cmd="\${1:-}"
state_dir="${tempHome}/.launchctl-state"
mkdir -p "$state_dir"
loaded_file="$state_dir/loaded"
if [[ "$cmd" == "print" ]]; then
  if [[ -f "$loaded_file" ]]; then
    exit 0
  fi
  exit 1
fi
if [[ "$cmd" == "bootstrap" || "$cmd" == "enable" ]]; then
  touch "$loaded_file"
  exit 0
fi
if [[ "$cmd" == "bootout" ]]; then
  rm -f "$loaded_file"
  exit 0
fi
exit 0
`)

    const env = {
      ...process.env,
      HOME: tempHome,
      PATH: `${fakeBinDir}:${process.env.PATH}`,
      IDLEWATCH_APP_PATH: fakeAppPath
    }

    const firstInstall = spawnSync('bash', [INSTALL_SCRIPT], { env, encoding: 'utf8', timeout: 15000 })
    assert.equal(firstInstall.status, 0, firstInstall.stderr)
    assert.match(firstInstall.stdout, /✅ Background mode installed\./)
    assert.match(firstInstall.stdout, /✓ Background mode will use this saved config\./)
    assert.doesNotMatch(firstInstall.stdout, /Background mode will auto-load this config\./)
    assert.doesNotMatch(firstInstall.stdout, /Login startup will auto-load this config\./)
    assert.match(firstInstall.stdout, /\n\s*Service:\s+gui\//)
    assert.doesNotMatch(firstInstall.stdout, /Installed LaunchAgent:/)
    assert.doesNotMatch(firstInstall.stdout, /LaunchAgent already loaded\./)

    const secondInstall = spawnSync('bash', [INSTALL_SCRIPT], { env, encoding: 'utf8', timeout: 15000 })
    assert.equal(secondInstall.status, 0, secondInstall.stderr)
    assert.match(secondInstall.stdout, /Background mode is already running\. Refreshing its configuration\./)
    assert.match(secondInstall.stdout, /✅ Background mode refreshed\./)
    assert.doesNotMatch(secondInstall.stdout, /LaunchAgent already loaded\./)

    const uninstall = spawnSync('bash', [UNINSTALL_SCRIPT], { env, encoding: 'utf8', timeout: 15000 })
    assert.equal(uninstall.status, 0, uninstall.stderr)
    assert.match(uninstall.stdout, /✅ Background mode turned off\./)
    assert.match(uninstall.stdout, /Logs stay in /)
    assert.match(uninstall.stdout, /Turn it back on:\s+idlewatch install-agent/)
    assert.doesNotMatch(uninstall.stdout, /Turn it back on:\s+\.\/scripts\/install-macos-launch-agent\.sh/)
    assert.doesNotMatch(uninstall.stdout, /Re-enable: /)
    assert.doesNotMatch(uninstall.stdout, /LaunchAgent logs were kept/)
  } finally {
    fs.rmSync(fakeBinDir, { recursive: true, force: true })
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
})

test('packaged macOS install script keeps the no-setup status hint config-first', { skip: process.platform !== 'darwin' }, () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-no-setup-home-'))
  const fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-no-setup-bin-'))
  const fakeLaunchctl = path.join(fakeBinDir, 'launchctl')
  const fakeAppPath = path.join(tempHome, 'Applications', 'IdleWatch.app')
  const fakeAppBin = path.join(fakeAppPath, 'Contents', 'MacOS', 'IdleWatch')

  try {
    fs.mkdirSync(path.dirname(fakeAppBin), { recursive: true })
    writeExecutable(fakeAppBin, '#!/usr/bin/env bash\nexit 0\n')
    writeExecutable(fakeLaunchctl, '#!/usr/bin/env bash\nexit 0\n')
    writeExecutable(path.join(fakeBinDir, 'idlewatch'), '#!/usr/bin/env bash\nexit 0\n')

    const env = {
      ...process.env,
      HOME: tempHome,
      PATH: `${fakeBinDir}:${process.env.PATH}`,
      IDLEWATCH_APP_PATH: fakeAppPath
    }

    const install = spawnSync('bash', [INSTALL_SCRIPT], { env, encoding: 'utf8', timeout: 15000 })
    assert.equal(install.status, 0, install.stderr)
    assert.match(install.stdout, /Setup is not finished yet, so background mode stays off for now\./)
    assert.match(install.stdout, /\bidlewatch quickstart --no-tui\b/)
    assert.match(install.stdout, /Turn on background mode:\s+idlewatch install-agent/)
    assert.doesNotMatch(install.stdout, /Then turn on background mode:\s+idlewatch install-agent/)
    assert.doesNotMatch(install.stdout, /Contents\/MacOS\/IdleWatch quickstart --no-tui/)
    assert.match(install.stdout, /quickstart --no-tui/)
    assert.doesNotMatch(install.stdout, /\bidlewatch quickstart\b(?! --no-tui)/)
    assert.doesNotMatch(install.stdout, /\bquickstart\b(?! --no-tui)/)
    assert.match(install.stdout, /Run 'idlewatch status' to see your saved config, background mode state, and last publish result\./)
    assert.doesNotMatch(install.stdout, /device state, metrics enabled/)
  } finally {
    fs.rmSync(fakeBinDir, { recursive: true, force: true })
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
})

test('packaged macOS install script shows the exact refresh command when idlewatch is not on PATH yet', { skip: process.platform !== 'darwin' }, () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-no-cli-home-'))
  const fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-no-cli-bin-'))
  const fakeLaunchctl = path.join(fakeBinDir, 'launchctl')
  const fakeAppPath = path.join(tempHome, 'Applications', 'IdleWatch.app')
  const fakeAppBin = path.join(fakeAppPath, 'Contents', 'MacOS', 'IdleWatch')

  try {
    fs.mkdirSync(path.dirname(fakeAppBin), { recursive: true })
    writeExecutable(fakeAppBin, '#!/usr/bin/env bash\nexit 0\n')
    writeExecutable(fakeLaunchctl, '#!/usr/bin/env bash\nexit 0\n')

    const env = {
      ...process.env,
      HOME: tempHome,
      PATH: `${fakeBinDir}:/usr/bin:/bin:/usr/sbin:/sbin`,
      IDLEWATCH_APP_PATH: fakeAppPath
    }

    const install = spawnSync('bash', [INSTALL_SCRIPT], { env, encoding: 'utf8', timeout: 15000 })
    assert.equal(install.status, 0, install.stderr)
    assert.match(install.stdout, /Turn on background mode:\s+.*Contents\/MacOS\/IdleWatch install-agent/)
    assert.doesNotMatch(install.stdout, /Then turn on background mode:\s+.*Contents\/MacOS\/IdleWatch install-agent/)
    assert.doesNotMatch(install.stdout, /Then run this install script again to turn on login startup with the saved config\./)
  } finally {
    fs.rmSync(fakeBinDir, { recursive: true, force: true })
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
})

test('packaged macOS install script preserves special characters in plist paths', { skip: process.platform !== 'darwin' }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-special-root-'))
  const tempHome = path.join(tempRoot, 'QA & Logs Home')
  const fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-special-bin-'))
  const fakeLaunchctl = path.join(fakeBinDir, 'launchctl')
  const fakeAppPath = path.join(tempHome, 'Applications', 'IdleWatch.app')
  const fakeAppBin = path.join(fakeAppPath, 'Contents', 'MacOS', 'IdleWatch')

  try {
    fs.mkdirSync(path.dirname(fakeAppBin), { recursive: true })
    writeExecutable(fakeAppBin, '#!/usr/bin/env bash\nexit 0\n')
    fs.mkdirSync(path.join(tempHome, '.idlewatch'), { recursive: true })
    fs.writeFileSync(path.join(tempHome, '.idlewatch', 'idlewatch.env'), 'IDLEWATCH_DEVICE_NAME=QA Box\n', 'utf8')
    writeExecutable(fakeLaunchctl, '#!/usr/bin/env bash\nexit 0\n')

    const env = {
      ...process.env,
      HOME: tempHome,
      PATH: `${fakeBinDir}:${process.env.PATH}`,
      IDLEWATCH_LAUNCH_AGENT_LOG_DIR: path.join(tempHome, 'Library', 'Logs', 'IdleWatch & QA')
    }

    const install = spawnSync('bash', [INSTALL_SCRIPT], { env, encoding: 'utf8', timeout: 15000 })
    assert.equal(install.status, 0, install.stderr)

    const plistPath = path.join(tempHome, 'Library', 'LaunchAgents', 'com.idlewatch.agent.plist')
    const plist = fs.readFileSync(plistPath, 'utf8')
    assert.match(plist, /<string>com.idlewatch.agent<\/string>/)
    assert.match(plist, /<string>.*QA &amp; Logs Home\/Applications\/IdleWatch\.app\/Contents\/MacOS\/IdleWatch<\/string>/)
    assert.match(plist, /<string>.*Library\/Logs\/IdleWatch &amp; QA\/idlewatch\.out\.log<\/string>/)
  } finally {
    fs.rmSync(fakeBinDir, { recursive: true, force: true })
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('packaged macOS install script keeps the default-label collision warning on background-mode wording', { skip: process.platform !== 'darwin' }, () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-default-label-home-'))
  const fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-default-label-bin-'))
  const fakeLaunchctl = path.join(fakeBinDir, 'launchctl')
  const fakeAppPath = path.join(tempHome, 'IdleWatch QA.app')
  const fakeAppBin = path.join(fakeAppPath, 'Contents', 'MacOS', 'IdleWatch')

  try {
    fs.mkdirSync(path.dirname(fakeAppBin), { recursive: true })
    writeExecutable(fakeAppBin, '#!/usr/bin/env bash\nexit 0\n')
    writeExecutable(fakeLaunchctl, '#!/usr/bin/env bash\nexit 0\n')

    const env = {
      ...process.env,
      HOME: tempHome,
      PATH: `${fakeBinDir}:${process.env.PATH}`,
      IDLEWATCH_APP_PATH: fakeAppPath
    }

    const install = spawnSync('bash', [INSTALL_SCRIPT], { env, encoding: 'utf8', timeout: 15000 })
    assert.equal(install.status, 1)
    assert.match(install.stderr, /Refusing to reuse the default background-mode label \(com\.idlewatch\.agent\) with a custom app path or plist root\./)
    assert.match(install.stderr, /That could replace another IdleWatch background-mode install that already uses the default label\./)
    assert.doesNotMatch(install.stderr, /launchd uses the label as the real identity/)
    assert.doesNotMatch(install.stderr, /already-loaded IdleWatch agent/)
  } finally {
    fs.rmSync(fakeBinDir, { recursive: true, force: true })
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
})

test('packaged macOS install script uses a configured custom saved-config path', { skip: process.platform !== 'darwin' }, () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-custom-install-home-'))
  const fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-custom-install-bin-'))
  const fakeLaunchctl = path.join(fakeBinDir, 'launchctl')
  const fakeAppPath = path.join(tempHome, 'Applications', 'IdleWatch.app')
  const fakeAppBin = path.join(fakeAppPath, 'Contents', 'MacOS', 'IdleWatch')
  const customConfigPath = path.join(tempHome, 'Library', 'Application Support', 'IdleWatch QA', 'idlewatch.env')

  try {
    fs.mkdirSync(path.dirname(fakeAppBin), { recursive: true })
    writeExecutable(fakeAppBin, '#!/usr/bin/env bash\nexit 0\n')
    writeExecutable(fakeLaunchctl, '#!/usr/bin/env bash\nexit 0\n')
    fs.mkdirSync(path.dirname(customConfigPath), { recursive: true })
    fs.writeFileSync(customConfigPath, 'IDLEWATCH_DEVICE_NAME=QA Box\n', 'utf8')

    const env = {
      ...process.env,
      HOME: tempHome,
      PATH: `${fakeBinDir}:${process.env.PATH}`,
      IDLEWATCH_APP_PATH: fakeAppPath,
      IDLEWATCH_CONFIG_ENV_PATH: customConfigPath
    }

    const install = spawnSync('bash', [INSTALL_SCRIPT], { env, encoding: 'utf8', timeout: 15000 })
    assert.equal(install.status, 0, install.stderr)
    assert.match(install.stdout, new RegExp(`Saved IdleWatch config found: ${customConfigPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    assert.match(install.stdout, /✓ Background mode will use this saved config\./)
    assert.doesNotMatch(install.stdout, /default saved config path/)
    assert.doesNotMatch(install.stdout, /Move or copy to that location for background mode\./)

    const plistPath = path.join(tempHome, 'Library', 'LaunchAgents', 'com.idlewatch.agent.plist')
    const plist = fs.readFileSync(plistPath, 'utf8')
    assert.match(plist, /<key>IDLEWATCH_CONFIG_ENV_PATH<\/key>/)
    assert.match(plist, new RegExp(`<string>${customConfigPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;')}</string>`))
  } finally {
    fs.rmSync(fakeBinDir, { recursive: true, force: true })
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
})

test('packaged macOS uninstall script names a custom saved config path when one is configured', { skip: process.platform !== 'darwin' }, () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-custom-config-home-'))
  const fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-macos-launch-agent-custom-config-bin-'))
  const fakeLaunchctl = path.join(fakeBinDir, 'launchctl')
  const fakeAppPath = path.join(tempHome, 'Applications', 'IdleWatch.app')
  const fakeAppBin = path.join(fakeAppPath, 'Contents', 'MacOS', 'IdleWatch')
  const customConfigPath = path.join(tempHome, 'Library', 'Application Support', 'IdleWatch QA', 'idlewatch.env')

  try {
    fs.mkdirSync(path.dirname(fakeAppBin), { recursive: true })
    writeExecutable(fakeAppBin, '#!/usr/bin/env bash\nexit 0\n')
    writeExecutable(fakeLaunchctl, '#!/usr/bin/env bash\nexit 0\n')
    fs.mkdirSync(path.dirname(customConfigPath), { recursive: true })
    fs.writeFileSync(customConfigPath, 'IDLEWATCH_DEVICE_NAME=QA Box\n', 'utf8')

    const env = {
      ...process.env,
      HOME: tempHome,
      PATH: `${fakeBinDir}:${process.env.PATH}`,
      IDLEWATCH_APP_PATH: fakeAppPath,
      IDLEWATCH_CONFIG_ENV_PATH: customConfigPath
    }

    const uninstall = spawnSync('bash', [UNINSTALL_SCRIPT], { env, encoding: 'utf8', timeout: 15000 })
    assert.equal(uninstall.status, 0, uninstall.stderr)
    assert.match(uninstall.stdout, new RegExp(`Saved config stays at ${customConfigPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    assert.doesNotMatch(uninstall.stdout, /Saved config stays at .*\.idlewatch\/idlewatch\.env/)
  } finally {
    fs.rmSync(fakeBinDir, { recursive: true, force: true })
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
})
