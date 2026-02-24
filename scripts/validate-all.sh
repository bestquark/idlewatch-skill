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

PASS=0
FAIL=0
SKIP=0
FAILED_NAMES=()

run_validator() {
  local name="$1"
  shift
  printf "%-55s " "$name"
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
  printf "%-55s ⏭ skip (--skip-packaging)\n" "$name"
  SKIP=$((SKIP + 1))
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

# --- Packaging ---
if [[ "$SKIP_PACKAGING" -eq 1 ]]; then
  skip_validator "validate:packaged-metadata"
  skip_validator "validate:packaged-bundled-runtime"
  skip_validator "validate:packaged-dry-run-schema:reuse-artifact"
  skip_validator "validate:packaged-openclaw-robustness:reuse-artifact"
  skip_validator "validate:dmg-install"
  skip_validator "validate:dmg-checksum"
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
