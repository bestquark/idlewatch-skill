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
npx idlewatch-skill quickstart
npx idlewatch-skill --dry-run
```

`quickstart` runs a first-run enrollment wizard that writes a local env file and (for production mode) stores a locked-down copy of the service-account key in a user config directory (`~/Library/Application Support/IdleWatch` on macOS).

## CLI options

- `quickstart`: run first-run enrollment wizard
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

## Firebase wiring

### Recommended: guided enrollment (external users)

```bash
npx idlewatch-skill quickstart
```

The wizard supports:
- **Production mode**: prompts for project id + service-account JSON file path, validates it, copies credentials to a local secure path (0600), and writes `FIREBASE_SERVICE_ACCOUNT_FILE=...`.
- **Emulator mode**: writes `FIREBASE_PROJECT_ID` + `FIRESTORE_EMULATOR_HOST` only.
- **Local-only mode**: writes no Firebase credentials.

Then load generated env and run:

```bash
set -a; source "$HOME/Library/Application Support/IdleWatch/idlewatch.env"; set +a
idlewatch-agent --once
```

### Manual wiring

```bash
export FIREBASE_PROJECT_ID=your-project
export FIREBASE_SERVICE_ACCOUNT_FILE="$HOME/Library/Application Support/IdleWatch/credentials/your-project-service-account.json"
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

Validation helpers:
- `npm run validate:onboarding` validates non-interactive quickstart enrollment output (env + secure credential copy).
- `npm run validate:firebase-emulator-mode` verifies emulator-only config wiring in dry-run mode.
- `npm run validate:firebase-write-once` performs a single real write attempt (use with emulator or production credentials).
- `npm run validate:firebase-write-required-once` is the strict variant and fails fast unless a Firebase write path is configured and successful.
- `npm run validate:openclaw-usage-health` validates that dry-run telemetry stays on `source.usage=openclaw` with healthy integration/ingestion in OpenClaw-required mode (mocked CLI probe path).
- `npm run validate:openclaw-stats-ingestion` validates `openclaw stats --json`-only payload ingestion (mocked CLI probe fallback path).
- `npm run validate:openclaw-release-gates` validates host OpenClaw checks (`validate:openclaw-usage-health`, `validate:openclaw-stats-ingestion`, and `validate:openclaw-cache-recovery-e2e`) in one gate.
- `npm run validate:openclaw-release-gates:all` runs both host and packaged OpenClaw release gates in one command (`validate:openclaw-release-gates` + `validate:packaged-openclaw-release-gates:reuse-artifact`) and is the shortest local loop before CI.
- `npm run validate:packaged-openclaw-stats-ingestion` validates packaged-app stats fallback ingestion under a mocked `openclaw` binary (end-to-end packaged dry-run + `stats --json` command selection).
- `npm run validate:packaged-openclaw-cache-recovery-e2e` validates packaged-app stale-cache recovery behavior with temporary probe failures and reprobe refresh logic.
- `npm run validate:packaged-openclaw-release-gates` validates `validate:packaged-usage-health`, `validate:packaged-openclaw-stats-ingestion`, and `validate:packaged-openclaw-cache-recovery-e2e` together as one release gate.
- `npm run validate:packaged-openclaw-release-gates:all` runs both fresh-package and reuse-artifact OpenClaw packaged checks (for local validation when packaging cost is acceptable).
- `npm run validate:packaged-openclaw-release-gates:reuse-artifact` validates the same three checks against an already-packaged artifact (`IDLEWATCH_SKIP_PACKAGE_MACOS=1`) and is the command used in CI/release smoke for repeatable execution.

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
- `IDLEWATCH_OPENCLAW_BIN_STRICT=1` (optional) limits probing to only the explicit bin above when set, useful for deterministic tests.
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

## Packaging scaffold

DMG release scaffolding is included:

- `docs/onboarding-external.md` (external-user quickstart + signed DMG rollout)
- `docs/packaging/macos-dmg.md`
- `scripts/package-macos.sh`
  - Produces `dist/IdleWatch.app/Contents/Resources/packaging-metadata.json` with build provenance for QA/supportability.
- `scripts/build-dmg.sh`
- `npm run validate:trusted-prereqs` (local preflight for signing identity + notary profile)
- `npm run validate:dmg-checksum` (verifies SHA-256 checksum generated by `package:dmg`)
- `npm run package:trusted` (strict signed + notarized local path)
- `npm run package:release` (trusted packaging + checksum validation in one step)
- `.github/workflows/release-macos-trusted.yml` (signed + notarized CI path)
- CI dry-run schema gates via `npm run validate:dry-run-schema` and `npm run validate:packaged-dry-run-schema` (packaged validator auto-rebuilds `IdleWatch.app` first to avoid stale-artifact mismatches)
- Usage freshness transition gate via `npm run validate:usage-freshness-e2e` (simulates long-window aging→stale transitions end-to-end)
- Usage alert-rate quality gate via `npm run validate:usage-alert-rate-e2e` (asserts typical low-traffic ages stay `usageAlertLevel=ok`, with deterministic boundary escalation)
- Packaged usage alert-rate gate via `npm run validate:packaged-usage-alert-rate-e2e` (verifies alert transitions in packaged launcher runtime path)
- Packaged usage-age SLO gate via `npm run validate:packaged-usage-age-slo` (requires OpenClaw usage and enforces `openclawUsageAgeMs <= 300000` on packaged dry-run)
- Dry-run gate timeout via `IDLEWATCH_DRY_RUN_TIMEOUT_MS` (default: `15000`)
  - Applied by `scripts/validate-dry-run-schema.mjs` to all `--dry-run` schema checks (direct and packaged).
  - On timeout, validators keep the latest captured row and still validate it when possible, preventing hangs on non-terminating launcher output.
- Packaged stale-threshold recovery gate via `npm run validate:packaged-usage-recovery-e2e` (asserts packaged launcher performs forced reprobe recovery when initial usage age is post-threshold)
- OpenClaw fallback-cache recovery gate via `npm run validate:openclaw-cache-recovery-e2e` (asserts fallback cache usage with stale age still attempts a forced reprobe and recovers to fresh state when the command comes back)
- DMG install smoke gate via `npm run validate:dmg-install` (mounts DMG, copies app, validates launcher dry-run schema)
- Optional portable Node runtime bundling for packaged launcher (`IDLEWATCH_NODE_RUNTIME_DIR=/path/to/runtime` with `<runtime>/bin/node`), enabling resolution order: `IDLEWATCH_NODE_BIN` → bundled runtime → `PATH` (`node`).
  - Runtime copy is now limited to `bin`, `lib`, and `include` directories (with symlink dereference) to keep runtime payloads portable and avoid noise from host-specific completion symlinks.
- Bundled-runtime packaging gate via `npm run validate:packaged-bundled-runtime` (repackages with a bundled runtime and verifies launcher dry-run succeeds with `PATH=/usr/bin:/bin` where `node` is absent).
- Background execution lifecycle helpers:
  - `scripts/install-macos-launch-agent.sh`
  - `scripts/uninstall-macos-launch-agent.sh`
  - Install an auto-starting `LaunchAgent` via `IDLEWATCH_APP_PATH`, `IDLEWATCH_LAUNCH_AGENT_LABEL`, `IDLEWATCH_LAUNCH_AGENT_PLIST_ROOT`, and `IDLEWATCH_LAUNCH_AGENT_LOG_DIR`.

Strict packaging mode:
- Set `IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION=1` to hard-fail packaging unless trust prerequisites are configured.
- In strict mode, `package-macos.sh` requires `MACOS_CODESIGN_IDENTITY`.
- In strict mode, `build-dmg.sh` requires both `MACOS_CODESIGN_IDENTITY` and `MACOS_NOTARY_PROFILE`.
- `npm run package:trusted` now runs `npm run validate:trusted-prereqs` first to fail fast when local keychain/notary setup is missing.
- CI safety guard: tag builds (`refs/tags/*`) now auto-enforce strict trusted requirements even if `IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION` is unset.
- Emergency bypass (explicit): set `IDLEWATCH_ALLOW_UNSIGNED_TAG_RELEASE=1` to allow unsigned tag packaging in CI.

Trusted-release workflow required secrets:

- `MACOS_CODESIGN_IDENTITY`
- `APPLE_DEVELOPER_ID_APP_P12_BASE64`
- `APPLE_DEVELOPER_ID_APP_P12_PASSWORD`
- `APPLE_BUILD_KEYCHAIN_PASSWORD`
- `APPLE_NOTARY_KEY_ID`
- `APPLE_NOTARY_ISSUER_ID`
- `APPLE_NOTARY_API_KEY_P8`

Trusted release workflow policy:
- OpenClaw usage-health is enforced by default in `.github/workflows/release-macos-trusted.yml` via `npm run validate:packaged-usage-health:reuse-artifact` before artifact upload.
- The trusted pipeline now also runs `npm run validate:packaged-openclaw-release-gates:reuse-artifact`, which validates: `validate:packaged-usage-health:reuse-artifact`, `validate:packaged-openclaw-stats-ingestion:reuse-artifact`, and `validate:packaged-openclaw-cache-recovery-e2e:reuse-artifact` against the signed artifact before upload (with the wrapper setting `IDLEWATCH_SKIP_PACKAGE_MACOS=1` so checks validate the already-built artifact directly). By default this gate enforces OpenClaw presence (`IDLEWATCH_REQUIRE_OPENCLAW_USAGE=1`) unless explicitly disabled (`0|false|off|no`); set `1|true|on|yes` to force on.
- Trusted release gate also enforces `IDLEWATCH_MAX_OPENCLAW_USAGE_AGE_MS=300000` to fail fast if packaged usage age is excessively stale.


## Reusable OpenClaw release-gate helpers

For CI / script chaining, artifact-aware convenience helpers are available:

- `npm run validate:packaged-openclaw-release-gates:reuse-artifact`
- `npm run validate:packaged-openclaw-cache-recovery-e2e:reuse-artifact`
- `npm run validate:packaged-dry-run-schema:reuse-artifact`
- `npm run validate:packaged-usage-health:reuse-artifact`
- `npm run validate:packaged-usage-age-slo:reuse-artifact`
- `npm run validate:packaged-openclaw-stats-ingestion:reuse-artifact`
- `npm run validate:packaged-usage-recovery-e2e:reuse-artifact`
- `npm run validate:packaged-usage-probe-noise-e2e:reuse-artifact`
- `npm run validate:packaged-usage-alert-rate-e2e:reuse-artifact`

Each wrapper sets `IDLEWATCH_SKIP_PACKAGE_MACOS=1` so it reuses the already-built packaged artifact in a run.
