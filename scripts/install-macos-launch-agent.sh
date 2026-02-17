#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${IDLEWATCH_APP_PATH:-/Applications/IdleWatch.app}"
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
  echo "IdleWatch launcher executable not found or not executable: $BIN_PATH" >&2
  echo "Set IDLEWATCH_APP_BIN to the correct binary path before running this script." >&2
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
