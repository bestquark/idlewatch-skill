#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
DMG_ROOT="$DIST_DIR/dmg-root"
VERSION="$(node -p "require('./package.json').version" 2>/dev/null || node -e "import('./package.json',{with:{type:'json'}}).then(m=>console.log(m.default.version))")"
NOTARY_PROFILE="${MACOS_NOTARY_PROFILE:-}"
DMG_SUFFIX="unsigned"
if [[ -n "${MACOS_CODESIGN_IDENTITY:-}" ]]; then
  DMG_SUFFIX="signed"
fi
OUT_DMG="$DIST_DIR/IdleWatch-${VERSION}-${DMG_SUFFIX}.dmg"

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

if [[ -n "$NOTARY_PROFILE" ]]; then
  echo "Submitting DMG for notarization with profile: $NOTARY_PROFILE"
  xcrun notarytool submit "$OUT_DMG" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$OUT_DMG"
  echo "Created notarized DMG: $OUT_DMG"
else
  echo "Created DMG: $OUT_DMG"
  echo "MACOS_NOTARY_PROFILE not set; skipped notarization/staple."
fi
