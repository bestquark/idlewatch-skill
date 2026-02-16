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

If Firebase env vars are incomplete or invalid, the CLI exits with a clear configuration error.
If Firebase vars are omitted entirely, it runs in local-only mode and prints telemetry to stdout.

## OpenClaw usage ingestion (best effort)

By default (`IDLEWATCH_OPENCLAW_USAGE=auto`), the agent attempts to read OpenClaw
session usage from local CLI JSON endpoints when available, then enriches samples with:

- `IDLEWATCH_USAGE_STALE_MS` controls staleness classification window for usage timestamps
  (default: `max(IDLEWATCH_INTERVAL_MS*3, 60000)`).
- `IDLEWATCH_USAGE_NEAR_STALE_MS` controls "aging" classification before stale
  (default: `floor(IDLEWATCH_USAGE_STALE_MS*0.75)`).

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
- `source.usageIntegrationStatus`: `ok | partial | stale | disabled | unavailable`
- `source.usageFreshnessState`: `fresh | aging | stale | unknown`
- `source.usageNearStale`: boolean early warning signal when age crosses near-stale threshold.
- `source.usageCommand`: command used (`openclaw status --json`, etc.)
- `source.usageStaleMsThreshold`: threshold used for stale classification.
- `source.usageNearStaleMsThreshold`: threshold used for aging classification.
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
- `.github/workflows/release-macos-trusted.yml` (signed + notarized CI path)

Trusted-release workflow required secrets:

- `MACOS_CODESIGN_IDENTITY`
- `APPLE_DEVELOPER_ID_APP_P12_BASE64`
- `APPLE_DEVELOPER_ID_APP_P12_PASSWORD`
- `APPLE_BUILD_KEYCHAIN_PASSWORD`
- `APPLE_NOTARY_KEY_ID`
- `APPLE_NOTARY_ISSUER_ID`
- `APPLE_NOTARY_API_KEY_P8`
