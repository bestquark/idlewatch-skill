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

## CLI options

- `quickstart`/`configure`/`reconfigure`: run wizard or re-open setup flow
- `--help`: show usage
- `--dry-run`: collect one sample and exit without remote writes
- `--once`: collect one sample, publish it using the active configured path, then exit

## Reliability improvements

- Local NDJSON durability log at `~/.idlewatch/logs/<host>-metrics.ndjson` (override via `IDLEWATCH_LOCAL_LOG_PATH`)
- Retry-once+ for transient publish failures (cloud ingest and Firebase paths)
- Non-overlapping scheduler loop (prevents concurrent sample overlap when host is busy)
- Non-blocking CPU sampling using per-tick CPU deltas (no `Atomics.wait` stall)
- Darwin GPU probing fallback chain (AGX/IOGPU `ioreg` → `powermetrics` → `top` grep) with provenance fields (`gpuSource`, `gpuConfidence`, `gpuSampleWindowMs`)
- macOS memory pressure enrichment via `memory_pressure -Q` (`memPressurePct`, `memPressureClass`, `source.memPressureSource`)

## macOS GPU support matrix (observed)

The collector is tuned for these macOS probe paths by platform:

- Apple Silicon (AGX/iGPU): prefer `ioreg` performance statistics (`AGX`) first for live GPU utilization.
- Intel Macs: prefer `powermetrics` if permission profile allows; fall back to `top` parser.
- Unsupported hosts / older macOS: emit `gpuSource: "unavailable"` with `gpuConfidence: "none"` and clear source metadata.

Use `gpuSource` + `gpuConfidence` in dashboards to decide whether to trust values:
- `high`: authoritative per-command path for host class
- `medium`: derived/proxied path with best-effort parsing
- `low`: constrained probe path
- `none`: no usable sample for that sample window

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

## Advanced Firebase wiring

For self-hosted Firebase ingest (most users don't need this), see [docs/FIREBASE.md](docs/FIREBASE.md).

See [docs/VALIDATION.md](docs/VALIDATION.md) for CI validation scripts, packaging, and release-gate helpers.


## OpenClaw usage ingestion

By default, IdleWatch enriches samples with OpenClaw session usage (model, tokens, activity) when available. Set `IDLEWATCH_OPENCLAW_USAGE=off` to disable. If OpenClaw is unavailable, usage fields are `null` and collection continues normally.

See [docs/OPENCLAW-INTEGRATION.md](docs/OPENCLAW-INTEGRATION.md) for probe resolution, env vars, source metadata fields, alerting guidance, and parser details.

## Packaging & Release

See [docs/VALIDATION.md](docs/VALIDATION.md) for DMG packaging, code signing, CI release gates, and all `npm run validate:*` scripts.
