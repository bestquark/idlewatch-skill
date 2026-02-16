#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
APP_DIR="$DIST_DIR/IdleWatch.app"
CONTENTS_DIR="$APP_DIR/Contents"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
MACOS_DIR="$CONTENTS_DIR/MacOS"
VERSION="$(node -p "require('./package.json').version" 2>/dev/null || node -e "import('./package.json',{with:{type:'json'}}).then(m=>console.log(m.default.version))")"
CODESIGN_IDENTITY="${MACOS_CODESIGN_IDENTITY:-}"

rm -rf "$APP_DIR" "$DIST_DIR/dmg-root"
mkdir -p "$RESOURCES_DIR" "$MACOS_DIR"

pushd "$ROOT_DIR" >/dev/null
npm pack --silent >/dev/null
PKG_TGZ="$(ls -t idlewatch-skill-*.tgz | head -n1)"
cp "$PKG_TGZ" "$RESOURCES_DIR/"

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
TGZ="$(ls "$RESOURCES_DIR"/idlewatch-skill-*.tgz | head -n1)"

if ! command -v npx >/dev/null 2>&1; then
  echo "IdleWatch requires Node.js (npx not found). Install Node.js 20+ and retry." >&2
  exit 1
fi

if [[ -z "${TGZ:-}" ]]; then
  echo "IdleWatch package payload missing" >&2
  exit 1
fi

exec npx --yes --package "$TGZ" idlewatch-agent "$@"
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
  3) Optional signing: export MACOS_CODESIGN_IDENTITY="Developer ID Application: ..." then rerun package-macos
  4) Optional notarize+staple DMG: set MACOS_NOTARY_PROFILE and rerun build-dmg
EOF

popd >/dev/null
