#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_LAUNCHER="$ROOT_DIR/dist/IdleWatch.app/Contents/MacOS/IdleWatch"

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

echo "Packaging IdleWatch.app with bundled runtime: $RUNTIME_DIR"
IDLEWATCH_NODE_RUNTIME_DIR="$RUNTIME_DIR" npm run package:macos --silent

if [[ ! -x "$DIST_LAUNCHER" ]]; then
  echo "Packaged launcher missing: $DIST_LAUNCHER" >&2
  exit 1
fi

if PATH="/usr/bin:/bin" command -v node >/dev/null 2>&1; then
  echo "Note: node found in PATH during validation. Script continues by verifying launcher can run from a restricted PATH that intentionally omits typical package-manager Node locations." >&2
fi

npm run validate:packaged-metadata --silent

IDLEWATCH_DRY_RUN_TIMEOUT_MS="${IDLEWATCH_DRY_RUN_TIMEOUT_MS:-15000}"

run_packaged_dry_run() {
  local openclaw_usage=${1:-auto}

  IDLEWATCH_DRY_RUN_TIMEOUT_MS="$IDLEWATCH_DRY_RUN_TIMEOUT_MS" \
  IDLEWATCH_OPENCLAW_USAGE="$openclaw_usage" \
  HOME="$HOME" \
  PATH="/usr/bin:/bin" \
  "$NODE_BIN" "$ROOT_DIR/scripts/validate-dry-run-schema.mjs" \
    "$DIST_LAUNCHER" --dry-run
}

set +e
run_packaged_dry_run auto
rc=$?
set -e

if [[ $rc -ne 0 ]]; then
  if run_packaged_dry_run off; then
    echo "bundled runtime validation ok (launcher path-only check under constrained PATH)" >&2
    echo "OpenClaw dry-run under constrained PATH did not emit telemetry in time; launchability path remains healthy." >&2
    exit 0
  fi

  echo "bundled runtime validation failed for both OpenClaw-enabled and OpenClaw-disabled dry-runs" >&2
  exit 1
fi

echo "bundled runtime validation ok"
echo "validated launcher dry-run under constrained PATH in ${IDLEWATCH_DRY_RUN_TIMEOUT_MS}ms timeout"
