#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
DMG_ROOT="$DIST_DIR/dmg-root"
VERSION="$(node -p "require('./package.json').version" 2>/dev/null || node -e "import('./package.json',{with:{type:'json'}}).then(m=>console.log(m.default.version))")"
NOTARY_PROFILE="${MACOS_NOTARY_PROFILE:-}"
REQUIRE_TRUSTED="${IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION:-0}"
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
DMG_SUFFIX="unsigned"
if [[ -n "${MACOS_CODESIGN_IDENTITY:-}" ]]; then
  DMG_SUFFIX="signed"
fi

if [[ "$REQUIRE_TRUSTED" == "1" ]]; then
  if [[ "$DMG_SUFFIX" != "signed" ]]; then
    echo "IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION=1 requires MACOS_CODESIGN_IDENTITY to be set." >&2
    exit 1
  fi
  if [[ -z "$NOTARY_PROFILE" ]]; then
    echo "IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION=1 requires MACOS_NOTARY_PROFILE to be set." >&2
    exit 1
  fi
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

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$OUT_DMG" > "$OUT_DMG.sha256"
  echo "Wrote checksum: $OUT_DMG.sha256"
fi

if [[ -n "$NOTARY_PROFILE" ]]; then
  echo "Submitting DMG for notarization with profile: $NOTARY_PROFILE"
  xcrun notarytool submit "$OUT_DMG" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$OUT_DMG"
  echo "Created notarized DMG: $OUT_DMG"
else
  echo "Created DMG: $OUT_DMG"
  echo "MACOS_NOTARY_PROFILE not set; skipped notarization/staple."
fi
