# idlewatch

Telemetry collector for IdleWatch.

## Install / Run

```bash
npm install -g idlewatch
idlewatch --help
```

On macOS global installs, IdleWatch now also drops a lightweight menu bar app into `~/Applications/IdleWatch.app` so quota/reset windows stay one click away. Rebuild that app manually any time with:

```bash
npm run install:macos-menubar
```

Or run it directly with npx:

```bash
npx idlewatch --help
npx idlewatch quickstart
npx idlewatch --dry-run
```

`quickstart` is the happy path: create an API key on idlewatch.com/api, run the wizard, pick a device name + metrics, and IdleWatch saves local config before sending a first sample. It prefers a bundled TUI binary when available, otherwise falls back to a local Cargo build only on developer machines that already have Cargo installed. Use `idlewatch quickstart --no-tui` to skip the TUI and stay on the plain text setup path.

Run `idlewatch --help` for all commands and options.

## Quickstart

### Recommended: guided enrollment

```bash
npx idlewatch quickstart
```

`idlewatch` is the primary package/command name. `idlewatch-skill` still works as a compatibility alias, but treat it as legacy in user-facing docs.

The wizard keeps setup small:
- asks for a **device name**
- asks for your **API key** from `idlewatch.com/api`
- lets you choose which **metrics** to collect
- saves local config to `~/.idlewatch/idlewatch.env`
- sends a first sample so the device can link right away

The saved config is auto-loaded on later runs, so you should not need to manually source the env file in normal use.

Then run a one-shot publish check any time with:

```bash
idlewatch --once
```

## More docs

- [OpenClaw usage ingestion](docs/OPENCLAW-INTEGRATION.md) — probe resolution, env vars, alerting. Set `IDLEWATCH_OPENCLAW_USAGE=off` to disable.
- [Self-hosted Firebase ingest](docs/FIREBASE.md) — manual wiring for advanced setups.
- [Validation & packaging](docs/VALIDATION.md) — CI gates, DMG packaging, release scripts.
