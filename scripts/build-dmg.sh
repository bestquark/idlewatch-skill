#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
DMG_ROOT="$DIST_DIR/dmg-root"
VERSION="$(node -p "require('./package.json').version" 2>/dev/null || node -e "import('./package.json',{with:{type:'json'}}).then(m=>console.log(m.default.version))")"
OUT_DMG="$DIST_DIR/IdleWatch-${VERSION}-unsigned.dmg"

if [[ ! -d "$DMG_ROOT" ]]; then
  echo "Missing $DMG_ROOT. Run ./scripts/package-macos.sh first." >&2
  exit 1
fi

rm -f "$OUT_DMG"

hdiutil create \
  -volname "IdleWatch" \
  -srcfolder "$DMG_ROOT" \
  -ov \
  -format UDZO \
  "$OUT_DMG"

echo "Created unsigned DMG: $OUT_DMG"
echo "TODO: codesign app, notarize DMG, then staple."
