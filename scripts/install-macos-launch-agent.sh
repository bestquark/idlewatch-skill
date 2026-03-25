#!/usr/bin/env bash
set -euo pipefail

DEFAULT_APP_PATH="/Applications/IdleWatch.app"
USER_APP_PATH="$HOME/Applications/IdleWatch.app"
DEFAULT_PLIST_ROOT="$HOME/Library/LaunchAgents"
DEFAULT_PLIST_LABEL="com.idlewatch.agent"

resolve_app_path() {
  if [[ -n "${IDLEWATCH_APP_PATH:-}" ]]; then
    printf '%s\n' "$IDLEWATCH_APP_PATH"
    return 0
  fi

  if [[ -d "$DEFAULT_APP_PATH" ]]; then
    printf '%s\n' "$DEFAULT_APP_PATH"
    return 0
  fi

  if [[ -d "$USER_APP_PATH" ]]; then
    printf '%s\n' "$USER_APP_PATH"
    return 0
  fi

  printf '%s\n' "$DEFAULT_APP_PATH"
}

APP_PATH="$(resolve_app_path)"
BIN_PATH="${IDLEWATCH_APP_BIN:-$APP_PATH/Contents/MacOS/IdleWatch}"
PLIST_LABEL="${IDLEWATCH_LAUNCH_AGENT_LABEL:-com.idlewatch.agent}"
PLIST_ROOT="${IDLEWATCH_LAUNCH_AGENT_PLIST_ROOT:-$HOME/Library/LaunchAgents}"
LOG_DIR="${IDLEWATCH_LAUNCH_AGENT_LOG_DIR:-$HOME/Library/Logs/IdleWatch}"
INTERVAL_MS="${IDLEWATCH_INTERVAL_MS:-10000}"
START_INTERVAL_SEC=$(( (INTERVAL_MS / 1000) ))
if [[ $START_INTERVAL_SEC -lt 60 ]]; then
  START_INTERVAL_SEC=60
fi

PLIST_PATH="$PLIST_ROOT/$PLIST_LABEL.plist"
CONFIG_ENV_PATH="${IDLEWATCH_CONFIG_ENV_PATH:-$HOME/.idlewatch/idlewatch.env}"

is_standard_app_path=0
if [[ "$APP_PATH" == "$DEFAULT_APP_PATH" || "$APP_PATH" == "$USER_APP_PATH" ]]; then
  is_standard_app_path=1
fi

if [[ "$PLIST_LABEL" == "$DEFAULT_PLIST_LABEL" ]] && \
   [[ "$PLIST_ROOT" != "$DEFAULT_PLIST_ROOT" || $is_standard_app_path -ne 1 ]]; then
  echo "Refusing to reuse the default LaunchAgent label ($DEFAULT_PLIST_LABEL) with a custom app path or plist root." >&2
  echo "launchd uses the label as the real identity, so this could replace your already-loaded IdleWatch agent." >&2
  echo "Use IDLEWATCH_LAUNCH_AGENT_LABEL to pick a different label for side-by-side QA/dev installs." >&2
  exit 1
fi

if [[ ! -d "$PLIST_ROOT" ]]; then
  mkdir -p "$PLIST_ROOT"
fi

if [[ ! -d "$LOG_DIR" ]]; then
  mkdir -p "$LOG_DIR"
fi

if ! command -v launchctl >/dev/null 2>&1; then
  echo "launchctl not available; this script must be run on macOS." >&2
  exit 1
fi

if [[ ! -x "$BIN_PATH" ]]; then
  echo "IdleWatch app not found at either standard location:" >&2
  echo "  /Applications/IdleWatch.app" >&2
  echo "  ~/Applications/IdleWatch.app" >&2
  echo "" >&2
  if [[ -n "${IDLEWATCH_APP_PATH:-}" ]]; then
    echo "Looked for app bundle from IDLEWATCH_APP_PATH: $IDLEWATCH_APP_PATH" >&2
  fi
  echo "Looked for launcher binary: $BIN_PATH" >&2
  echo "If your app is somewhere else, set IDLEWATCH_APP_PATH to the app bundle" >&2
  echo "or IDLEWATCH_APP_BIN to the launcher binary before running this script." >&2
  exit 1
fi

cat > "$PLIST_PATH" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{{PLIST_LABEL}}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{{BIN_PATH}}</string>
    <string>--run</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>{{LOG_DIR}}/idlewatch.out.log</string>
  <key>StandardErrorPath</key>
  <string>{{LOG_DIR}}/idlewatch.err.log</string>
  <key>StartInterval</key>
  <integer>{{START_INTERVAL_SEC}}</integer>
</dict>
</plist>
PLIST

sed -i '' "s|{{PLIST_LABEL}}|$PLIST_LABEL|g" "$PLIST_PATH"
sed -i '' "s|{{BIN_PATH}}|$BIN_PATH|g" "$PLIST_PATH"
sed -i '' "s|{{LOG_DIR}}|$LOG_DIR|g" "$PLIST_PATH"
sed -i '' "s|{{START_INTERVAL_SEC}}|$START_INTERVAL_SEC|g" "$PLIST_PATH"

USER_GUID="$(id -u)"
PLIST_ID="gui/$USER_GUID/$PLIST_LABEL"
if launchctl print "$PLIST_ID" >/dev/null 2>&1; then
  echo "LaunchAgent already loaded. Replacing configuration for $PLIST_ID."
  launchctl bootout "$PLIST_ID" || true
fi

launchctl bootstrap "gui/$USER_GUID" "$PLIST_PATH"
launchctl enable "$PLIST_ID"
echo "Installed LaunchAgent: $PLIST_ID"
echo "Plist: $PLIST_PATH"
echo "Logs: $LOG_DIR/idlewatch.out.log and $LOG_DIR/idlewatch.err.log"
if [[ -f "$CONFIG_ENV_PATH" ]]; then
  echo "Saved IdleWatch config found: $CONFIG_ENV_PATH"
  if [[ "$CONFIG_ENV_PATH" == "$HOME/.idlewatch/idlewatch.env" ]]; then
    echo "✓ Login startup will auto-load this config."
  else
    echo "⚠ Background runs auto-load only the default path: $HOME/.idlewatch/idlewatch.env"
    echo "   Move or copy to that location for login startup."
  fi
else
  echo "No saved IdleWatch config yet at: $CONFIG_ENV_PATH"
  echo ""
  echo "The LaunchAgent is already installed and will start at login."
  echo "Finish setup to give it a saved config:"
  if command -v idlewatch >/dev/null 2>&1; then
    echo "   idlewatch quickstart"
  fi
  echo "   $BIN_PATH quickstart"
  echo ""
  echo "After setup, re-run this install script once to restart the background agent with the new config."
  if command -v idlewatch >/dev/null 2>&1; then
    echo ""
    echo "💡 Quick status check:"
    echo "   Run 'idlewatch status' to see your device state, metrics enabled, and last publish result."
  fi
fi
