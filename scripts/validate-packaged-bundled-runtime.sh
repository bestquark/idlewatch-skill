#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_LAUNCHER="$ROOT_DIR/dist/IdleWatch.app/Contents/MacOS/IdleWatch"

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Node.js is required to run bundled-runtime validation." >&2
  exit 1
fi

NODE_REAL="$(python3 - <<'PY'
import os, pathlib, shutil
node = shutil.which('node')
if not node:
    raise SystemExit(1)
print(pathlib.Path(node).resolve())
PY
)"
RUNTIME_DIR="$(cd "$(dirname "$NODE_REAL")/.." && pwd)"

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
  echo "Validation environment unexpectedly has node on PATH=/usr/bin:/bin; cannot prove bundled runtime resolution." >&2
  exit 1
fi

JSON_LINE="$(PATH="/usr/bin:/bin" "$DIST_LAUNCHER" --dry-run 2>/dev/null | tail -n 1)"

if [[ -z "$JSON_LINE" ]]; then
  echo "Bundled runtime validation failed: launcher produced no dry-run JSON output." >&2
  exit 1
fi

"$NODE_BIN" -e '
const line = process.argv[1];
let row;
try {
  row = JSON.parse(line);
} catch (err) {
  console.error("Bundled runtime validation failed: last output line is not JSON.");
  process.exit(1);
}
if (!row || typeof row !== "object" || !row.host || !row.ts) {
  console.error("Bundled runtime validation failed: dry-run JSON row missing required fields.");
  process.exit(1);
}
console.log("bundled runtime validation ok");
' "$JSON_LINE"
