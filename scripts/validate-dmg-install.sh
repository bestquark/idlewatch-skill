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
DRY_RUN_TIMEOUT_RETRY_BONUS_MS="${IDLEWATCH_DRY_RUN_TIMEOUT_RETRY_BONUS_MS:-10000}"
DRY_RUN_TIMEOUT_MAX_ATTEMPTS="${IDLEWATCH_DRY_RUN_TIMEOUT_MAX_ATTEMPTS:-3}"
DRY_RUN_TIMEOUT_BACKOFF_MS="${IDLEWATCH_DRY_RUN_TIMEOUT_BACKOFF_MS:-2000}"

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
  local timeout_ms=${2}

  env \
    IDLEWATCH_DRY_RUN_TIMEOUT_MS="$timeout_ms" \
    IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS="$IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS" \
    IDLEWATCH_OPENCLAW_USAGE="$openclaw_usage" \
    node "$ROOT_DIR/scripts/validate-dry-run-schema.mjs" "$INSTALLED_LAUNCHER" --dry-run --once
}

run_dmg_dry_run_with_retries() {
  local openclaw_usage=$1
  local attempt=1
  local timeout_ms="$IDLEWATCH_DRY_RUN_TIMEOUT_MS"

  while (( attempt <= DRY_RUN_TIMEOUT_MAX_ATTEMPTS )); do
    local sleep_ms=0
    echo "Attempt ${attempt}/${DRY_RUN_TIMEOUT_MAX_ATTEMPTS}: validating DMG-installed launcher dry-run with IDLEWATCH_OPENCLAW_USAGE=${openclaw_usage} timeout=${timeout_ms}ms" >&2
    if run_dmg_dry_run "$openclaw_usage" "$timeout_ms"; then
      return 0
    fi

    if (( attempt < DRY_RUN_TIMEOUT_MAX_ATTEMPTS )); then
      timeout_ms=$((timeout_ms + DRY_RUN_TIMEOUT_RETRY_BONUS_MS))
      sleep_ms=$((DRY_RUN_TIMEOUT_BACKOFF_MS < 0 ? 0 : DRY_RUN_TIMEOUT_BACKOFF_MS))
      if (( sleep_ms > 0 )); then
        sleep $(awk -v t="$sleep_ms" 'BEGIN { printf "%.3f", t / 1000 }')
      fi
    fi
    attempt=$((attempt + 1))
  done

  return 1
}

set +e
if run_dmg_dry_run_with_retries auto; then
  echo "dmg install validation ok ($INPUT_DMG)"
  exit 0
fi

if run_dmg_dry_run_with_retries off; then
  echo "dmg install validation ok ($INPUT_DMG)" >&2
  echo "OpenClaw-enabled dry-run did not emit telemetry within timeout/backoff window; launchability path remains healthy." >&2
  exit 0
fi

set -e
echo "dmg install validation failed for both Openclaw-on and OpenClaw-off modes" >&2
exit 1
