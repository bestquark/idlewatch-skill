#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_LAUNCHER="$ROOT_DIR/dist/IdleWatch.app/Contents/MacOS/IdleWatch"
TMP_APPS="$(mktemp -d -t idlewatch-packaged-runtime.XXXXXX)"

cleanup_tmp() {
  rm -rf "$TMP_APPS"
}
trap cleanup_tmp EXIT

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Node.js is required to run bundled-runtime validation." >&2
  exit 1
fi

RUNTIME_DIR="$($NODE_BIN -e 'const path = require("path"); console.log(path.resolve(process.argv[1], "..", ".."))' "$NODE_BIN")"

if [[ ! -x "$RUNTIME_DIR/bin/node" ]]; then
  echo "Resolved runtime dir is invalid (missing executable bin/node): $RUNTIME_DIR" >&2
  exit 1
fi

if [[ "${IDLEWATCH_SKIP_PACKAGE_MACOS:-0}" != "1" ]]; then
  echo "Packaging IdleWatch.app with bundled runtime: $RUNTIME_DIR"
  IDLEWATCH_NODE_RUNTIME_DIR="$RUNTIME_DIR" npm run package:macos --silent
else
  if [[ -x "$DIST_LAUNCHER" ]]; then
    echo "Using existing packaged app at: $DIST_LAUNCHER"
  else
    echo "IDLEWATCH_SKIP_PACKAGE_MACOS=1 but packaged launcher is missing: $DIST_LAUNCHER" >&2
    echo "Run with IDLEWATCH_SKIP_PACKAGE_MACOS unset or prebuild via npm run package:macos first." >&2
    exit 1
  fi
fi

if [[ ! -x "$DIST_LAUNCHER" ]]; then
  echo "Packaged launcher missing: $DIST_LAUNCHER" >&2
  exit 1
fi

if PATH="/usr/bin:/bin" command -v node >/dev/null 2>&1; then
  echo "Note: node is available in restricted PATH; this mode still validates bundled runtime fallback via explicit launcher/runtime resolution but is not a pure no-node-path check." >&2
else
  echo "Using a Node-free PATH to validate that launcher falls back to bundled runtime cleanly." >&2
fi
npm run validate:packaged-metadata --silent

IDLEWATCH_DRY_RUN_TIMEOUT_MS="${IDLEWATCH_DRY_RUN_TIMEOUT_MS:-90000}"
IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS="${IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS:-4000}"
DRY_RUN_TIMEOUT_RETRY_BONUS_MS="${IDLEWATCH_DRY_RUN_TIMEOUT_RETRY_BONUS_MS:-10000}"
DRY_RUN_TIMEOUT_MAX_ATTEMPTS="${IDLEWATCH_DRY_RUN_TIMEOUT_MAX_ATTEMPTS:-3}"
DRY_RUN_TIMEOUT_BACKOFF_MS="${IDLEWATCH_DRY_RUN_TIMEOUT_BACKOFF_MS:-2000}"

run_packaged_dry_run() {
  local openclaw_usage=${1:-auto}
  local timeout_ms=${2}
  local attempt=${3}
  local attempt_log="$TMP_APPS/packaged-dry-run-${openclaw_usage}-attempt-${attempt}.log"

  if ! env \
    IDLEWATCH_DRY_RUN_TIMEOUT_MS="$timeout_ms" \
    IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS="$IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS" \
    IDLEWATCH_OPENCLAW_USAGE="$openclaw_usage" \
    HOME="$HOME" \
    PATH="/usr/bin:/bin" \
    "$NODE_BIN" "$ROOT_DIR/scripts/validate-dry-run-schema.mjs" \
      "$DIST_LAUNCHER" --dry-run --once >"$attempt_log" 2>&1; then
    echo "Attempt ${attempt} failed for IDLEWATCH_OPENCLAW_USAGE=${openclaw_usage}. Last output:" >&2
    tail -n 60 "$attempt_log" >&2 || true
    return 1
  fi

  cat "$attempt_log" >&2
  return 0
}

run_packaged_dry_run_with_retries() {
  local openclaw_usage=$1
  local attempt=1
  local timeout_ms="$IDLEWATCH_DRY_RUN_TIMEOUT_MS"

  while (( attempt <= DRY_RUN_TIMEOUT_MAX_ATTEMPTS )); do
    local sleep_ms=0
    echo "Attempt ${attempt}/${DRY_RUN_TIMEOUT_MAX_ATTEMPTS}: validating packaged launcher dry-run with IDLEWATCH_OPENCLAW_USAGE=${openclaw_usage} timeout=${timeout_ms}ms" >&2
    if run_packaged_dry_run "$openclaw_usage" "$timeout_ms" "$attempt"; then
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
run_packaged_dry_run_with_retries auto
rc=$?
set -e

if [[ $rc -ne 0 ]]; then
  if run_packaged_dry_run_with_retries off; then
    echo "bundled runtime validation ok (launcher path-only check under restricted PATH)" >&2
    echo "OpenClaw-enabled dry-run did not emit telemetry within timeout/backoff window; launchability path remains healthy." >&2
    exit 0
  fi

  echo "bundled runtime validation failed for both OpenClaw-enabled and OpenClaw-disabled dry-runs" >&2
  exit 1
fi

echo "bundled runtime validation ok"
echo "validated launcher dry-run under restricted PATH in ${IDLEWATCH_DRY_RUN_TIMEOUT_MS}ms baseline (+${DRY_RUN_TIMEOUT_RETRY_BONUS_MS}ms retry increments, up to ${DRY_RUN_TIMEOUT_MAX_ATTEMPTS} attempts)"
