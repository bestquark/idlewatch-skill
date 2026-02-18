# macOS LaunchAgent Setup

Run IdleWatch as a background service that starts automatically at login.

## Prerequisites

- IdleWatch.app installed (typically `/Applications/IdleWatch.app`)
- macOS 12+ (Monterey or later)
- Optional: Firebase credentials configured via `quickstart`

## Install

```bash
npm run install:macos-launch-agent
```

This creates a `launchd` plist at `~/Library/LaunchAgents/com.idlewatch.agent.plist` and loads it immediately.

### Configuration

All settings are optional environment variables set **before** running the install script:

| Variable | Default | Description |
|---|---|---|
| `IDLEWATCH_APP_PATH` | `/Applications/IdleWatch.app` | Path to installed app |
| `IDLEWATCH_APP_BIN` | `$APP_PATH/Contents/MacOS/IdleWatch` | Launcher binary |
| `IDLEWATCH_LAUNCH_AGENT_LABEL` | `com.idlewatch.agent` | Plist label |
| `IDLEWATCH_LAUNCH_AGENT_LOG_DIR` | `~/Library/Logs/IdleWatch` | Log output directory |
| `IDLEWATCH_INTERVAL_MS` | `10000` | Collection interval (min 60s for StartInterval) |

### Custom app path

```bash
IDLEWATCH_APP_PATH="$HOME/Applications/IdleWatch.app" npm run install:macos-launch-agent
```

## Uninstall

```bash
npm run uninstall:macos-launch-agent
```

Removes the plist and unloads the agent from launchd.

## Logs

```bash
# stdout
tail -f ~/Library/Logs/IdleWatch/idlewatch.out.log

# stderr
tail -f ~/Library/Logs/IdleWatch/idlewatch.err.log
```

## Verify

```bash
# Check if running
launchctl print gui/$(id -u)/com.idlewatch.agent

# Quick health check
/Applications/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run --json | python3 -m json.tool
```

## Troubleshooting

- **Agent not starting:** Check `~/Library/Logs/IdleWatch/idlewatch.err.log` for errors.
- **Permission denied:** Ensure the binary is executable: `chmod +x /Applications/IdleWatch.app/Contents/MacOS/IdleWatch`
- **Stale telemetry:** If `openclawUsageAgeMs` stays high, OpenClaw may be idle — this is expected behavior (see `docs/telemetry/idle-stale-policy.md`).
- **Reinstall after update:** After installing a new IdleWatch.app, re-run the install script to reload the agent.
