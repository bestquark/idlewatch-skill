#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
APP_DIR="$DIST_DIR/IdleWatch.app"
CONTENTS_DIR="$APP_DIR/Contents"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
MACOS_DIR="$CONTENTS_DIR/MacOS"
VERSION="$(node -p "require('./package.json').version" 2>/dev/null || node -e "import('./package.json',{with:{type:'json'}}).then(m=>console.log(m.default.version))")"
SOURCE_GIT_COMMIT="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || true)"
SOURCE_GIT_DIRTY="false"
if [[ -n "$SOURCE_GIT_COMMIT" ]] && [[ -n "$(git -C "$ROOT_DIR" status --porcelain 2>/dev/null || true)" ]]; then
  SOURCE_GIT_DIRTY="true"
fi
CODESIGN_IDENTITY="${MACOS_CODESIGN_IDENTITY:-}"
REQUIRE_TRUSTED="${IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION:-0}"
NODE_RUNTIME_DIR="${IDLEWATCH_NODE_RUNTIME_DIR:-}"
OPENCLAW_BIN_HINT="${IDLEWATCH_OPENCLAW_BIN:-${IDLEWATCH_OPENCLAW_BIN_HINT:-}}"
ALLOW_UNSIGNED_TAG_RELEASE="${IDLEWATCH_ALLOW_UNSIGNED_TAG_RELEASE:-0}"

if [[ "$REQUIRE_TRUSTED" != "1" && "${GITHUB_ACTIONS:-}" == "true" ]]; then
  REF_NAME="${GITHUB_REF:-}"
  REF_TYPE="${GITHUB_REF_TYPE:-}"
  if [[ "$REF_TYPE" == "tag" || "$REF_NAME" == refs/tags/* ]]; then
    if [[ "$ALLOW_UNSIGNED_TAG_RELEASE" != "1" ]]; then
      REQUIRE_TRUSTED="1"
      echo "Detected CI tag build; enforcing trusted distribution requirements (set IDLEWATCH_ALLOW_UNSIGNED_TAG_RELEASE=1 to bypass intentionally)."
    fi
  fi
fi

if [[ "$REQUIRE_TRUSTED" == "1" && -z "$CODESIGN_IDENTITY" ]]; then
  echo "IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION=1 requires MACOS_CODESIGN_IDENTITY to be set." >&2
  exit 1
fi

rm -rf "$APP_DIR" "$DIST_DIR/dmg-root"
mkdir -p "$RESOURCES_DIR" "$MACOS_DIR"

pushd "$ROOT_DIR" >/dev/null
npm pack --silent >/dev/null
PKG_TGZ="$(ls -t idlewatch-skill-*.tgz | head -n1)"
cp "$PKG_TGZ" "$RESOURCES_DIR/"
PAYLOAD_DIR="$RESOURCES_DIR/payload"
rm -rf "$PAYLOAD_DIR"
mkdir -p "$PAYLOAD_DIR"
tar -xzf "$RESOURCES_DIR/$PKG_TGZ" -C "$PAYLOAD_DIR"

PAYLOAD_PKG_DIR="$PAYLOAD_DIR/package"
if [[ ! -f "$PAYLOAD_PKG_DIR/package.json" ]]; then
  echo "IdleWatch package payload missing package.json ($PAYLOAD_PKG_DIR/package.json)" >&2
  exit 1
fi

# Ensure runtime dependencies are present inside the packaged payload so DMG installs
# run without relying on workspace-level node_modules.
(
  cd "$PAYLOAD_PKG_DIR"

  # Prefer lockfile-based install when available for reproducible dependency snapshots.
  if [[ -f "$ROOT_DIR/package-lock.json" ]]; then
    cp "$ROOT_DIR/package-lock.json" package-lock.json
  fi

  if [[ -f package-lock.json ]]; then
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund --silent
  else
    npm install --omit=dev --ignore-scripts --no-audit --no-fund --silent
  fi
)

if [[ -n "$NODE_RUNTIME_DIR" ]]; then
  RUNTIME_NODE_BIN="$NODE_RUNTIME_DIR/bin/node"
  if [[ ! -x "$RUNTIME_NODE_BIN" ]]; then
    echo "IDLEWATCH_NODE_RUNTIME_DIR must contain an executable bin/node (missing: $RUNTIME_NODE_BIN)" >&2
    exit 1
  fi

  RUNTIME_DEST_DIR="$RESOURCES_DIR/runtime/node"
  rm -rf "$RUNTIME_DEST_DIR"
  mkdir -p "$(dirname "$RUNTIME_DEST_DIR")"
  # Copy essential runtime directories with symlink dereference so packaged runtime is portable even if host runtime is a symlink.
  # This avoids pulling in nonessential completion/doc symlink trees that can create copy noise.
  for runtimeDir in bin lib include; do
    if [[ -d "$NODE_RUNTIME_DIR/$runtimeDir" ]]; then
      mkdir -p "$RUNTIME_DEST_DIR/$runtimeDir"
      cp -R -L "$NODE_RUNTIME_DIR/$runtimeDir/" "$RUNTIME_DEST_DIR/$runtimeDir/"
    fi
  done
fi
NODE_RUNTIME_BUNDLED=false
SIGNED_ARTIFACT=false
if [[ -n "$NODE_RUNTIME_DIR" ]]; then
  NODE_RUNTIME_BUNDLED=true
fi
if [[ -n "$CODESIGN_IDENTITY" ]]; then
  SIGNED_ARTIFACT=true
fi

cat > "$RESOURCES_DIR/packaging-metadata.json" <<METADATA
{
  "name": "idlewatch-agent",
  "version": "${VERSION}",
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platform": "darwin",
  "bundleName": "IdleWatch.app",
  "nodeRuntimeBundled": ${NODE_RUNTIME_BUNDLED},
  "nodeRuntimeSource": "${NODE_RUNTIME_DIR:-}",
  "signed": ${SIGNED_ARTIFACT},
  "codesignIdentity": "${CODESIGN_IDENTITY:-}",
  "openclawBinHint": "${OPENCLAW_BIN_HINT:-}",
  "launcher": "Contents/MacOS/IdleWatch",
  "payloadTarball": "${PKG_TGZ}",
  "payloadNode": "$(node -v 2>/dev/null || echo unknown)",
  "sourceGitCommit": "${SOURCE_GIT_COMMIT}",
  "sourceGitDirty": ${SOURCE_GIT_DIRTY}
}
METADATA

cat > "$CONTENTS_DIR/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>IdleWatch</string>
  <key>CFBundleDisplayName</key><string>IdleWatch</string>
  <key>CFBundleIdentifier</key><string>com.idlewatch.agent</string>
  <key>CFBundleVersion</key><string>${VERSION}</string>
  <key>CFBundleShortVersionString</key><string>${VERSION}</string>
  <key>CFBundleExecutable</key><string>IdleWatch</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
</dict>
</plist>
PLIST

cat > "$MACOS_DIR/IdleWatch" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES_DIR="$(cd "$SCRIPT_DIR/../Resources" && pwd)"
NODE_BIN="${IDLEWATCH_NODE_BIN:-}"
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

# Backward-compatible OpenClaw launcher hint precedence:
# 1) IDLEWATCH_OPENCLAW_BIN  (runtime override)
# 2) IDLEWATCH_OPENCLAW_BIN_HINT (legacy launcher hint)
# 3) packaging metadata fallback (build-time hint)
OPENCLAW_BIN_HINT="${IDLEWATCH_OPENCLAW_BIN:-${IDLEWATCH_OPENCLAW_BIN_HINT:-}}"
if [[ -z "$OPENCLAW_BIN_HINT" && -f "$RESOURCES_DIR/packaging-metadata.json" ]]; then
  OPENCLAW_BIN_HINT="$($NODE_BIN -e 'const fs = require("fs"); const filePath = process.argv[1]; try { const data = JSON.parse(fs.readFileSync(filePath, "utf8")); const hint = data && data.openclawBinHint ? data.openclawBinHint : ""; if (hint) process.stdout.write(String(hint)); } catch (_) {}' "$RESOURCES_DIR/packaging-metadata.json")"
fi

if [[ -n "$OPENCLAW_BIN_HINT" && -x "$OPENCLAW_BIN_HINT" ]]; then
  export IDLEWATCH_OPENCLAW_BIN="$OPENCLAW_BIN_HINT"
elif [[ -n "$OPENCLAW_BIN_HINT" ]]; then
  echo "Warning: packaged OpenClaw binary hint is not executable at: $OPENCLAW_BIN_HINT" >&2
fi

PAYLOAD_BIN="$RESOURCES_DIR/payload/package/bin/idlewatch-agent.js"
if [[ ! -f "$PAYLOAD_BIN" ]]; then
  echo "IdleWatch package payload missing ($PAYLOAD_BIN)" >&2
  exit 1
fi

exec "$NODE_BIN" "$PAYLOAD_BIN" "$@"
SH
chmod +x "$MACOS_DIR/IdleWatch"

if [[ -n "$CODESIGN_IDENTITY" ]]; then
  echo "Codesigning IdleWatch.app with identity: $CODESIGN_IDENTITY"
  codesign --deep --force --options runtime --sign "$CODESIGN_IDENTITY" "$APP_DIR"
  codesign --verify --deep --strict "$APP_DIR"
else
  echo "MACOS_CODESIGN_IDENTITY not set; leaving app unsigned."
fi

mkdir -p "$DIST_DIR/dmg-root"
cp -R "$APP_DIR" "$DIST_DIR/dmg-root/"
ln -s /Applications "$DIST_DIR/dmg-root/Applications"

cat <<'EOF'
Mac app scaffold package complete.
Next steps:
  1) Test: ./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run
  2) Build DMG: ./scripts/build-dmg.sh
  3) Optional bundle runtime for node-less targets: export IDLEWATCH_NODE_RUNTIME_DIR="/path/to/node-runtime"
  4) Optional signing: export MACOS_CODESIGN_IDENTITY="Developer ID Application: ..." then rerun package-macos
  5) Optional notarize+staple DMG: set MACOS_NOTARY_PROFILE and rerun build-dmg
  6) Enforce trusted artifacts: export IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION=1
EOF

popd >/dev/null
