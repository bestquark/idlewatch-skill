#!/usr/bin/env node
import { existsSync, accessSync, constants } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = process.cwd()
const appPath = join(repoRoot, 'dist', 'IdleWatch.app', 'Contents', 'MacOS', 'IdleWatch')

function ensureReleaseArtifact() {
  if (!existsSync(appPath)) {
    console.error(`Missing packaged app launcher at ${appPath}`)
    console.error('Run npm run package:macos --silent before running trusted release gates.')
    process.exit(1)
  }

  try {
    accessSync(appPath, constants.X_OK)
  } catch {
    console.error(`Packaged launcher is not executable: ${appPath}`)
    process.exit(1)
  }
}

function runValidator(name, extraEnv = {}) {
  const result = spawnSync('npm', ['run', name, '--silent'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: {
      ...process.env,
      IDLEWATCH_SKIP_PACKAGE_MACOS: '1',
      ...extraEnv
    }
  })

  const out = String(result.stdout || '') + String(result.stderr || '')
  if (result.status !== 0) {
    if (out.trim()) {
      console.error(out.trim())
    }
    console.error(`Validator ${name} failed with exit code ${result.status}`)
    process.exit(result.status)
  }

  process.stdout.write(out)
}

function main() {
  ensureReleaseArtifact()

  runValidator('validate:packaged-usage-health')
  runValidator('validate:packaged-openclaw-stats-ingestion')
  runValidator('validate:packaged-openclaw-cache-recovery-e2e')

  console.log('validate-packaged-openclaw-release-gates: ok (release artifact validates OpenClaw health, stats fallback, and cache recovery)')
}

main()
