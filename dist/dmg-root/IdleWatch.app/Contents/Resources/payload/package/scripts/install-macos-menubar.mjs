#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pkg from '../package.json' with { type: 'json' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

function truthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function parseArgs(argv) {
  return new Set(argv)
}

function commandExists(command, args = ['--version']) {
  const result = spawnSync(command, args, { stdio: 'ignore' })
  return result.status === 0
}

function resolveInstallHome() {
  if (process.platform !== 'darwin') return os.homedir()
  if (typeof process.getuid !== 'function' || process.getuid() !== 0 || !process.env.SUDO_USER) {
    return os.homedir()
  }

  const lookup = spawnSync('/usr/bin/dscl', ['.', '-read', `/Users/${process.env.SUDO_USER}`, 'NFSHomeDirectory'], {
    encoding: 'utf8'
  })

  if (lookup.status === 0) {
    const match = lookup.stdout.match(/NFSHomeDirectory:\s*(.+)\s*$/m)
    if (match?.[1]) return match[1].trim()
  }

  return os.homedir()
}

function installMenubarApp({ force = false, launch = false } = {}) {
  if (process.platform !== 'darwin') return false

  const skipRequested = truthy(process.env.IDLEWATCH_SKIP_MACOS_MENUBAR_INSTALL)
  const globalInstall = truthy(process.env.npm_config_global)
  if (!force && (!globalInstall || skipRequested)) {
    return false
  }

  if (!commandExists('swiftc')) {
    console.warn('IdleWatch menubar install skipped: swiftc is not available on this Mac.')
    return false
  }

  const homeDir = resolveInstallHome()
  const appDir = path.resolve(process.env.IDLEWATCH_MACOS_APP_DIR || path.join(homeDir, 'Applications', 'IdleWatch.app'))
  fs.mkdirSync(path.dirname(appDir), { recursive: true })

  execFileSync(process.execPath, [
    path.join(ROOT_DIR, 'scripts', 'build-macos-menubar-app.mjs'),
    '--app-dir', appDir,
    '--version', pkg.version,
    '--package-root-mode', 'linked',
    '--linked-package-root', ROOT_DIR
  ], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  })

  if (launch) {
    spawnSync('/usr/bin/open', ['-gj', appDir], { stdio: 'ignore' })
  }

  console.log(`IdleWatch menubar app installed at ${appDir}`)
  return true
}

const args = parseArgs(process.argv.slice(2))
const force = args.has('--force')
const launch = args.has('--launch')

try {
  const installed = installMenubarApp({ force, launch })
  if (!installed && force) {
    console.log('IdleWatch menubar install skipped.')
  }
} catch (error) {
  console.error(`IdleWatch menubar install failed: ${error.message}`)
  process.exit(1)
}

export { installMenubarApp }
