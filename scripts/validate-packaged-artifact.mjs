#!/usr/bin/env node
import { accessSync, constants, readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const rootDir = process.cwd()
const artifactDir = process.env.IDLEWATCH_ARTIFACT_DIR?.trim()
  ? process.env.IDLEWATCH_ARTIFACT_DIR.trim()
  : join(rootDir, 'dist', 'IdleWatch.app')
const artifactPath = join(artifactDir, 'Contents', 'MacOS', 'IdleWatch')
const metadataPath = join(artifactDir, 'Contents', 'Resources', 'packaging-metadata.json')

function fail(message) {
  console.error(message)
  process.exit(1)
}

function shouldRequireGitMatch(value) {
  const normalized = String(value ?? '1').trim().toLowerCase()
  if (['0', 'false', 'off', 'no'].includes(normalized)) return false
  return true
}

function shouldRequireBundledRuntime(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['1', 'true', 'on', 'yes'].includes(normalized)
}

function parseBoolean(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['1', 'true', 'on', 'yes'].includes(normalized)) return true
  if (['0', 'false', 'off', 'no'].includes(normalized)) return false
  return null
}

function readCurrentCommit() {
  try {
    const value = execSync('git rev-parse HEAD', {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()

    return value
  } catch {
    return ''
  }
}

function readCurrentWorkingTreeClean() {
  try {
    const porcelain = execSync('git status --porcelain', {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()

    return porcelain.length === 0
  } catch {
    return null
  }
}

function resolveSourceCommit(metadata) {
  const value = metadata?.sourceGitCommit
  if (typeof value !== 'string') return ''
  return value.trim()
}

function shouldAllowLegacyCommitMetadata(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['1', 'true', 'on', 'yes', 'allow'].includes(normalized)
}

function validateMetadataConsistency(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    fail(`Malformed packaging metadata at ${metadataPath}`)
  }

  if (typeof metadata.version !== 'string' || !metadata.version.trim()) {
    fail(`Packaging metadata is missing a valid version: ${metadataPath}`)
  }

  const requireNodeRuntime = shouldRequireBundledRuntime(process.env.IDLEWATCH_REQUIRE_NODE_RUNTIME_BUNDLED)
  if (requireNodeRuntime && !parseBoolean(metadata.nodeRuntimeBundled)) {
    console.error('Packaged artifact is not marked as bundled-runtime aware. Rebuild before reuse-mode validation:')
    console.error('  npm run package:macos')
    fail('Rebuild artifact first (bundled-runtime metadata check failed).')
  }
}

function validateSourceCommit(metadata, currentCommit) {
  const requireSourceMatch = shouldRequireGitMatch(process.env.IDLEWATCH_REQUIRE_SOURCE_COMMIT_MATCH)
  if (!requireSourceMatch) return

  const sourceCommit = resolveSourceCommit(metadata)
  if (!currentCommit) {
    return
  }

  if (!sourceCommit) {
    console.error('Reusable packaged artifact is missing sourceGitCommit provenance.')
    console.error('Rebuild artifact before strict commit-matching reuse checks:')
    console.error('  npm run package:macos')

    if (shouldAllowLegacyCommitMetadata(process.env.IDLEWATCH_ALLOW_LEGACY_SOURCE_GIT_COMMIT)) {
      console.error('Continuing with legacy compatibility mode (non-strict).')
      console.error('Disable this path in strict runs via setting: IDLEWATCH_ALLOW_LEGACY_SOURCE_GIT_COMMIT=0 (or unset).')
      return
    }

    fail('Rebuilt artifact is required for strict source-commit validation: sourceGitCommit is missing.')
  }

  if (sourceCommit !== currentCommit) {
    console.error('Reused packaged artifact is stale for this workspace revision.')
    console.error(`Current commit : ${currentCommit}`)
    console.error(`Packaged commit: ${sourceCommit}`)
    console.error('Rebuild artifact first:')
    console.error('  npm run package:macos')
    fail('Packaged artifact is stale and does not match current git revision.')
  }
}

function shouldAllowLegacyDirtyMetadata(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['1', 'true', 'on', 'yes', 'allow'].includes(normalized)
}

function validateSourceDirty(metadata, currentIsClean) {
  if (!metadata || typeof metadata !== 'object' || currentIsClean === null) return

  const requireDirtyMatch = shouldRequireGitMatch(process.env.IDLEWATCH_REQUIRE_SOURCE_DIRTY_MATCH)
  if (!requireDirtyMatch) return

  const dirtyKnown = metadata?.sourceGitDirtyKnown === true
  const dirtyValue = metadata.sourceGitDirty

  if (!dirtyKnown) {
    if (typeof dirtyValue === 'boolean') {
      console.error('Reusable packaged artifact did not reliably record dirty-state confidence at build time.')
      console.error('Build metadata reported sourceGitDirty=' + dirtyValue + ' but sourceGitDirtyKnown is not true.')
    } else {
      console.error('Reusable packaged artifact did not record sourceGitDirty provenance.')
    }

    if (shouldAllowLegacyDirtyMetadata(process.env.IDLEWATCH_ALLOW_LEGACY_SOURCE_GIT_DIRTY)) {
      console.error('Continuing with legacy compatibility mode (non-strict).')
      console.error('Disable this path in strict runs via setting: IDLEWATCH_ALLOW_LEGACY_SOURCE_GIT_DIRTY=0 (or unset).')
      console.error('Rebuild artifact for strict dirty-state reuse validation:')
      console.error('  npm run package:macos')
      return
    }

    console.error('Rebuilt artifact is required for strict dirty-state reuse validation.')
    console.error('  npm run package:macos')
    fail('Rebuilt artifact is required for dirty-state validation; sourceGitDirtyKnown is missing.')
  }

  const metadataWasClean = parseBoolean(dirtyValue)
  if (metadataWasClean === null) {
    console.error('Reusable packaged artifact has non-boolean sourceGitDirty metadata; rebuild with latest packaging script for strict dirty-state checks.')
    if (shouldAllowLegacyDirtyMetadata(process.env.IDLEWATCH_ALLOW_LEGACY_SOURCE_GIT_DIRTY)) {
      console.error('Continuing with legacy compatibility mode (non-strict).')
      console.error('Disable this path in strict runs via setting: IDLEWATCH_ALLOW_LEGACY_SOURCE_GIT_DIRTY=0 (or unset).')
      return
    }

    fail('Rebuild artifact first: sourceGitDirty must be boolean for strict dirty-state checks.')
  }

  if (currentIsClean !== metadataWasClean) {
    console.error('Reusable packaged artifact dirty-state does not match current workspace clean-state.')
    console.error(`Current working tree clean: ${currentIsClean}`)
    console.error(`Packaged artifact built with clean workspace: ${metadataWasClean}`)
    fail('Rebuild artifact first: dirty-state mismatch for reusable artifact.')
  }
}


function validateFreshness(metadata) {
  const maxAgeMs = Number(process.env.IDLEWATCH_PACKAGED_ARTIFACT_MAX_AGE_MS || '')
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return

  const parsedBuiltAt = Date.parse(metadata?.builtAt)
  if (Number.isNaN(parsedBuiltAt)) {
    console.error('packaging metadata is missing a parseable builtAt field; skipping age validation.')
    return
  }

  const ageMs = Date.now() - parsedBuiltAt
  if (ageMs > maxAgeMs) {
    console.error(`Packaged artifact age ${ageMs}ms exceeds max ${maxAgeMs}ms.`)
    console.error(`Artifact builtAt : ${metadata?.builtAt}`)
    fail('Rebuild artifact first: age policy exceeded for reusable packaged artifact.')
  }
}

function main() {
  if (!existsSync(metadataPath)) {
    fail(`Missing packaged metadata file: ${metadataPath}`)
  }

  let metadata
  try {
    metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
  } catch (error) {
    fail(`Failed to parse packaging metadata at ${metadataPath}: ${error?.message || error}`)
  }

  if (!existsSync(artifactPath)) {
    fail(`Packaged launcher missing: ${artifactPath}`)
  }

  try {
    accessSync(artifactPath, constants.X_OK)
  } catch {
    fail(`Packaged launcher is not executable: ${artifactPath}`)
  }

  validateMetadataConsistency(metadata)
  const currentCommit = readCurrentCommit()
  const currentIsClean = readCurrentWorkingTreeClean()
  validateSourceCommit(metadata, currentCommit)
  validateSourceDirty(metadata, currentIsClean)
  validateFreshness(metadata)

  console.log('packaged artifact reusable validation ok')
  console.log(`artifact: ${artifactPath}`)
  if (metadata.version) console.log(`artifact version: ${metadata.version}`)
}

main()
