# macOS Background Mode

Turn on IdleWatch background mode.

## Prerequisites

- IdleWatch.app installed (typically `/Applications/IdleWatch.app`)
- macOS 12+ (Monterey or later)
- Optional: saved IdleWatch config from `idlewatch quickstart --no-tui` if you want the agent to publish to IdleWatch Cloud right away

## Install

For a normal packaged-app install:

```bash
/Applications/IdleWatch.app/Contents/Resources/payload/package/scripts/install-macos-launch-agent.sh
```

For a source checkout / maintainer workflow:

```bash
npm run install:macos-launch-agent
```

This installs background mode at `~/Library/LaunchAgents/com.idlewatch.agent.plist`.

- If `~/.idlewatch/idlewatch.env` already exists from `idlewatch quickstart --no-tui`, the install also loads the agent right away so background mode turns on immediately.
- If setup has not been saved yet, the plist is installed but left unloaded until you finish setup. That keeps the first-run flow simpler and avoids a half-configured background process.

Config changes are picked up next time IdleWatch starts. After running `idlewatch quickstart --no-tui` or changing settings, re-run the install script once to turn background mode on or apply the saved config.

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

For a packaged app outside `/Applications`, pick a different label so you do not replace the normal login item by accident:

```bash
IDLEWATCH_APP_PATH="$HOME/Applications/IdleWatch.app" \
IDLEWATCH_LAUNCH_AGENT_LABEL="com.idlewatch.agent.qa" \
  "$HOME/Applications/IdleWatch.app/Contents/Resources/payload/package/scripts/install-macos-launch-agent.sh"
```

For a source checkout / maintainer workflow:

```bash
IDLEWATCH_APP_PATH="$HOME/Applications/IdleWatch.app" \
IDLEWATCH_LAUNCH_AGENT_LABEL="com.idlewatch.agent.qa" \
  npm run install:macos-launch-agent
```

IdleWatch now refuses custom app-path or custom plist-root installs that still reuse the default label `com.idlewatch.agent`, because that label could replace another IdleWatch background-mode install.

## Uninstall

For a normal packaged-app install:

```bash
/Applications/IdleWatch.app/Contents/Resources/payload/package/scripts/uninstall-macos-launch-agent.sh
```

For a source checkout / maintainer workflow:

```bash
npm run uninstall:macos-launch-agent
```

Turns background mode off and removes its plist.

## Logs

```bash
# stdout
tail -f ~/Library/Logs/IdleWatch/idlewatch.out.log

# stderr
tail -f ~/Library/Logs/IdleWatch/idlewatch.err.log
```

## Verify

If you changed `IDLEWATCH_LAUNCH_AGENT_LABEL`, use that label in the `launchctl print` command below.

```bash
# Check if running
launchctl print gui/$(id -u)/com.idlewatch.agent

# Quick health check (extract the telemetry JSON row)
/Applications/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run | tail -n 1 | python3 -m json.tool
```

## Troubleshooting

- **Agent not starting:** Check `~/Library/Logs/IdleWatch/idlewatch.err.log` for errors.
- **Permission denied:** Ensure the binary is executable: `chmod +x /Applications/IdleWatch.app/Contents/MacOS/IdleWatch`
- **Stale telemetry:** If `openclawUsageAgeMs` stays high, OpenClaw may be idle — this is expected behavior (see `docs/telemetry/idle-stale-policy.md`).
- **Reinstall after update:** After installing a new IdleWatch.app, re-run the install script to reload the agent.
