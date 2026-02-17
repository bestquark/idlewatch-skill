#!/usr/bin/env bash
set -euo pipefail

CODESIGN_IDENTITY="${MACOS_CODESIGN_IDENTITY:-}"
NOTARY_PROFILE="${MACOS_NOTARY_PROFILE:-}"

if [[ -z "$CODESIGN_IDENTITY" ]]; then
  echo "Missing MACOS_CODESIGN_IDENTITY. Example: Developer ID Application: Your Name (TEAMID)" >&2
  exit 1
fi

if [[ -z "$NOTARY_PROFILE" ]]; then
  echo "Missing MACOS_NOTARY_PROFILE. Create one with: xcrun notarytool store-credentials <profile> ..." >&2
  exit 1
fi

if ! command -v codesign >/dev/null 2>&1; then
  echo "codesign not found. Install Xcode Command Line Tools (xcode-select --install)." >&2
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun not found. Install Xcode Command Line Tools (xcode-select --install)." >&2
  exit 1
fi

if ! command -v security >/dev/null 2>&1; then
  echo "security CLI not found; cannot validate signing identities." >&2
  exit 1
fi

if ! security find-identity -v -p codesigning 2>/dev/null | grep -F "$CODESIGN_IDENTITY" >/dev/null 2>&1; then
  echo "Signing identity not found in keychain: $CODESIGN_IDENTITY" >&2
  echo "Run 'security find-identity -v -p codesigning' to list available identities." >&2
  exit 1
fi

if ! xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" >/dev/null 2>&1; then
  echo "Notary profile '$NOTARY_PROFILE' is unavailable or invalid." >&2
  echo "Create/recreate it with: xcrun notarytool store-credentials $NOTARY_PROFILE --apple-id ... --team-id ... --password ..." >&2
  exit 1
fi

echo "Trusted packaging prerequisites OK (codesign identity + notary profile)."