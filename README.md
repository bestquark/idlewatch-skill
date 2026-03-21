# idlewatch

Telemetry collector for IdleWatch.

## Install

```bash
npm install -g idlewatch
```

Or run directly with npx:

```bash
npx idlewatch quickstart
```

## Quickstart

1. Create an API key at [idlewatch.com/api](https://idlewatch.com/api)
2. Run the setup wizard:
   ```bash
   idlewatch quickstart
   ```
3. Pick a device name and metrics — done!

The wizard saves config to `~/.idlewatch/idlewatch.env` and sends a first sample so your device links right away. Config is auto-loaded on later runs.

Use `--no-tui` for plain-text prompts if the TUI isn't available.

## Verify & run

```bash
idlewatch --once       # one-shot publish check
idlewatch --dry-run    # preview collected metrics without publishing
idlewatch run          # start continuous collection
```

## Background collection (macOS)

```bash
idlewatch install-agent   # LaunchAgent for automatic startup
idlewatch menubar         # menu bar app for quick status
```

Run `idlewatch --help` for all commands and options.

## More docs

- [OpenClaw usage ingestion](docs/OPENCLAW-INTEGRATION.md) — probe resolution, env vars, alerting
- [Self-hosted Firebase ingest](docs/FIREBASE.md) — manual wiring for advanced setups
- [Validation & packaging](docs/VALIDATION.md) — CI gates, DMG packaging, release scripts
