#!/usr/bin/env bash
set -euo pipefail

PLIST_LABEL="${IDLEWATCH_LAUNCH_AGENT_LABEL:-com.idlewatch.agent}"
PLIST_ROOT="${IDLEWATCH_LAUNCH_AGENT_PLIST_ROOT:-$HOME/Library/LaunchAgents}"
PLIST_PATH="$PLIST_ROOT/$PLIST_LABEL.plist"
LOG_DIR="${IDLEWATCH_LAUNCH_AGENT_LOG_DIR:-$HOME/Library/Logs/IdleWatch}"
CONFIG_ENV_PATH="${IDLEWATCH_CONFIG_ENV_PATH:-$HOME/.idlewatch/idlewatch.env}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REINSTALL_SCRIPT="$SCRIPT_DIR/install-macos-launch-agent.sh"
REINSTALL_HINT="./scripts/install-macos-launch-agent.sh"

if command -v idlewatch >/dev/null 2>&1; then
  REINSTALL_HINT="idlewatch install-agent"
elif [[ -x "$REINSTALL_SCRIPT" ]]; then
  case "$SCRIPT_DIR" in
    */Contents/Resources/payload/package/scripts)
      REINSTALL_HINT="$REINSTALL_SCRIPT"
      ;;
  esac
fi

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

CONFIG_STATUS_WORD="stays at"
LOG_STATUS_WORD="stay in"
if [[ ! -f "$CONFIG_ENV_PATH" ]]; then
  CONFIG_STATUS_WORD="would live at"
fi
if [[ ! -d "$LOG_DIR" ]]; then
  LOG_STATUS_WORD="would go in"
fi

echo "✅ Background mode turned off."
echo "   Removed plist: $PLIST_PATH"
echo "   Saved config $CONFIG_STATUS_WORD $CONFIG_ENV_PATH"
echo "   Logs $LOG_STATUS_WORD $LOG_DIR"
echo "   Turn background mode back on later with $REINSTALL_HINT."
