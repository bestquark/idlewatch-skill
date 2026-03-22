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
SOURCE_GIT_DIRTY_KNOWN="false"
if [[ -n "$SOURCE_GIT_COMMIT" ]]; then
  if git -C "$ROOT_DIR" diff --quiet --ignore-submodules -- . && [[ -z "$(git -C "$ROOT_DIR" status --porcelain 2>/dev/null || true)" ]]; then
    SOURCE_GIT_DIRTY_KNOWN="true"
    SOURCE_GIT_DIRTY="false"
  else
    SOURCE_GIT_DIRTY_KNOWN="true"
    SOURCE_GIT_DIRTY="true"
  fi
fi
CODESIGN_IDENTITY="${MACOS_CODESIGN_IDENTITY:-}"
REQUIRE_TRUSTED="${IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION:-0}"
NODE_RUNTIME_DIR="${IDLEWATCH_NODE_RUNTIME_DIR:-}"
OPENCLAW_BIN_HINT="${IDLEWATCH_OPENCLAW_BIN:-${IDLEWATCH_OPENCLAW_BIN_HINT:-}}"
ALLOW_UNSIGNED_TAG_RELEASE="${IDLEWATCH_ALLOW_UNSIGNED_TAG_RELEASE:-0}"
SKIP_SOURCEMAP_VALIDATION="${IDLEWATCH_SKIP_SOURCEMAP_VALIDATION:-0}"

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
TMP_PACK_INFO="$(mktemp)"
npm pack --silent --json >"$TMP_PACK_INFO"
PKG_TGZ="$(node -e 'const fs = require("fs"); const txt = fs.readFileSync(0, "utf8"); let data = null; try { data = JSON.parse(txt.trim()); } catch { process.exit(1) } const entry = Array.isArray(data) ? data[0] : data; const filename = entry && (entry.filename || entry.name); if (!filename) process.exit(1); process.stdout.write(String(filename));' <"$TMP_PACK_INFO")"
rm -f "$TMP_PACK_INFO"
cp "$PKG_TGZ" "$RESOURCES_DIR/"
PAYLOAD_DIR="$RESOURCES_DIR/payload"
rm -rf "$PAYLOAD_DIR"
mkdir -p "$PAYLOAD_DIR"
tar -xzf "$RESOURCES_DIR/$PKG_TGZ" -C "$PAYLOAD_DIR"
rm -f "$PKG_TGZ"

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

if [[ "$SKIP_SOURCEMAP_VALIDATION" != "1" ]]; then
  node "$ROOT_DIR/scripts/validate-packaged-sourcemaps.mjs" "$PAYLOAD_PKG_DIR"
fi

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
  "sourceGitDirty": ${SOURCE_GIT_DIRTY},
  "sourceGitDirtyKnown": ${SOURCE_GIT_DIRTY_KNOWN}
}
METADATA

node "$ROOT_DIR/scripts/build-macos-menubar-app.mjs" \
  --app-dir "$APP_DIR" \
  --version "$VERSION" \
  --package-root-mode embedded \
  --openclaw-bin-hint "$OPENCLAW_BIN_HINT"

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
