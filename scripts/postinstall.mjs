#!/usr/bin/env node
import process from 'node:process'
import { installMenubarApp } from './install-macos-menubar.mjs'

function truthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

try {
  const shouldInstallMenubarApp = truthy(process.env.IDLEWATCH_INSTALL_MACOS_MENUBAR_ON_INSTALL)
  const shouldLaunch = truthy(process.env.IDLEWATCH_LAUNCH_MENUBAR_ON_INSTALL)

  if (shouldInstallMenubarApp) {
    installMenubarApp({ force: false, launch: shouldLaunch })
  }
} catch (error) {
  console.warn(`IdleWatch postinstall menubar setup skipped: ${error.message}`)
}

console.log('')
console.log('  Set up this device:')
console.log('    idlewatch quickstart --no-tui')
console.log('')
console.log('  Try it once:')
console.log('    npx idlewatch quickstart --no-tui')
console.log('')
console.log('  Optional on macOS:')
console.log('    idlewatch menubar')
console.log('')
