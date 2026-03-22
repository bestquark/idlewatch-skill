#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

DMG_PATH="${1:-}"
if [[ -z "$DMG_PATH" ]]; then
  DMG_PATH="$(ls -1 "$DIST_DIR"/IdleWatch-*.dmg 2>/dev/null | sort | tail -n 1 || true)"
fi

if [[ -z "$DMG_PATH" || ! -f "$DMG_PATH" ]]; then
  echo "No DMG found to validate. Run package:dmg or pass path: ./scripts/validate-dmg-checksum.sh <path>" >&2
  exit 1
fi

CHECKSUM_PATH="${DMG_PATH}.sha256"
if [[ ! -f "$CHECKSUM_PATH" ]]; then
  echo "Missing checksum file: $CHECKSUM_PATH" >&2
  exit 1
fi

if ! command -v shasum >/dev/null 2>&1; then
  echo "shasum command unavailable; cannot validate checksum." >&2
  exit 1
fi

EXPECTED=$(cut -d' ' -f1 < "$CHECKSUM_PATH")
ACTUAL=$(shasum -a 256 "$DMG_PATH" | cut -d' ' -f1)
if [[ "$ACTUAL" != "$EXPECTED" ]]; then
  echo "Checksum mismatch for $DMG_PATH" >&2
  echo "Expected: $EXPECTED" >&2
  echo "Actual:   $ACTUAL" >&2
  exit 1
fi

echo "DMG checksum OK: $DMG_PATH"
