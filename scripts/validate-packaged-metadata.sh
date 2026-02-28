#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
METADATA_PATH="$ROOT_DIR/dist/IdleWatch.app/Contents/Resources/packaging-metadata.json"
PAYLOAD_BIN="$ROOT_DIR/dist/IdleWatch.app/Contents/Resources/payload/package/bin/idlewatch-agent.js"

if [[ ! -f "$METADATA_PATH" ]]; then
  echo "Missing packaging metadata: $METADATA_PATH" >&2
  exit 1
fi

if [[ ! -f "$PAYLOAD_BIN" ]]; then
  echo "Missing packaged payload entrypoint: $PAYLOAD_BIN" >&2
  exit 1
fi

node - "$METADATA_PATH" <<'NODE'
const fs = require('fs')
const metadataPath = process.argv[2]
const data = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
if (!data.version) throw new Error('packaging metadata missing version')
if (!data.platform) throw new Error('packaging metadata missing platform')
if (data.platform !== 'darwin') throw new Error('packaging metadata platform is not darwin')
if (!data.bundleName) throw new Error('packaging metadata missing bundleName')
if (!data.payloadTarball) throw new Error('packaging metadata missing payloadTarball')
if (typeof data.nodeRuntimeBundled !== 'boolean') throw new Error('packaging metadata missing nodeRuntimeBundled')
if (typeof data.sourceGitCommit !== 'undefined' && typeof data.sourceGitCommit !== 'string') {
  throw new Error('packaging metadata sourceGitCommit must be a string when present')
}
if (typeof data.sourceGitDirty !== 'undefined' && typeof data.sourceGitDirty !== 'boolean') {
  throw new Error('packaging metadata sourceGitDirty must be a boolean when present')
}
if (typeof data.sourceGitDirtyKnown !== 'undefined' && typeof data.sourceGitDirtyKnown !== 'boolean') {
  throw new Error('packaging metadata sourceGitDirtyKnown must be a boolean when present')
}
console.log(`packaging metadata ok for ${data.bundleName} ${data.version}`)
if (data.sourceGitCommit) {
  console.log(`source commit: ${data.sourceGitCommit}${data.sourceGitDirty ? ' (dirty)' : ''}`)
}
NODE

echo "packaging metadata validation ok"
