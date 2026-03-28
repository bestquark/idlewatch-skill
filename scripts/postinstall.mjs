#!/usr/bin/env node
import process from 'node:process'
import { installMenubarApp } from './install-macos-menubar.mjs'

function truthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function shouldPrintInstallHandoff() {
  if (truthy(process.env.IDLEWATCH_POSTINSTALL_ALWAYS_PRINT)) return true
  return truthy(process.env.npm_config_global)
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

if (shouldPrintInstallHandoff()) {
  console.log('')
  console.log('  Set up this device:')
  console.log('    idlewatch quickstart')
  console.log('    idlewatch quickstart --no-tui   # plain text fallback')
  console.log('')
  console.log('  Optional on macOS:')
  console.log('    idlewatch install-agent   # turn on background mode')
  console.log('    idlewatch menubar         # menu bar app')
  console.log('')
}
