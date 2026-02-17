# idlewatch-skill

Telemetry collector for IdleWatch.

## Install / Run

```bash
npm install
npm start
```

With npx (after publish):

```bash
npx idlewatch-skill --help
npx idlewatch-skill --dry-run
```

## CLI options

- `--help`: show usage
- `--dry-run`: collect one sample and exit (no Firebase write)
- `--once`: collect one sample, publish to Firebase when configured, then exit

## Reliability improvements

- Local NDJSON durability log at `logs/<host>-metrics.ndjson` (override via `IDLEWATCH_LOCAL_LOG_PATH`)
- Retry-once+ for transient Firestore write failures
- Non-overlapping scheduler loop (prevents concurrent sample overlap when host is busy)
- Non-blocking CPU sampling using per-tick CPU deltas (no `Atomics.wait` stall)
- Darwin GPU probing fallback chain (AGX/IOGPU `ioreg` → `powermetrics` → `top` grep) with provenance fields (`gpuSource`, `gpuConfidence`, `gpuSampleWindowMs`)
- macOS memory pressure enrichment via `memory_pressure -Q` (`memPressurePct`, `memPressureClass`, `source.memPressureSource`)

## Firebase wiring

Copy `.env.example` and set:

```bash
export FIREBASE_PROJECT_ID=your-project
export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

Legacy (still supported):

```bash
export FIREBASE_SERVICE_ACCOUNT_B64=$(base64 -i serviceAccount.json)
```

Firestore emulator mode (no service-account JSON required):

```bash
export FIREBASE_PROJECT_ID=idlewatch-dev
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

If Firebase env vars are incomplete or invalid, the CLI exits with a clear configuration error.
If Firebase vars are omitted entirely, it runs in local-only mode and prints telemetry to stdout.

Validation helpers:
- `npm run validate:firebase-emulator-mode` verifies emulator-only config wiring in dry-run mode.
- `npm run validate:firebase-write-once` performs a single real write attempt (use with emulator or production credentials).

## OpenClaw usage ingestion (best effort)

By default (`IDLEWATCH_OPENCLAW_USAGE=auto`), the agent attempts to read OpenClaw
session usage from local CLI JSON endpoints when available, then enriches samples with.

Binary resolution order for the OpenClaw probe:
1. `IDLEWATCH_OPENCLAW_BIN` (if set)
2. `/opt/homebrew/bin/openclaw`
3. `/usr/local/bin/openclaw`
4. `openclaw` (PATH lookup)

- `IDLEWATCH_OPENCLAW_BIN` optionally pins the exact OpenClaw binary path for packaged/non-interactive runtimes.
- `IDLEWATCH_USAGE_STALE_MS` controls staleness classification window for usage timestamps
  (default: `max(IDLEWATCH_INTERVAL_MS*3, 60000)`).
- `IDLEWATCH_USAGE_NEAR_STALE_MS` controls "aging" classification before stale
  (default: `floor(IDLEWATCH_USAGE_STALE_MS*0.75)`).
- `IDLEWATCH_USAGE_STALE_GRACE_MS` adds a grace window before `usageIntegrationStatus`
  flips to `stale` (default: `min(IDLEWATCH_INTERVAL_MS, 10000)`).
- `IDLEWATCH_OPENCLAW_PROBE_RETRIES` retries full OpenClaw probe sweeps after the first pass
  to reduce transient command failures (default: `1`).
- `IDLEWATCH_USAGE_REFRESH_REPROBES` controls how many extra forced uncached reprobes run
  after crossing stale threshold (default: `1`, total attempts = reprobes + initial refresh).
- `IDLEWATCH_USAGE_REFRESH_DELAY_MS` waits between forced stale-threshold reprobes
  (default: `250`).
- `IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS` reuses the last successful OpenClaw usage
  snapshot after transient probe failures for up to this age (default: `max(stale+grace, 120000)`).

- `tokensPerMin`: explicit rate if available from OpenClaw, otherwise derived from `totalTokens / ageMinutes` for the selected recent session.
- `openclawModel`: active model name (from the selected recent session or defaults).
- `openclawTotalTokens`: total tokens for the selected recent session.
- `openclawSessionId`, `openclawAgentId`, `openclawUsageTs`: stable identifiers + timestamp alignment fields.
- `openclawUsageAgeMs`: derived age of usage snapshot (`sampleTs - openclawUsageTs`) when available.

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
- `source.usageAlertReason`: `healthy | activity-near-stale | activity-past-threshold | activity-stale | ingestion-unavailable | usage-disabled`.
- `source.usageFreshnessState`: `fresh | aging | stale | unknown`
- `source.usageNearStale`: boolean early warning signal when age crosses near-stale threshold.
- `source.usagePastStaleThreshold`: boolean showing age crossed stale threshold (before grace).
- `source.usageRefreshAttempted`: true when collector forced stale-threshold refresh logic.
- `source.usageRefreshRecovered`: true when forced refresh recovered below stale-threshold crossing.
- `source.usageRefreshAttempts`: number of forced refresh attempts actually executed.
- `source.usageRefreshReprobes`: configured extra forced reprobes (`IDLEWATCH_USAGE_REFRESH_REPROBES`).
- `source.usageRefreshDelayMs`: configured delay between reprobes (`IDLEWATCH_USAGE_REFRESH_DELAY_MS`).
- `source.usageCommand`: command used (`openclaw status --json`, etc.)
- `source.usageProbeResult`: `ok | fallback-cache | disabled | command-missing | command-error | parse-error | unavailable`.
- `source.usageProbeAttempts`: number of probe attempts in the current refresh window.
- `source.usageProbeSweeps`: number of probe sweeps performed in the current refresh window.
- `source.usageProbeRetries`: configured retry count (`IDLEWATCH_OPENCLAW_PROBE_RETRIES`).
- `source.usageProbeError`: compact failure reason when probing fails.
- `source.usageUsedFallbackCache`: boolean indicating whether last-good usage cache was used this sample.
- `source.usageFallbackCacheAgeMs`: age of fallback cache snapshot when used, otherwise `null`.
- `source.usageStaleMsThreshold`: threshold used for stale classification.
- `source.usageNearStaleMsThreshold`: threshold used for aging classification.
- `source.usageStaleGraceMs`: grace window before stale status activation.
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
- Prompt/completion token fields and request/min are **not currently exposed as first-class metrics** in IdleWatch rows; keep `null`/absent rather than synthesizing fake values.

If OpenClaw stats are unavailable, usage fields are emitted as `null` and collection continues.
Set `IDLEWATCH_OPENCLAW_USAGE=off` to disable lookup.

## Packaging scaffold

DMG release scaffolding is included:

- `docs/packaging/macos-dmg.md`
- `scripts/package-macos.sh`
- `scripts/build-dmg.sh`
- `npm run validate:trusted-prereqs` (local preflight for signing identity + notary profile)
- `npm run package:trusted` (strict signed + notarized local path)
- `.github/workflows/release-macos-trusted.yml` (signed + notarized CI path)
- CI dry-run schema gates via `npm run validate:dry-run-schema` and `npm run validate:packaged-dry-run-schema` (packaged validator auto-rebuilds `IdleWatch.app` first to avoid stale-artifact mismatches)
- Usage freshness transition gate via `npm run validate:usage-freshness-e2e` (simulates long-window aging→stale transitions end-to-end)
- DMG install smoke gate via `npm run validate:dmg-install` (mounts DMG, copies app, validates launcher dry-run schema)

Strict packaging mode:
- Set `IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION=1` to hard-fail packaging unless trust prerequisites are configured.
- In strict mode, `package-macos.sh` requires `MACOS_CODESIGN_IDENTITY`.
- In strict mode, `build-dmg.sh` requires both `MACOS_CODESIGN_IDENTITY` and `MACOS_NOTARY_PROFILE`.
- `npm run package:trusted` now runs `npm run validate:trusted-prereqs` first to fail fast when local keychain/notary setup is missing.

Trusted-release workflow required secrets:

- `MACOS_CODESIGN_IDENTITY`
- `APPLE_DEVELOPER_ID_APP_P12_BASE64`
- `APPLE_DEVELOPER_ID_APP_P12_PASSWORD`
- `APPLE_BUILD_KEYCHAIN_PASSWORD`
- `APPLE_NOTARY_KEY_ID`
- `APPLE_NOTARY_ISSUER_ID`
- `APPLE_NOTARY_API_KEY_P8`

Trusted release workflow policy:
- OpenClaw usage-health is enforced by default in `.github/workflows/release-macos-trusted.yml` via `npm run validate:packaged-usage-health` before artifact upload.
