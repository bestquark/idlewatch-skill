---
name: idlewatch
description: Collect host CPU/memory/GPU and optional OpenClaw usage telemetry, keep a local log, and optionally publish to IdleWatch cloud.
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

## Common commands

```bash
idlewatch quickstart      # guided setup
idlewatch --once          # one-shot publish check
idlewatch --test-publish  # alias for --once
idlewatch --dry-run       # preview metrics without publishing
idlewatch run             # continuous foreground collection
idlewatch install-agent   # enable background mode on macOS
```

`idlewatch` is the main command. `idlewatch-agent` is still available as a compatibility alias.

## Setup notes

- Setup saves config to `~/.idlewatch/idlewatch.env`
- Local-only mode works without any cloud key
- Cloud publishing is optional
- Re-open setup later with `idlewatch configure`
- Saved changes apply on the next start
- If background mode is already enabled, re-run `idlewatch install-agent` to refresh it with the saved config

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
