#!/usr/bin/env bash
set -euo pipefail

PLIST_LABEL="${IDLEWATCH_LAUNCH_AGENT_LABEL:-com.idlewatch.agent}"
PLIST_ROOT="${IDLEWATCH_LAUNCH_AGENT_PLIST_ROOT:-$HOME/Library/LaunchAgents}"
PLIST_PATH="$PLIST_ROOT/$PLIST_LABEL.plist"

if ! command -v launchctl >/dev/null 2>&1; then
  echo "launchctl not available; this script must be run on macOS." >&2
  exit 1
fi

if [[ -z "${PLIST_LABEL}" ]]; then
  echo "IDLEWATCH_LAUNCH_AGENT_LABEL is required" >&2
  exit 1
fi

USER_GUID="$(id -u)"
PLIST_ID="gui/$USER_GUID/$PLIST_LABEL"

if launchctl print "$PLIST_ID" >/dev/null 2>&1; then
  launchctl bootout "$PLIST_ID" || true
fi

if [[ -f "$PLIST_PATH" ]]; then
  rm -f "$PLIST_PATH"
fi

echo "Uninstalled LaunchAgent: $PLIST_ID"
echo "Removed plist: $PLIST_PATH"
