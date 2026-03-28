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

PLIST_STATUS_LINE="No plist was installed at $PLIST_PATH"
if [[ -f "$PLIST_PATH" ]]; then
  rm -f "$PLIST_PATH"
  PLIST_STATUS_LINE="Removed plist: $PLIST_PATH"
fi

CONFIG_STATUS_WORD="stays at"
LOG_STATUS_WORD="stay in"
LOG_PATH_LABEL="Logs"
LOG_PATH_VALUE="$LOG_DIR"
SAVED_LOCAL_LOG_PATH=""
if [[ -f "$CONFIG_ENV_PATH" ]]; then
  while IFS= read -r config_line; do
    case "$config_line" in
      IDLEWATCH_LOCAL_LOG_PATH=*)
        SAVED_LOCAL_LOG_PATH="${config_line#IDLEWATCH_LOCAL_LOG_PATH=}"
        SAVED_LOCAL_LOG_PATH="${SAVED_LOCAL_LOG_PATH%\"}"
        SAVED_LOCAL_LOG_PATH="${SAVED_LOCAL_LOG_PATH#\"}"
        SAVED_LOCAL_LOG_PATH="${SAVED_LOCAL_LOG_PATH%\'}"
        SAVED_LOCAL_LOG_PATH="${SAVED_LOCAL_LOG_PATH#\'}"
        break
        ;;
    esac
  done < "$CONFIG_ENV_PATH"
else
  CONFIG_STATUS_WORD="would live at"
fi

if [[ -n "$SAVED_LOCAL_LOG_PATH" ]]; then
  LOG_PATH_LABEL="Local log"
  LOG_PATH_VALUE="$SAVED_LOCAL_LOG_PATH"
  LOG_STATUS_WORD="stays at"
  if [[ ! -f "$SAVED_LOCAL_LOG_PATH" ]]; then
    LOG_STATUS_WORD="would go to"
  fi
elif [[ ! -d "$LOG_DIR" ]]; then
  LOG_STATUS_WORD="would go in"
else
  shopt -s nullglob
  telemetry_logs=("$LOG_DIR"/*.ndjson)
  shopt -u nullglob
  if [[ ${#telemetry_logs[@]} -eq 0 ]]; then
    LOG_STATUS_WORD="would go in"
  fi
fi

echo "✅ Background mode turned off."
echo "   $PLIST_STATUS_LINE"
echo "   Saved config $CONFIG_STATUS_WORD $CONFIG_ENV_PATH"
echo "   $LOG_PATH_LABEL $LOG_STATUS_WORD $LOG_PATH_VALUE"
echo "   Turn background mode back on later with $REINSTALL_HINT."
