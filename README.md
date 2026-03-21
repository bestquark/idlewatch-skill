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

- `quickstart`: run first-run enrollment wizard
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

### Manual wiring

```bash
export FIREBASE_PROJECT_ID=your-project
export FIREBASE_SERVICE_ACCOUNT_FILE="$HOME/.idlewatch/credentials/your-project-service-account.json"
```

Raw JSON and base64 are still supported for compatibility, but **file-path credentials are preferred**:

```bash
export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
# or
export FIREBASE_SERVICE_ACCOUNT_B64=$(base64 -i serviceAccount.json)
```

Firestore emulator mode (no service-account JSON required):

```bash
export FIREBASE_PROJECT_ID=idlewatch-dev
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

Least-privilege guidance:
- Create a dedicated IdleWatch writer service account per environment/project.
- Grant only the Firestore write scope needed for `metrics` ingestion (avoid Owner/Editor roles).
- Store credentials as a file with user-only permissions (`chmod 600`) and reference via `FIREBASE_SERVICE_ACCOUNT_FILE`.

If Firebase env vars are incomplete or invalid, the CLI exits with a clear configuration error.
If Firebase vars are omitted entirely, it runs in local-only mode and prints telemetry to stdout.
`firebase-admin` is loaded lazily only when Firebase publish mode is configured, so dry-run/local-only flows remain resilient in minimal packaged/runtime environments.
Set `IDLEWATCH_REQUIRE_FIREBASE_WRITES=1` to fail fast when running `--once` without a working Firebase publish path.

See [docs/VALIDATION.md](docs/VALIDATION.md) for CI validation scripts, packaging, and release-gate helpers.


## OpenClaw usage ingestion (best effort)

By default (`IDLEWATCH_OPENCLAW_USAGE=auto`), the agent attempts to read OpenClaw
session usage from local CLI JSON endpoints when available, then enriches samples with.

Binary resolution order for the OpenClaw probe:
1. `IDLEWATCH_OPENCLAW_BIN` (if set)
2. `IDLEWATCH_OPENCLAW_BIN_HINT` (legacy packaged-launcher hint)
3. `/opt/homebrew/bin/openclaw`
4. `/usr/local/bin/openclaw`
5. `openclaw` (PATH lookup)

- Successful probe command/args are cached for the life of the process so subsequent samples and forced stale-threshold refreshes reuse the known-good command first before full probe sweep.

- `IDLEWATCH_OPENCLAW_BIN` optionally pins the exact OpenClaw binary path for packaged/non-interactive runtimes.
- `IDLEWATCH_OPENCLAW_BIN_STRICT=1` (optional) limits probing to only the explicit bin above when set, useful for deterministic tests. If `IDLEWATCH_OPENCLAW_BIN` is unset, `IDLEWATCH_OPENCLAW_BIN_HINT` is used as the explicit fallback in strict mode for launcher compatibility.
- `IDLEWATCH_OPENCLAW_BIN_HINT` is also supported for launcher compatibility in existing packaged flows.
- `IDLEWATCH_NODE_BIN` optionally pins the Node binary used by packaged app launcher (`IdleWatch.app`).
- `IDLEWATCH_NODE_RUNTIME_DIR` optionally bundles a portable Node runtime into `IdleWatch.app` (`<runtime>/bin/node` required) so installed apps can run on hosts without a global Node install.
- OpenClaw probe command preference used by the agent (first successful parse wins):
  1) `status --json`
  2) `usage --json`
  3) `session status --json`
  4) `session_status --json`
  5) `stats --json` (fallback compatibility for CLI variants)
  (default: `max(IDLEWATCH_INTERVAL_MS*3, 60000)`).
- `IDLEWATCH_USAGE_NEAR_STALE_MS` controls "aging" classification before stale
  (default: `floor((IDLEWATCH_USAGE_STALE_MS + IDLEWATCH_USAGE_STALE_GRACE_MS)*0.85)`).
- `IDLEWATCH_USAGE_STALE_GRACE_MS` adds a grace window before `usageIntegrationStatus`
  flips to `stale` (default: `min(IDLEWATCH_INTERVAL_MS, 10000)`).
- `IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES` caps OpenClaw probe output capture size for each command
  (default: `2097152` / 2MB). Increasing helps on noisy terminals, reducing ENOBUFS-like parse failures.
- `IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES_HARD_CAP` sets the upper ceiling for adaptive output-buffer retries when
  the command output exceeds the base cap (default: `16777216` / 16MB). Keep this conservative in shared/legacy
  environments to avoid memory spikes from runaway process logs.
- Probe output parsing merges both stdout and stderr in the probe collector, so mixed-output CLIs
  that print progress in stdout but emit JSON in stderr still parse successfully in one sweep.
- `IDLEWATCH_OPENCLAW_PROBE_RETRIES` retries full OpenClaw probe sweeps after the first pass
  to reduce transient command failures (default: `1`).
- `IDLEWATCH_USAGE_REFRESH_REPROBES` controls how many extra forced uncached reprobes run
  after crossing stale threshold (default: `1`, total attempts = reprobes + initial refresh).
- `IDLEWATCH_USAGE_REFRESH_DELAY_MS` waits between forced stale-threshold reprobes
  (default: `250`).
- `IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE` triggers proactive refresh when usage is near-stale
  to reduce stale flips in long packaging/QA loops (default: `1`).
- `IDLEWATCH_USAGE_IDLE_AFTER_MS` downgrades stale activity alerts to `activity-idle`
- stale usage after a failed freshness refresh now downgrades to `activity-no-new-usage` (ingestion healthy, but no newer usage observed)
  notice state after prolonged inactivity (default: `21600000` = 6h).
- `IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS` reuses the last successful OpenClaw usage
  snapshot after transient probe failures for up to this age (default: `max(stale+grace, 120000)`).
- `IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH` persists/reuses the last-good OpenClaw usage snapshot
  across process restarts (default: OS temp dir path keyed by host).

- `tokensPerMin`: explicit rate if available from OpenClaw, otherwise derived from `totalTokens / ageMinutes` for the selected recent session.
- `openclawModel`: active model name (from the selected recent session or defaults).
- `openclawTotalTokens`: total tokens for the selected recent session.
- `openclawSessionId`, `openclawAgentId`, `openclawUsageTs`: stable identifiers + timestamp alignment fields.
- `openclawUsageAgeMs`: derived age of usage snapshot (`sampleTs - openclawUsageTs`) when available, where `sampleTs` is the end-of-sample collector timestamp.
- `ts` and fleet `collectedAtMs` are the same collection timestamp (end of the collect cycle), which is typically a few milliseconds after final probe completion.

Selection logic for `openclaw status --json`:
1. Pick the most recently updated session among entries with non-null `totalTokens` and `totalTokensFresh !== false`.
2. Fallback to the most recently updated session among entries with non-null tokens.
3. Fallback to the most recently updated session entry.

Source metadata fields:
- `source.usage`: `openclaw | disabled | unavailable`
- `source.usageIntegrationStatus`: `ok | stale | disabled | unavailable`
- `source.usageIngestionStatus`: `ok | disabled | unavailable` (probe/path health independent of usage age).
- `source.usageActivityStatus`: `fresh | aging | stale | unknown | disabled | unavailable` (age-based activity state).
- `source.usageAlertLevel`: `ok | notice | warning | critical | off` (operator-facing alert severity derived from ingestion + activity semantics).
- `source.usageAlertReason`: `healthy | activity-idle | activity-near-stale | activity-past-threshold | activity-stale | activity-no-new-usage | ingestion-unavailable | usage-disabled`.
- `source.usageFreshnessState`: `fresh | aging | stale | unknown`
- `source.usageNearStale`: boolean early warning signal when age crosses near-stale threshold.
- `source.usagePastStaleThreshold`: boolean showing age crossed stale threshold (before grace).
- `source.usageRefreshAttempted`: true when collector forced stale-threshold refresh logic.
- `source.usageRefreshRecovered`: true when forced refresh recovered below stale-threshold crossing.
- `source.usageRefreshAttempts`: number of forced refresh attempts actually executed.
- `source.usageRefreshReprobes`: configured extra forced reprobes (`IDLEWATCH_USAGE_REFRESH_REPROBES`).
- `source.usageRefreshDelayMs`: configured delay between reprobes (`IDLEWATCH_USAGE_REFRESH_DELAY_MS`).
- `source.usageRefreshDurationMs`: total elapsed ms spent in the stale-threshold/proactive refresh path when triggered.
- `source.usageRefreshOnNearStale`: whether near-stale proactive refresh is enabled (`IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE`).
- `source.usageIdle`: boolean indicating usage age crossed idle window (`IDLEWATCH_USAGE_IDLE_AFTER_MS`).
- `source.usageCommand`: command used (`openclaw status --json`, etc.)

OpenClaw parsing hardened in this release:
- stringified numeric fields (for example `"totalTokens": "12345"` or `"updatedAt": "1771278999999"`) are now accepted
- mixed timestamp names, epoch-seconds variants (`1771278800`), and alternate session container keys are supported
- wrapped status payload shapes (`result` root object, `data.result` wrappers, top-level `sessions` array, nested usage totals/`totals` object) are supported with precedence-aware session selection
- timestamp aliases in both `snake_case` and millis variants are normalized (for example `usage_ts`, `usage_ts_ms`, `usage_timestamp`, `usage_timestamp_ms`, `updated_at_ms`, `ts_ms`) so parser keeps working across CLI serializers
- direct session object payloads (`session`, `activeSession`, `currentSession`) are now handled alongside array/map forms
- sessions as arrays are supported (for example `status.stats.current.sessions`) in addition to map/object `sessions` containers
- sessions maps keyed by session id are supported (`sessions` as object map) to avoid regressions on alternate OpenClaw serializers
- metadata keys like `sessions.defaults` are ignored during session-map selection so tokenized sessions are not shadowed by defaults payloads
- stale-token markers like `"totalTokensFresh": "false"` are correctly interpreted as freshness metadata rather than causing parser failure
- `source.usageProbeResult`: `ok | fallback-cache | disabled | command-missing | command-error | parse-error | unavailable`.
- `source.usageProbeAttempts`: number of probe attempts in the current refresh window.
- `source.usageProbeSweeps`: number of probe sweeps performed in the current refresh window.
- `source.usageProbeRetries`: configured retry count (`IDLEWATCH_OPENCLAW_PROBE_RETRIES`).
- `source.usageProbeError`: compact failure reason when probing fails.
- `source.usageUsedFallbackCache`: boolean indicating whether last-good usage cache was used this sample.
- `source.usageFallbackCacheAgeMs`: age of fallback cache snapshot when used, otherwise `null`.
- `source.usageFallbackCacheSource`: `memory | disk | null` indicating fallback cache origin.
- `source.usageStaleMsThreshold`: threshold used for stale classification.
- `source.usageNearStaleMsThreshold`: threshold used for aging classification.
- `source.usageStaleGraceMs`: grace window before stale status activation.
- `source.usageIdleAfterMsThreshold`: threshold used to classify prolonged inactivity.
- `source.memPressureSource`: `memory_pressure | unavailable | unsupported`.

Memory field semantics:
- `memPct` and `memUsedPct`: host memory used percent (`(total - free) / total`) retained for backward compatibility.
- `memPressurePct`: macOS pressure estimate derived from `memory_pressure -Q` output when available.
- `memPressureClass`: `normal | warning | critical | unavailable` using thresholds `<75`, `75-89.99`, `>=90`.

Alerting guidance (recommended):
- Prefer `memPressureClass` as the primary memory alert signal.
- Suggested warning threshold: trigger when `memPressureClass=warning` for 3+ consecutive samples.
- Suggested critical threshold: trigger immediately when `memPressureClass=critical`, or when `memPressurePct>=90` for 2+ consecutive samples.
- Keep `memPct`/`memUsedPct` as informational context only (do not page solely on these).
- For OpenClaw reliability alerts, page on `source.usageIngestionStatus=unavailable` (or sustained probe failures), not on `usageActivityStatus=stale` alone.
- If you want one-field routing in dashboards, use `source.usageAlertLevel`: page on `critical`, ticket on sustained `warning`, and keep `notice` informational.

Usage field semantics:
- `openclawTotalTokens`: session-level cumulative total tokens reported by OpenClaw.
- `tokensPerMin`: reported directly by OpenClaw when available; otherwise derived from `openclawTotalTokens / session age minutes`.
- Additional parser compatibility covered for data-wrapper/session wrapper stats payloads (`payload`, `data.result`, `data.stats`, `result`), direct `current` payloads (`current`, `data.current`, `result.current`, `status.current`, `payload.current`) and snake_case session aliases under status-like envelopes (for example `current_session`, `active_session`, `session_id`, `agent_id`, `default_model`, `usage_ts`, `recent_sessions`) so common OpenClaw CLI variants map into a stable row shape.
- Prompt/completion token fields and request/min are **not currently exposed as first-class metrics** in IdleWatch rows; keep `null`/absent rather than synthesizing fake values.

If OpenClaw stats are unavailable, usage fields are emitted as `null` and collection continues.
Set `IDLEWATCH_OPENCLAW_USAGE=off` to disable lookup.

## Packaging & Release

See [docs/VALIDATION.md](docs/VALIDATION.md) for DMG packaging, code signing, CI release gates, and all `npm run validate:*` scripts.
