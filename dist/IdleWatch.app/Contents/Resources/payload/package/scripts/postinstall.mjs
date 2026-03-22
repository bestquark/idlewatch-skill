#!/usr/bin/env node
import process from 'node:process'
import { installMenubarApp } from './install-macos-menubar.mjs'

function truthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

try {
  const shouldLaunch = truthy(process.env.IDLEWATCH_LAUNCH_MENUBAR_ON_INSTALL)
  installMenubarApp({ force: false, launch: shouldLaunch })
} catch (error) {
  console.warn(`IdleWatch postinstall menubar setup skipped: ${error.message}`)
}
