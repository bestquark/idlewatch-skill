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

```bash
npx idlewatch quickstart --no-tui  # plain text fallback
```

Use the `npx` path when you want to try IdleWatch without installing it first.

> **Note:** Add `--no-tui` any time you want the simplest plain-text setup path.

## Quickstart

```bash
idlewatch quickstart
```

```bash
idlewatch quickstart --no-tui  # plain text fallback
```

Pick a device name, choose local-only or cloud, and you’re done.

The wizard saves config to `~/.idlewatch/idlewatch.env` and sends a first sample right away. Local-only mode works without an API key. If you want cloud publishing, the wizard will ask for an API key from [idlewatch.com/api](https://idlewatch.com/api).

To change settings later, run:

```bash
idlewatch configure --no-tui
```

Saved changes apply next time IdleWatch starts. If background mode is already on, re-run `idlewatch install-agent` to apply the saved config.

Use `--no-tui` any time you want the simplest plain-text setup path.

## Verify & run

```bash
idlewatch --once              # one-shot publish check
idlewatch --test-publish      # alias for --once
idlewatch --dry-run           # preview collected metrics without publishing
idlewatch run                 # start continuous collection
```

## Background mode (macOS)

Use `npx idlewatch quickstart` for one-off setup or foreground testing.
Or use `npx idlewatch quickstart --no-tui` if you want the plain-text fallback.
For durable background mode, install once, then turn it on:

```bash
npm install -g idlewatch  # install once
idlewatch install-agent   # turn on background mode
idlewatch menubar         # optional menu bar app for quick status
```

Run `idlewatch --help` for all commands and options.

## More docs

- [OpenClaw usage ingestion](docs/OPENCLAW-INTEGRATION.md) — probe resolution, env vars, alerting
- [Self-hosted Firebase ingest](docs/FIREBASE.md) — manual wiring for advanced setups
- [Validation & packaging](docs/VALIDATION.md) — CI gates, DMG packaging, release scripts
