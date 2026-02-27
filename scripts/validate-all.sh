#!/usr/bin/env bash
# validate-all.sh — Run all IdleWatch validators in one pass.
# Usage: ./scripts/validate-all.sh [--skip-packaging]
#
# Exit codes:
#   0  All validators passed
#   1  One or more validators failed (summary printed at end)
set -uo pipefail

SKIP_PACKAGING=0
for arg in "$@"; do
  case "$arg" in
    --skip-packaging) SKIP_PACKAGING=1 ;;
  esac
done

IS_MACOS=0
if [[ "$(uname -s)" == "Darwin" ]]; then
  IS_MACOS=1
fi

PASS=0
FAIL=0
SKIP=0
FAILED_NAMES=()

run_validator() {
  local name="$1"
  shift
  printf "%55s " "$name"
  if "$@" >/dev/null 2>&1; then
    echo "✅ pass"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL"
    FAIL=$((FAIL + 1))
    FAILED_NAMES+=("$name")
  fi
}

skip_validator() {
  local name="$1"
  local reason=${2:--skip-packaging}
  printf "%55s ⏭ skip (%s)\n" "$name" "$reason"
  SKIP=$((SKIP + 1))
}

can_run_trusted_prereqs() {
  [[ "$IS_MACOS" -eq 1 ]] || return 1
  [[ -n "${MACOS_CODESIGN_IDENTITY:-}" ]] || return 1
  [[ -n "${MACOS_NOTARY_PROFILE:-}" ]] || return 1
  return 0
}

has_service_account_path() {
  local candidate="$1"
  [[ -n "$candidate" ]] && [[ -f "$candidate" ]]
}

can_run_firebase_write_once() {
  [[ -n "${FIREBASE_PROJECT_ID:-}" ]] || return 1
  if has_service_account_path "${FIREBASE_SERVICE_ACCOUNT_FILE:-}"; then
    return 0
  fi
  [[ -n "${FIREBASE_SERVICE_ACCOUNT_JSON:-}" ]] || \
    [[ -n "${FIREBASE_SERVICE_ACCOUNT_B64:-}" ]] || \
    [[ -n "${FIRESTORE_EMULATOR_HOST:-}" ]] || \
    return 1

  return 0
}

echo "=== IdleWatch full validation sweep ==="
echo ""

# --- Core ---
run_validator "validate:bin"                         npm run validate:bin --silent
run_validator "test:unit"                            npm run test:unit --silent
run_validator "smoke:help"                           npm run smoke:help --silent
run_validator "smoke:dry-run"                        npm run smoke:dry-run --silent
run_validator "smoke:once"                           npm run smoke:once --silent
run_validator "validate:dry-run-schema"              npm run validate:dry-run-schema --silent
run_validator "validate:usage-freshness-e2e"         npm run validate:usage-freshness-e2e --silent
run_validator "validate:usage-alert-rate-e2e"        npm run validate:usage-alert-rate-e2e --silent
run_validator "validate:openclaw-release-gates" npm run validate:openclaw-release-gates --silent

if can_run_trusted_prereqs; then
  run_validator "validate:trusted-prereqs"            npm run validate:trusted-prereqs --silent
else
  if [[ "$IS_MACOS" -ne 1 ]]; then
    skip_validator "validate:trusted-prereqs" "non-macOS host"
  elif [[ -z "${MACOS_CODESIGN_IDENTITY:-}" || -z "${MACOS_NOTARY_PROFILE:-}" ]]; then
    skip_validator "validate:trusted-prereqs" "missing MACOS_CODESIGN_IDENTITY/MACOS_NOTARY_PROFILE"
  else
    skip_validator "validate:trusted-prereqs" "trusted tooling unavailable"
  fi
fi

if can_run_firebase_write_once; then
  run_validator "validate:firebase-write-required-once" npm run validate:firebase-write-required-once --silent
else
  skip_validator "validate:firebase-write-required-once" "missing FIREBASE write credentials"
fi

# --- Packaging ---
if [[ "$SKIP_PACKAGING" -eq 1 ]]; then
  skip_validator "validate:packaged-metadata"
  skip_validator "validate:packaged-bundled-runtime"
  skip_validator "validate:packaged-dry-run-schema:reuse-artifact"
  skip_validator "validate:packaged-openclaw-robustness:reuse-artifact"
  skip_validator "validate:dmg-install"
  skip_validator "validate:dmg-checksum"
elif [[ "$IS_MACOS" -ne 1 ]]; then
  skip_validator "validate:packaged-metadata" "non-macOS host"
  skip_validator "validate:packaged-bundled-runtime" "non-macOS host"
  skip_validator "validate:packaged-dry-run-schema:reuse-artifact" "non-macOS host"
  skip_validator "validate:packaged-openclaw-robustness:reuse-artifact" "non-macOS host"
  skip_validator "validate:dmg-install" "non-macOS host"
  skip_validator "validate:dmg-checksum" "non-macOS host"
else
  run_validator "validate:packaged-metadata"                   npm run validate:packaged-metadata --silent
  run_validator "validate:packaged-bundled-runtime"            npm run validate:packaged-bundled-runtime --silent
  run_validator "validate:packaged-dry-run-schema:reuse-artifact"                  npm run validate:packaged-dry-run-schema:reuse-artifact --silent
  run_validator "validate:packaged-openclaw-robustness:reuse-artifact"                   npm run validate:packaged-openclaw-robustness:reuse-artifact --silent
  run_validator "validate:dmg-install"                         npm run validate:dmg-install --silent
  run_validator "validate:dmg-checksum"                        npm run validate:dmg-checksum --silent
fi

echo ""
echo "=== Summary: $PASS pass, $FAIL fail, $SKIP skip ==="
if [[ ${#FAILED_NAMES[@]} -gt 0 ]]; then
  echo "Failed:"
  for n in "${FAILED_NAMES[@]}"; do
    echo "  - $n"
  done
  exit 1
fi
exit 0
