---
name: idlewatch
description: Collect host CPU/memory/GPU and optional OpenClaw usage telemetry, keep a local log, and optionally link this device to IdleWatch cloud.
---

# IdleWatch Skill

## Try it once

```bash
npx idlewatch quickstart --no-tui
```

Use `npx` for one-off setup, foreground testing, or a quick local-only run.

## Install it

```bash
npm install -g idlewatch
```

Then run:

```bash
idlewatch quickstart --no-tui
```

## Common commands

```bash
idlewatch quickstart --no-tui   # set up this device
idlewatch configure --no-tui    # update saved setup
idlewatch --once                # one-shot publish check
idlewatch --test-publish        # alias for --once
idlewatch --dry-run             # preview metrics without publishing
idlewatch run                   # continuous foreground collection
idlewatch install-agent         # enable background mode on macOS
```

`idlewatch` is the main command. `idlewatch-agent` still works as a compatibility alias, but prefer `idlewatch` in docs and copy-paste commands.

## Setup notes

- Setup saves config to `~/.idlewatch/idlewatch.env`
- Local-only mode works without any cloud key
- Cloud linking is optional
- Update setup later with `idlewatch configure --no-tui`
- Saved changes apply on the next start
- Background mode is a durable-install feature; after `npx` setup, install once with `npm install -g idlewatch`, then run `idlewatch install-agent`
- If background mode is already on, re-run `idlewatch install-agent` to apply the saved config

## Environment

- `IDLEWATCH_HOST` optional custom host label
- `IDLEWATCH_INTERVAL_MS` sampling interval (default 10000)
- `IDLEWATCH_LOCAL_LOG_PATH` optional local NDJSON durability log path
- `IDLEWATCH_OPENCLAW_USAGE` usage lookup mode (`auto` or `off`)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` (preferred)
- `FIREBASE_SERVICE_ACCOUNT_B64` (legacy)

## Output fields

- `cpuPct`
- `memPct`
- `gpuPct` (darwin best-effort)
- `tokensPerMin` (OpenClaw usage when available)
- `openclawModel`
- `openclawTotalTokens`
