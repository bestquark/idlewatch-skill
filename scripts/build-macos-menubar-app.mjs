#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const parsed = new Map()
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[index + 1]
    if (next == null || next.startsWith('--')) {
      parsed.set(key, '1')
      continue
    }
    parsed.set(key, next)
    index += 1
  }
  return parsed
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function requireArg(args, key) {
  const value = String(args.get(key) || '').trim()
  if (!value) fail(`Missing --${key}`)
  return value
}

function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

const args = parseArgs(process.argv.slice(2))
const appDir = path.resolve(requireArg(args, 'app-dir'))
const version = requireArg(args, 'version')
const packageRootMode = String(args.get('package-root-mode') || 'embedded').trim().toLowerCase()
const linkedPackageRoot = String(args.get('linked-package-root') || '').trim()
const bundleId = String(args.get('bundle-id') || 'com.idlewatch.agent').trim()
const displayName = String(args.get('display-name') || 'IdleWatch').trim() || 'IdleWatch'
const openclawBinHint = String(args.get('openclaw-bin-hint') || '').trim()

if (!['embedded', 'linked'].includes(packageRootMode)) {
  fail(`Invalid --package-root-mode: ${packageRootMode}. Expected embedded or linked.`)
}

if (packageRootMode === 'linked' && !linkedPackageRoot) {
  fail('--linked-package-root is required when --package-root-mode=linked')
}

const swiftSource = path.join(ROOT_DIR, 'macos', 'IdleWatchMenuBar.swift')
if (!fs.existsSync(swiftSource)) {
  fail(`Missing Swift source: ${swiftSource}`)
}

const contentsDir = path.join(appDir, 'Contents')
const resourcesDir = path.join(contentsDir, 'Resources')
const macosDir = path.join(contentsDir, 'MacOS')
const menuBinary = path.join(macosDir, 'IdleWatchMenuBar')
const launcherPath = path.join(macosDir, 'IdleWatch')
const menuMetadataPath = path.join(resourcesDir, 'menubar-metadata.json')

fs.mkdirSync(resourcesDir, { recursive: true })
fs.mkdirSync(macosDir, { recursive: true })

try {
  execFileSync('swiftc', ['-parse-as-library', '-O', '-framework', 'AppKit', swiftSource, '-o', menuBinary], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  })
} catch (error) {
  fail(`swiftc failed while building IdleWatch menubar app: ${error.message}`)
}

const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${displayName}</string>
  <key>CFBundleDisplayName</key><string>${displayName}</string>
  <key>CFBundleIdentifier</key><string>${bundleId}</string>
  <key>CFBundleVersion</key><string>${version}</string>
  <key>CFBundleShortVersionString</key><string>${version}</string>
  <key>CFBundleExecutable</key><string>IdleWatch</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
`
fs.writeFileSync(path.join(contentsDir, 'Info.plist'), infoPlist, 'utf8')

const packageRootLine = packageRootMode === 'embedded'
  ? 'PACKAGE_ROOT="$RESOURCES_DIR/payload/package"'
  : `PACKAGE_ROOT=${shellSingleQuote(path.resolve(linkedPackageRoot))}`

const launcherScript = `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES_DIR="$(cd "$SCRIPT_DIR/../Resources" && pwd)"

if [[ "$#" -eq 0 ]]; then
  exec "$SCRIPT_DIR/IdleWatchMenuBar"
fi

NODE_BIN="\${IDLEWATCH_NODE_BIN:-}"
if [[ -z "$NODE_BIN" ]]; then
  BUNDLED_NODE_BIN="$RESOURCES_DIR/runtime/node/bin/node"
  if [[ -x "$BUNDLED_NODE_BIN" ]]; then
    NODE_BIN="$BUNDLED_NODE_BIN"
  else
    NODE_BIN="$(command -v node || true)"
  fi
fi

if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "IdleWatch requires Node.js 20+ (node binary not found). Install Node.js or set IDLEWATCH_NODE_BIN and retry." >&2
  exit 1
fi

NODE_MAJOR="$($NODE_BIN -p "process.versions.node.split('.')[0]" 2>/dev/null || echo "")"
if [[ -z "$NODE_MAJOR" || "$NODE_MAJOR" -lt 20 ]]; then
  NODE_VERSION="$($NODE_BIN -v 2>/dev/null || echo "unknown")"
  echo "IdleWatch requires Node.js 20+ (found $NODE_VERSION at $NODE_BIN). Upgrade Node.js or set IDLEWATCH_NODE_BIN to a compatible runtime." >&2
  exit 1
fi

${packageRootLine}
OPENCLAW_BIN_HINT_DEFAULT=${shellSingleQuote(openclawBinHint)}
OPENCLAW_BIN_HINT="\${IDLEWATCH_OPENCLAW_BIN:-\${IDLEWATCH_OPENCLAW_BIN_HINT:-$OPENCLAW_BIN_HINT_DEFAULT}}"
if [[ -z "$OPENCLAW_BIN_HINT" && -f "$RESOURCES_DIR/packaging-metadata.json" ]]; then
  OPENCLAW_BIN_HINT="$($NODE_BIN -e 'const fs = require("fs"); const filePath = process.argv[1]; try { const data = JSON.parse(fs.readFileSync(filePath, "utf8")); const hint = data && data.openclawBinHint ? data.openclawBinHint : ""; if (hint) process.stdout.write(String(hint)); } catch (_) {}' "$RESOURCES_DIR/packaging-metadata.json")"
fi

if [[ -n "$OPENCLAW_BIN_HINT" && -x "$OPENCLAW_BIN_HINT" ]]; then
  export IDLEWATCH_OPENCLAW_BIN="$OPENCLAW_BIN_HINT"
elif [[ -n "$OPENCLAW_BIN_HINT" ]]; then
  echo "Warning: packaged OpenClaw binary hint is not executable at: $OPENCLAW_BIN_HINT" >&2
fi

PAYLOAD_BIN="$PACKAGE_ROOT/bin/idlewatch-agent.js"
if [[ ! -f "$PAYLOAD_BIN" ]]; then
  echo "IdleWatch package payload missing ($PAYLOAD_BIN)" >&2
  exit 1
fi

exec "$NODE_BIN" "$PAYLOAD_BIN" "$@"
`

fs.writeFileSync(launcherPath, launcherScript, { encoding: 'utf8', mode: 0o755 })

fs.writeFileSync(menuMetadataPath, `${JSON.stringify({
  builtAt: new Date().toISOString(),
  version,
  packageRootMode,
  linkedPackageRoot: packageRootMode === 'linked' ? path.resolve(linkedPackageRoot) : null
}, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 })

console.log(`IdleWatch menubar app scaffold ready: ${appDir}`)
