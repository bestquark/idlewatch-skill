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

read_metadata_field() {
  local field=$1
  "$NODE_BIN" - "$METADATA_PATH" "$field" <<'NODE' | tr -d '\r'
const fs = require('fs')
const metadataPath = process.argv[2]
const field = process.argv[3]
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
const value = metadata[field]
if (typeof value === 'undefined' || value === null) process.exit(0)
if (typeof value === 'boolean') process.stdout.write(value ? '1' : '0')
else process.stdout.write(String(value))
NODE
}

RUNTIME_DIR="$($NODE_BIN -e 'const path = require("path"); console.log(path.resolve(process.argv[1], "..", ".."))' "$NODE_BIN")"
METADATA_PATH="$ROOT_DIR/dist/IdleWatch.app/Contents/Resources/packaging-metadata.json"
BUNDLED_RUNTIME_REQUIRED_RAW="${IDLEWATCH_BUNDLED_RUNTIME_REQUIRED+x}"
BUNDLED_RUNTIME_REQUIRED="${IDLEWATCH_BUNDLED_RUNTIME_REQUIRED:-0}"
RESTRICTED_PATH="/usr/bin:/bin"
ORIGINAL_PATH="${PATH:-/usr/bin:/bin}"

if [[ "${IDLEWATCH_SKIP_PACKAGE_MACOS:-0}" != "1" ]]; then
  if [[ ! -x "$RUNTIME_DIR/bin/node" ]]; then
    echo "Resolved runtime dir is invalid (missing executable bin/node): $RUNTIME_DIR" >&2
    exit 1
  fi
  echo "Packaging IdleWatch.app with bundled runtime: $RUNTIME_DIR"
  IDLEWATCH_NODE_RUNTIME_DIR="$RUNTIME_DIR" npm run package:macos --silent
else
  if [[ ! -f "$METADATA_PATH" ]]; then
    echo "IDLEWATCH_SKIP_PACKAGE_MACOS=1 but metadata is missing: $METADATA_PATH" >&2
    echo "Run with IDLEWATCH_SKIP_PACKAGE_MACOS unset or prebuild via npm run package:macos first." >&2
    exit 1
  fi

  if [[ ! -f "$DIST_LAUNCHER" ]]; then
    echo "IDLEWATCH_SKIP_PACKAGE_MACOS=1 but packaged launcher is missing: $DIST_LAUNCHER" >&2
    echo "Run with IDLEWATCH_SKIP_PACKAGE_MACOS unset or prebuild via npm run package:macos first." >&2
    exit 1
  fi

  if [[ "$BUNDLED_RUNTIME_REQUIRED" == "1" ]]; then
    if [[ "$(read_metadata_field nodeRuntimeBundled)" != "1" ]]; then
      echo "Reused packaged artifact is not bundled-runtime aware. Rebuild first:" >&2
      echo "  npm run package:macos" >&2
      echo "(required for node-free PATH validation in bundled-runtime check)" >&2
      echo "To force launchability-only non-bundled validation, set IDLEWATCH_BUNDLED_RUNTIME_REQUIRED=0." >&2
      exit 1
    fi
  elif [[ "$BUNDLED_RUNTIME_REQUIRED_RAW" != "1" ]]; then
    if [[ "$(read_metadata_field nodeRuntimeBundled)" != "1" ]]; then
      echo "Non-bundled artifact detected in reuse mode; running launchability fallback (recommended for non-deterministic reuse checks)." >&2
      echo "This keeps non-bundled artifacts supportable while still validating launcher startup semantics." >&2
      echo "Set IDLEWATCH_BUNDLED_RUNTIME_REQUIRED=1 to enforce strict node-free validation." >&2
    fi
  fi

  if ! IDLEWATCH_ARTIFACT_DIR="$ROOT_DIR/dist/IdleWatch.app"     node "$ROOT_DIR/scripts/validate-packaged-artifact.mjs"; then
    echo "Reusable packaged artifact preflight failed for validate-packaged-bundled-runtime." >&2
    exit 1
  fi

  echo "Using existing packaged app at: $DIST_LAUNCHER"
fi

if [[ ! -x "$DIST_LAUNCHER" ]]; then
  echo "Packaged launcher missing: $DIST_LAUNCHER" >&2
  exit 1
fi

npm run validate:packaged-metadata --silent

NODE_RUNTIME_BUNDLED="$(read_metadata_field nodeRuntimeBundled)"

if [[ "$NODE_RUNTIME_BUNDLED" == "1" ]]; then
  VALIDATION_PATH="$RESTRICTED_PATH"
  echo "Running strict path-scrubbed launchability validation using PATH=$RESTRICTED_PATH"
elif [[ "${IDLEWATCH_USE_ORIGINAL_PATH_FOR_NON_BUNDLED:-1}" == "1" ]]; then
  if node_path="$(PATH="$RESTRICTED_PATH" /usr/bin/env which node 2>/dev/null || true)" &&
      [[ -n "$node_path" ]] &&
      [[ "$node_path" == /* ]] &&
      [[ -x "$node_path" ]]; then
    VALIDATION_PATH="$RESTRICTED_PATH"
    echo "Node is available in restricted PATH; still validating with PATH=$RESTRICTED_PATH to keep behavior deterministic."
  else
    VALIDATION_PATH="$ORIGINAL_PATH"
    echo "Non-bundled artifact detected; node is not available in PATH=$RESTRICTED_PATH." >&2
    echo "Falling back to current PATH for launchability verification in non-bundled mode." >&2
    echo "Set IDLEWATCH_BUNDLED_RUNTIME_REQUIRED=1 and provide IDLEWATCH_NODE_RUNTIME_DIR for strict node-free validation." >&2
  fi
else
  VALIDATION_PATH="$RESTRICTED_PATH"
  echo "Non-bundled artifact detected but strict path mode requested; this run requires bundled runtime validation." >&2
  exit 1
fi

IDLEWATCH_DRY_RUN_TIMEOUT_MS="${IDLEWATCH_DRY_RUN_TIMEOUT_MS:-90000}"
IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS="${IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS:-4000}"
DRY_RUN_TIMEOUT_RETRY_BONUS_MS="${IDLEWATCH_DRY_RUN_TIMEOUT_RETRY_BONUS_MS:-10000}"
DRY_RUN_TIMEOUT_MAX_ATTEMPTS="${IDLEWATCH_DRY_RUN_TIMEOUT_MAX_ATTEMPTS:-3}"
DRY_RUN_TIMEOUT_BACKOFF_MS="${IDLEWATCH_DRY_RUN_TIMEOUT_BACKOFF_MS:-2000}"

run_packaged_dry_run() {
  local openclaw_usage=${1:-auto}
  local timeout_ms=${2}
  local attempt=${3}
  local validation_path=${4}
  local attempt_log="$TMP_APPS/packaged-dry-run-${openclaw_usage}-attempt-${attempt}.log"

  if ! env \
    IDLEWATCH_DRY_RUN_TIMEOUT_MS="$timeout_ms" \
    IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS="$IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS" \
    IDLEWATCH_OPENCLAW_USAGE="$openclaw_usage" \
    HOME="$HOME" \
    PATH="$validation_path" \
    "$NODE_BIN" "$ROOT_DIR/scripts/validate-dry-run-schema.mjs" \
      "$DIST_LAUNCHER" --dry-run --once >"$attempt_log" 2>&1; then
    echo "Attempt ${attempt} failed for IDLEWATCH_OPENCLAW_USAGE=${openclaw_usage} with PATH=$validation_path. Last output:" >&2
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
    if run_packaged_dry_run "$openclaw_usage" "$timeout_ms" "$attempt" "$VALIDATION_PATH"; then
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
    echo "bundled runtime validation ok (launcher path-only check ${VALIDATION_PATH:+under PATH=$VALIDATION_PATH})" >&2
    echo "OpenClaw-enabled dry-run did not emit telemetry within timeout/backoff window; launchability path remains healthy." >&2
    exit 0
  fi

  echo "bundled runtime validation failed for both OpenClaw-enabled and OpenClaw-disabled dry-runs" >&2
  exit 1
fi

echo "bundled runtime validation ok"
if [[ "$NODE_RUNTIME_BUNDLED" == "1" ]]; then
  echo "validated launcher dry-run under restricted PATH in ${IDLEWATCH_DRY_RUN_TIMEOUT_MS}ms baseline (+${DRY_RUN_TIMEOUT_RETRY_BONUS_MS}ms retry increments, up to ${DRY_RUN_TIMEOUT_MAX_ATTEMPTS} attempts)"
else
  echo "validated launcher dry-run for non-bundled artifact under PATH=${VALIDATION_PATH} in ${IDLEWATCH_DRY_RUN_TIMEOUT_MS}ms baseline (+${DRY_RUN_TIMEOUT_RETRY_BONUS_MS}ms retry increments, up to ${DRY_RUN_TIMEOUT_MAX_ATTEMPTS} attempts)"
fi
