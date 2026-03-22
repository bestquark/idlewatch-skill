#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const repoRoot = process.cwd()

const RELEASE_GATE_TIMEOUT_MS = process.env.IDLEWATCH_DRY_RUN_TIMEOUT_MS || '60000'

function shouldRequireOpenClaw(rawValue) {
  const raw = String(rawValue ?? '1').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes') return true
  return true
}

function runValidator(name, extraEnv = {}) {
  const requireOpenClawUsage = shouldRequireOpenClaw(process.env.IDLEWATCH_REQUIRE_OPENCLAW_USAGE)
  const requireOpenClaw = requireOpenClawUsage ? '1' : '0'

  const result = spawnSync('npm', ['run', name, '--silent'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: {
      ...process.env,
      IDLEWATCH_REQUIRE_OPENCLAW_USAGE: requireOpenClaw,
      IDLEWATCH_DRY_RUN_TIMEOUT_MS: RELEASE_GATE_TIMEOUT_MS,
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
  runValidator('validate:openclaw-usage-health')
  runValidator('validate:openclaw-stats-ingestion')
  runValidator('validate:openclaw-cache-recovery-e2e')

  console.log('validate-openclaw-release-gates: ok (host OpenClaw checks for usage-health, stats fallback, and stale-cache recovery)')
}

main()
