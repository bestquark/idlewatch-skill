#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
APP_DIR="$DIST_DIR/IdleWatch.app"
CONTENTS_DIR="$APP_DIR/Contents"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
MACOS_DIR="$CONTENTS_DIR/MacOS"

mkdir -p "$RESOURCES_DIR" "$MACOS_DIR"

pushd "$ROOT_DIR" >/dev/null
npm pack --silent >/dev/null
PKG_TGZ="$(ls -t idlewatch-skill-*.tgz | head -n1)"
cp "$PKG_TGZ" "$RESOURCES_DIR/"

cat > "$CONTENTS_DIR/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>IdleWatch</string>
  <key>CFBundleDisplayName</key><string>IdleWatch</string>
  <key>CFBundleIdentifier</key><string>com.idlewatch.agent</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
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
if [[ -z "${TGZ:-}" ]]; then
  echo "IdleWatch package payload missing" >&2
  exit 1
fi

echo "TODO: expand package payload and launch idlewatch-agent"
exit 0
SH
chmod +x "$MACOS_DIR/IdleWatch"

mkdir -p "$DIST_DIR/dmg-root"
cp -R "$APP_DIR" "$DIST_DIR/dmg-root/"

cat <<'EOF'
Scaffold package complete.
Next steps:
  1) Add app runtime bootstrap in Contents/MacOS/IdleWatch
  2) Add codesign and notarization steps
  3) Run ./scripts/build-dmg.sh
EOF

popd >/dev/null
