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

CLEAN_OUTPUT="$(env -i HOME="$HOME" PATH="/usr/bin:/bin" "$DIST_LAUNCHER" --dry-run 2>/dev/null || true)"

JSON_LINE="$(printf '%s\n' "$CLEAN_OUTPUT" | "$NODE_BIN" -e '
const fs = require("fs");
const text = fs.readFileSync(0, "utf8");
const lines = text.split(/\r?\n/);
for (let i = lines.length - 1; i >= 0; i--) {
  const line = String(lines[i] || "").trim();
  if (!line) continue;
  try {
    JSON.parse(line);
    process.stdout.write(line);
    process.exit(0);
  } catch {
    // ignore non-JSON lines
  }
}
process.exit(1);
' )"

if [[ -z "$JSON_LINE" ]]; then
  echo "Bundled runtime validation failed: launcher produced no parseable dry-run JSON row under a restricted PATH." >&2
  if [[ -n "$CLEAN_OUTPUT" ]]; then
    echo "Launcher output (tail):" >&2
    printf '%s\n' "$CLEAN_OUTPUT" | tail -n 20 >&2
  else
    echo "(no output captured)" >&2
  fi
  exit 1
fi

"$NODE_BIN" -e '
const line = process.argv[1];
let row;
try {
  row = JSON.parse(line);
} catch (err) {
  console.error("Bundled runtime validation failed: selected output row is not JSON.");
  process.exit(1);
}
if (!row || typeof row !== "object" || !row.host || !row.ts) {
  console.error("Bundled runtime validation failed: dry-run JSON row missing required fields.");
  process.exit(1);
}
console.log("bundled runtime validation ok");
' "$JSON_LINE"
