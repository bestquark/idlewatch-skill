#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

INPUT_DMG="${1:-}"
if [[ -z "$INPUT_DMG" ]]; then
  INPUT_DMG="$(ls -t "$DIST_DIR"/IdleWatch-*.dmg 2>/dev/null | head -n1 || true)"
fi

if [[ -z "$INPUT_DMG" || ! -f "$INPUT_DMG" ]]; then
  echo "No DMG found. Build one first (npm run package:dmg) or pass a DMG path." >&2
  exit 1
fi

MOUNT_POINT=""
DEV_ENTRY=""
TMP_APPS="$(mktemp -d -t idlewatch-apps.XXXXXX)"
IDLEWATCH_DRY_RUN_TIMEOUT_MS="${IDLEWATCH_DRY_RUN_TIMEOUT_MS:-30000}"
IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS="${IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS:-4000}"

cleanup() {
  if [[ -n "$DEV_ENTRY" ]]; then
    hdiutil detach "$DEV_ENTRY" -quiet || true
  fi
  rm -rf "$TMP_APPS"
}
trap cleanup EXIT

ATTACH_OUTPUT="$(hdiutil attach "$INPUT_DMG" -nobrowse -readonly)"
DEV_ENTRY="$(echo "$ATTACH_OUTPUT" | awk '/Apple_HFS|Apple_APFS/ {print $1; exit}')"
MOUNT_POINT="$(echo "$ATTACH_OUTPUT" | awk '/\/Volumes\// {sub(/^.*\t/, ""); print; exit}')"

if [[ -z "$DEV_ENTRY" || -z "$MOUNT_POINT" ]]; then
  echo "Failed to parse mounted DMG device or mount point." >&2
  echo "$ATTACH_OUTPUT" >&2
  exit 1
fi

APP_PATH="$MOUNT_POINT/IdleWatch.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo "Mounted DMG does not contain IdleWatch.app at expected path: $APP_PATH" >&2
  exit 1
fi

cp -R "$APP_PATH" "$TMP_APPS/"
INSTALLED_LAUNCHER="$TMP_APPS/IdleWatch.app/Contents/MacOS/IdleWatch"

if [[ ! -x "$INSTALLED_LAUNCHER" ]]; then
  echo "Installed launcher missing or not executable: $INSTALLED_LAUNCHER" >&2
  exit 1
fi

run_dmg_dry_run() {
  local openclaw_usage=${1:-auto}

  env \
    IDLEWATCH_DRY_RUN_TIMEOUT_MS="$IDLEWATCH_DRY_RUN_TIMEOUT_MS" \
    IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS="$IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS" \
    IDLEWATCH_OPENCLAW_USAGE="$openclaw_usage" \
    node "$ROOT_DIR/scripts/validate-dry-run-schema.mjs" "$INSTALLED_LAUNCHER" --dry-run
}

set +e
if run_dmg_dry_run auto; then
  echo "dmg install validation ok ($INPUT_DMG)"
  exit 0
fi

if run_dmg_dry_run off; then
  echo "dmg install validation ok ($INPUT_DMG)" >&2
  echo "OpenClaw-enabled dry-run did not emit telemetry within timeout; launchability path remains healthy." >&2
  exit 0
fi

set -e
echo "dmg install validation failed for both OpenClaw-on and OpenClaw-off modes" >&2
exit 1

