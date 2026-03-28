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
DEFAULT_CONFIG_ENV_PATH="$HOME/.idlewatch/idlewatch.env"
HAS_SAVED_CONFIG=0
if [[ -f "$CONFIG_ENV_PATH" ]]; then
  HAS_SAVED_CONFIG=1
fi

with_config_command() {
  local command="$1"
  if [[ "$CONFIG_ENV_PATH" != "$DEFAULT_CONFIG_ENV_PATH" ]]; then
    printf 'IDLEWATCH_CONFIG_ENV_PATH=%q %s\n' "$CONFIG_ENV_PATH" "$command"
  else
    printf '%s\n' "$command"
  fi
}

with_install_agent_command() {
  local command="$1"
  local prefix=''

  if [[ "$PLIST_LABEL" != "$DEFAULT_PLIST_LABEL" ]]; then
    prefix="IDLEWATCH_LAUNCH_AGENT_LABEL=$(printf '%q' "$PLIST_LABEL")"
  fi

  if [[ "$CONFIG_ENV_PATH" != "$DEFAULT_CONFIG_ENV_PATH" ]]; then
    local config_prefix
    config_prefix="IDLEWATCH_CONFIG_ENV_PATH=$(printf '%q' "$CONFIG_ENV_PATH")"
    if [[ -n "$prefix" ]]; then
      prefix="$prefix $config_prefix"
    else
      prefix="$config_prefix"
    fi
  fi

  if [[ -n "$prefix" ]]; then
    printf '%s %s\n' "$prefix" "$command"
  else
    printf '%s\n' "$command"
  fi
}

xml_escape() {
  printf '%s' "$1" \
    | sed -e 's/&/\&amp;/g' \
          -e 's/</\&lt;/g' \
          -e 's/>/\&gt;/g' \
          -e "s/'/\&apos;/g" \
          -e 's/"/\&quot;/g'
}

sed_replacement_escape() {
  printf '%s' "$1" | sed -e 's/[&|\\]/\\&/g'
}

is_standard_app_path=0
if [[ "$APP_PATH" == "$DEFAULT_APP_PATH" || "$APP_PATH" == "$USER_APP_PATH" ]]; then
  is_standard_app_path=1
fi

if [[ "$PLIST_LABEL" == "$DEFAULT_PLIST_LABEL" ]] && \
   [[ "$PLIST_ROOT" != "$DEFAULT_PLIST_ROOT" || $is_standard_app_path -ne 1 ]]; then
  echo "Refusing to reuse the default background-mode label ($DEFAULT_PLIST_LABEL) with a custom app path or plist root." >&2
  echo "That could replace another IdleWatch background-mode install that already uses the default label." >&2
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

CONFIG_ENV_KEY_BLOCK=''
if [[ "$CONFIG_ENV_PATH" != "$HOME/.idlewatch/idlewatch.env" ]]; then
  CONFIG_ENV_PATH_ESCAPED_FOR_XML="$(xml_escape "$CONFIG_ENV_PATH")"
  CONFIG_ENV_KEY_BLOCK="
    <key>IDLEWATCH_CONFIG_ENV_PATH</key>
    <string>${CONFIG_ENV_PATH_ESCAPED_FOR_XML}</string>"
fi

cat > "$PLIST_PATH" <<PLIST
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
  {{RUN_AT_LOAD_VALUE}}
  <key>KeepAlive</key>
  {{KEEP_ALIVE_VALUE}}
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>{{LOG_DIR}}/idlewatch.out.log</string>
  <key>StandardErrorPath</key>
  <string>{{LOG_DIR}}/idlewatch.err.log</string>
  <key>StartInterval</key>
  <integer>{{START_INTERVAL_SEC}}</integer>
  <key>Disabled</key>
  {{DISABLED_VALUE}}
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>${CONFIG_ENV_KEY_BLOCK}
  </dict>
</dict>
</plist>
PLIST

if [[ $HAS_SAVED_CONFIG -eq 1 ]]; then
  RUN_AT_LOAD_VALUE='<true/>'
  KEEP_ALIVE_VALUE='<true/>'
  DISABLED_VALUE='<false/>'
else
  RUN_AT_LOAD_VALUE='<false/>'
  KEEP_ALIVE_VALUE='<false/>'
  DISABLED_VALUE='<true/>'
fi

PLIST_LABEL_ESCAPED="$(sed_replacement_escape "$(xml_escape "$PLIST_LABEL")")"
BIN_PATH_ESCAPED="$(sed_replacement_escape "$(xml_escape "$BIN_PATH")")"
LOG_DIR_ESCAPED="$(sed_replacement_escape "$(xml_escape "$LOG_DIR")")"
START_INTERVAL_SEC_ESCAPED="$(sed_replacement_escape "$START_INTERVAL_SEC")"
RUN_AT_LOAD_VALUE_ESCAPED="$(sed_replacement_escape "$RUN_AT_LOAD_VALUE")"
KEEP_ALIVE_VALUE_ESCAPED="$(sed_replacement_escape "$KEEP_ALIVE_VALUE")"
DISABLED_VALUE_ESCAPED="$(sed_replacement_escape "$DISABLED_VALUE")"

sed -i '' "s|{{PLIST_LABEL}}|$PLIST_LABEL_ESCAPED|g" "$PLIST_PATH"
sed -i '' "s|{{BIN_PATH}}|$BIN_PATH_ESCAPED|g" "$PLIST_PATH"
sed -i '' "s|{{LOG_DIR}}|$LOG_DIR_ESCAPED|g" "$PLIST_PATH"
sed -i '' "s|{{START_INTERVAL_SEC}}|$START_INTERVAL_SEC_ESCAPED|g" "$PLIST_PATH"
sed -i '' "s|{{RUN_AT_LOAD_VALUE}}|$RUN_AT_LOAD_VALUE_ESCAPED|g" "$PLIST_PATH"
sed -i '' "s|{{KEEP_ALIVE_VALUE}}|$KEEP_ALIVE_VALUE_ESCAPED|g" "$PLIST_PATH"
sed -i '' "s|{{DISABLED_VALUE}}|$DISABLED_VALUE_ESCAPED|g" "$PLIST_PATH"

USER_GUID="$(id -u)"
PLIST_ID="gui/$USER_GUID/$PLIST_LABEL"
WAS_ALREADY_LOADED=0
if launchctl print "$PLIST_ID" >/dev/null 2>&1; then
  WAS_ALREADY_LOADED=1
  if [[ $HAS_SAVED_CONFIG -eq 1 ]]; then
    echo "Background mode is already running. Refreshing its configuration."
  else
    echo "Background integration is already installed. Refreshing it."
  fi
  launchctl bootout "$PLIST_ID" || true
fi

if [[ $HAS_SAVED_CONFIG -eq 1 ]]; then
  launchctl bootstrap "gui/$USER_GUID" "$PLIST_PATH"
  launchctl enable "$PLIST_ID"
fi

if [[ $WAS_ALREADY_LOADED -eq 1 ]]; then
  echo "✅ Background mode refreshed."
else
  if [[ $HAS_SAVED_CONFIG -eq 1 ]]; then
    echo "✅ Background mode installed."
  else
    echo "✅ Background integration installed."
  fi
fi
echo "   Service: $PLIST_ID"
echo "   Plist:   $PLIST_PATH"
echo "   Logs:    $LOG_DIR/idlewatch.out.log and $LOG_DIR/idlewatch.err.log"
if [[ $HAS_SAVED_CONFIG -eq 1 ]]; then
  echo "Saved IdleWatch config found: $CONFIG_ENV_PATH"
  echo "✓ Background mode will use this saved config."
else
  echo "No saved IdleWatch config yet at: $CONFIG_ENV_PATH"
  echo ""
  echo "Setup isn't saved yet, so background mode stays off for now."
  echo "Finish setup:"
  if command -v idlewatch >/dev/null 2>&1; then
    printf '   %s\n' "$(with_config_command 'idlewatch quickstart --no-tui')"
    echo ""
    echo "Run now:"
    printf '   %s\n' "$(with_config_command 'idlewatch run')"
    echo ""
    echo "Turn on background mode after setup:"
    printf '   %s\n' "$(with_install_agent_command 'idlewatch install-agent')"
    echo ""
    echo "Check:"
    printf '   %s   See your saved config, background mode state, and last publish result\n' "$(with_config_command 'idlewatch status')"
  else
    printf '   %s\n' "$(with_config_command "$BIN_PATH quickstart --no-tui")"
    echo ""
    echo "Run now:"
    printf '   %s\n' "$(with_config_command "$BIN_PATH run")"
    echo ""
    echo "Turn on background mode after setup:"
    printf '   %s\n' "$(with_install_agent_command "$BIN_PATH install-agent")"
    echo ""
    echo "Check:"
    printf '   %s   See your saved config, background mode state, and last publish result\n' "$(with_config_command "$BIN_PATH status")"
  fi
fi
