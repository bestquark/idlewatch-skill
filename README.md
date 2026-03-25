# idlewatch

Telemetry collector for IdleWatch.

## Install

```bash
npm install -g idlewatch
```

Or run directly with npx for one-off setup or foreground testing:

```bash
npx idlewatch quickstart
```

Use the `npx` path when you want to try IdleWatch without installing it first.

> **Note:** On platforms without a bundled TUI binary, add `--no-tui` to go straight to text prompts.

## Quickstart

```bash
idlewatch quickstart
```

Pick a device name, choose local-only or cloud, and you’re done.

The wizard saves config to `~/.idlewatch/idlewatch.env` and sends a first sample right away. Local-only mode works without an API key. If you want cloud publishing, the wizard will ask for an API key from [idlewatch.com/api](https://idlewatch.com/api).

Config is auto-loaded when IdleWatch starts. If you change settings later, they apply on the next start.

Use `--no-tui` for plain-text prompts if the TUI isn't available.

## Verify & run

```bash
idlewatch --once              # one-shot publish check
idlewatch --test-publish      # alias for --once
idlewatch --dry-run           # preview collected metrics without publishing
idlewatch run                 # start continuous collection
```

## Background collection (macOS)

Background mode needs a durable install.

- `npx idlewatch quickstart` is great for one-off setup and foreground testing.
- Install IdleWatch first before using `install-agent`.

```bash
npm install -g idlewatch
idlewatch install-agent   # LaunchAgent for automatic startup
idlewatch menubar         # menu bar app for quick status
```

Run `idlewatch --help` for all commands and options.

## More docs

- [OpenClaw usage ingestion](docs/OPENCLAW-INTEGRATION.md) — probe resolution, env vars, alerting
- [Self-hosted Firebase ingest](docs/FIREBASE.md) — manual wiring for advanced setups
- [Validation & packaging](docs/VALIDATION.md) — CI gates, DMG packaging, release scripts
