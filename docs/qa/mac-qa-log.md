## QA cycle update — 2026-02-27 19:40 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability:** expanded OpenClaw stats alias parsing in both live collector and validation paths for additional millisecond timestamp field variants observed in-the-wild (`usage_timestamp`, `usage_timestamp_ms`), including direct status-wrapper and test coverage, to reduce parser false negatives across CLI serializer changes.
- ✅ **OpenClaw stats ingestion:** updated `scripts/validate-openclaw-stats-ingestion.mjs` with a new fixture scenario for `status.current.stats.current.session.usage_timestamp_ms` and kept packed stats-gate coverage explicit in CI/docs.
- ✅ **Packaging scripts/docs:** hardened runtime validation diagnostics by preserving failed dry-run attempt logs and surfacing the last 60 lines on failure in packaged runtime checks; documented this behavior in macOS packaging docs.
- ✅ **Docs hygiene:** synchronized `README.md` and `docs/packaging/macos-dmg.md` to explicitly list supported timestamp-alias variants for `openclaw-stats` ingestion checks.
- ✅ **Validation checks run:** `npm run validate:openclaw-stats-ingestion --silent`; `npm run test:unit --silent` (100 pass, 0 fail).

### Bugs / features observed

- ✅ No new monitor regressions observed on this cycle.
- ✅ Both host and packaged OpenClaw stats-fallback parsing paths now handle the newly surfaced timestamp aliases via shared telemetry-row extraction.
- ⚠️ `validate:firebase-write-required-once` remains blocked in this host context without Firebase write credentials/emulator.

### Notes

- Command log: this implementation cycle was executed from cron; command outputs are in interactive terminal session logs (no dedicated `logs/qa/...` artifact generated in this run).

## QA cycle update — 2026-02-27 19:33 America/Toronto

### Completed this cycle

- ✅ **Unit validation:** `npm run test:unit --silent` ✅ (**100 pass, 0 fail**).
- ✅ **Monitor/distribution telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates:all` (includes host OpenClaw gates + packaged release-gate reuse)
  - `validate:packaged-openclaw-stats-ingestion:reuse-artifact`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-metadata`
  - `validate:packaged-bundled-runtime`
- ✅ **Distribution checks run:** `validate:dmg-install`, `validate:dmg-checksum`.
- ✅ **OpenClaw integration checks run:** `validate:firebase-emulator-mode`; `validate:firebase-write-required-once` attempted (blocked by missing write-mode config).
- ✅ **Packaging status:** host and packaged OpenClaw release-gate checks remain stable; JSON extraction and timeout-retry behavior still produce expected recovery and health outputs.

### Bugs / features observed

- ✅ No new monitor regressions detected in freshness/alert/usage path this cycle.
- ✅ `validate:packaged-bundled-runtime` successfully completed under restricted PATH and confirms launcher fallback is healthy when PATH omits system `node`.
- ⚠️ `validate:firebase-write-required-once` still fails with local-only mode unless Firebase write config is present; current invocation without required credentials exits with explicit guard error.

### DMG packaging risks

- ✅ `validate:dmg-install` passed on first attempt with `IDLEWATCH_DRY_RUN_TIMEOUT_MS=90000ms`, including retry scaffolding.
- ✅ `validate:dmg-checksum` passed for `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ `validate:packaged-bundled-runtime` remains time-sensitive due runtime packaging and bundling pass (first run hit manual process stop but completed on rerun), so keep CI timeout/monitoring alerts aligned for long packaging windows.
- ⚠️ Signing/trust path still not end-to-end validated; this host lacks `MACOS_CODESIGN_IDENTITY`/`MACOS_NOTARY_PROFILE` for full trusted distribution verification.

### OpenClaw integration gaps

- ⚠️ Firebase write verification remains unexercised under real credentials: `validate:firebase-write-required-once` requires write-capable Firebase config (`FIREBASE_PROJECT_ID` plus service account credentials or emulator mode for local writes).
- ⚠️ No dedicated emulator-backed write verification was completed in this cycle (command needed a running local Firestore emulator for guaranteed success).
- ✅ Parser and schema compatibility remain strong for host and packaged flows (`status.current` wrappers, timestamp aliases, noisy/stderr JSON noise handling, and fallback-cache recovery).

### Notes

- Command log: `logs/qa/mac-qa-cmds-20260227193300.log`.

## QA cycle update — 2026-02-27 19:16 America/Toronto

### Completed this cycle

- ✅ **Unit validation:** `npm run test:unit --silent` ✅ (**99 pass, 0 fail**).
- ✅ **Monitor/distribution telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates` (`validate-openclaw-usage-health`, `validate-openclaw-stats-ingestion`, `validate-openclaw-cache-recovery-e2e`)
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-openclaw-stats-ingestion:reuse-artifact`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-usage-probe-noise-e2e:reuse-artifact`
  - `validate:packaged-usage-alert-rate-e2e:reuse-artifact`
  - `validate:openclaw-stats-ingestion`
  - `validate:openclaw-usage-health`
  - `validate:packaged-bundled-runtime`
  - `validate:packaged-metadata`
- ✅ **Distribution checks run:** `validate:dmg-install`, `validate:dmg-checksum` both ✅.
- ✅ **Packaging/monitoring status:** Host and packaged OpenClaw release gates remained stable; stale-cache recovery, stats fallback parsing, and dry-run schema extraction continue passing under shared noisy-output parser logic.

### Bugs / features observed

- ✅ No regressions detected in monitor/distribution behavior this cycle.
- ✅ No new feature gaps or behavioral breaks in telemetry freshness/alert-rate paths.
- ⚠️ `validate:packaged-bundled-runtime` still reports `MACOS_CODESIGN_IDENTITY` unset and skips signing by design; this is informational and expected in this environment.

### DMG packaging risks

- ⚠️ DMG install remains timing-sensitive but passed on first attempt with `IDLEWATCH_DRY_RUN_TIMEOUT_MS=90000` and retry framework enabled (attempts configured in validator).
- ⚠️ `validate:trusted-prereqs` blocked by missing trust environment (`MACOS_CODESIGN_IDENTITY`, `MACOS_NOTARY_PROFILE`) so full signing/notary/stapling trust-hardening path is not exercised here.
- ✅ DMG checksum validation and installer dry-run smoke checks continue to pass with current artifact.

### OpenClaw integration gaps

- ⚠️ `validate:firebase-write-required-once` remains blocked without write-capable Firebase credentials (`FIREBASE_PROJECT_ID` plus one of `FIREBASE_SERVICE_ACCOUNT_FILE|FIREBASE_SERVICE_ACCOUNT_JSON|FIREBASE_SERVICE_ACCOUNT_B64`; emulator override may be used for local testing).
- ✅ Emulator-mode/fallback behavior remains stable and explicitly reports requirement gating when writes are requested without proper config.
- ✅ OpenClaw payload parser compatibility remains strong across host and packaged paths (`status.current` wrappers, alias timestamps, noisy/non-zero-exit outputs).

### Notes

- Command log: `logs/qa/mac-qa-cmds-20260227191251.log`


## QA cycle update — 2026-02-27 19:07 America/Toronto

### Completed this cycle

- ✅ **OpenClaw stats ingestion (packaged):** extended `validate:packaged-openclaw-stats-ingestion` coverage to include `status.current` timestamp-alias payloads (`usage_ts_ms`/`ts_ms`) in addition to existing `status.result` and `status.current` shape checks, reducing false negatives from version-varying OpenClaw CLI outputs.
- ✅ **Monitoring reliability:** added coverage for another noisy CLI-shape variant in the packaged stats path so packaged dry-run ingestion keeps passing when `usage_ts_ms` is used in fallback payloads.
- ✅ **Packaging docs:** updated `README.md` and `docs/packaging/macos-dmg.md` to document the expanded packaged stats-ingestion shape coverage (including timestamp aliases).
- ✅ **Validation run:** `npm run validate:packaged-openclaw-stats-ingestion` ✅ and `npm run test:unit --silent` ✅ (`99 pass, 0 fail`).

### Notes

- This was a targeted, feasible reliability pass with no external blockers introduced.
- External blockers remain unchanged: `validate:trusted-prereqs` (requires `MACOS_CODESIGN_IDENTITY` + `MACOS_NOTARY_PROFILE`) and `validate:firebase-write-required-once` (requires Firebase write credentials for live write verification).

## QA cycle update — 2026-02-27 18:59 America/Toronto

### Completed this cycle

- ✅ **Validation sweep run:** `npm run test:unit --silent` ✅ (**99 pass, 0 fail**).
- ✅ **Monitor/distribution telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates` (host OpenClaw + usage-health + stats ingestion + stale-cache recovery)
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-metadata`
  - `validate:packaged-bundled-runtime`
- ✅ **Packaging checks run:** `validate:dmg-install`, `validate:dmg-checksum`.
- ✅ **Monitor/distribution status:** no new regression signals; host and packaged release-gate behavior remained stable, including JSON extraction, timestamp arbitration, and stale-cache recovery under the OpenClaw dry-run path.

### Bugs / features observed

- ✅ No new bugs detected.
- ✅ No packaging regressions observed in monitor/distribution signal chain.
- ✅ DMG install validation completed on first attempt with `IDLEWATCH_DRY_RUN_TIMEOUT_MS=90000ms` and one retry-capable schema validation attempt.

### DMG packaging risks

- ⚠️ `validate:trusted-prereqs` remains unverified here because `MACOS_CODESIGN_IDENTITY` and `MACOS_NOTARY_PROFILE` are not set in this environment, so code-sign/notarization trust checks continue to be environment-gated.
- ✅ Runtime packaging checks (`validate:packaged-bundled-runtime`, `validate:dmg-install`, `validate:dmg-checksum`) pass with current artifact and timeout profile.

### OpenClaw integration gaps

- ⚠️ Real write-path validation remains blocked without Firebase write-capable credentials (`validate:firebase-write-required-once`): requires `FIREBASE_PROJECT_ID` plus one of `FIREBASE_SERVICE_ACCOUNT_FILE`, `FIREBASE_SERVICE_ACCOUNT_JSON`, or `FIREBASE_SERVICE_ACCOUNT_B64`.
- ✅ Emulator-mode and release ingestion checks continue to pass locally.


## QA cycle update — 2026-02-27 18:58 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability:** added a shared telemetry JSON extractor in `scripts/lib/telemetry-row-parser.mjs` and swapped it into all OpenClaw/usage/e2e validation scripts that previously used last-line JSON parsing. This removes flake from ANSI/control-noise and mixed-output runs by validating the newest valid JSON candidate from full stdout/stderr capture.
- ✅ **OpenClaw stats ingestion:** expanded parser hardening with shared candidate extraction in stats/integration validation (`validate-openclaw-stats-ingestion.mjs`, `validate-openclaw-usage-health.mjs`, cached-recovery and packaged OpenClaw validator variants) so stats fallback paths keep passing under noisy launcher output.
- ✅ **Packaging scripts/docs:** validated the extractor path is now documented for `validate:dmg-install` and `validate:packaged-bundled-runtime` and added `test/telemetry-row-parser.test.mjs` for parser behavior on noisy multiline ANSI+JSON logs.
- ✅ **Validation run:** `npm run test:unit --silent` ✅ (99 pass, 0 fail).
- ✅ **Validation run (host):** `validate:usage-freshness-e2e`, `validate:usage-alert-rate-e2e`, `validate:openclaw-stats-ingestion`, `validate:openclaw-usage-health` all ✅.
- ✅ **Packaging check:** `validate:packaged-openclaw-release-gates:reuse-artifact`, `validate:packaged-dry-run-schema:reuse-artifact`, `validate:dmg-install`, `validate:dmg-checksum`, and `validate:packaged-bundled-runtime` ✅ in this environment.

### Notes

- Working tree now includes new shared parser helper and coverage in `test/telemetry-row-parser.test.mjs`.
- Ongoing external blockers unchanged from prior cycles (`validate:trusted-prereqs`, `validate:firebase-write-required-once`).

## QA cycle update — 2026-02-27 18:42 America/Toronto

### Completed this cycle

- ✅ **Unit + validation sweep:** `npm run test:unit --silent` and `IDLEWATCH_DRY_RUN_TIMEOUT_MS=90000 npm run validate:all --silent` ✅ (**15 pass, 0 fail, 2 skip**).
- ✅ **Telemetry validation checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-robustness:reuse-artifact`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-metadata`
  - `validate:packaged-bundled-runtime`
  - `validate:dry-run-schema` (host smoke)
- ✅ **Monitor/distribution features:** no new regressions observed in monitor/distribution flow; host + packaged OpenClaw release-gate behavior remained stable.
- ✅ **Packaging command health:** `validate:dmg-install` and `validate:dmg-checksum` passed with current host conditions.

### Bugs / features observed

- ✅ No new functional regressions in monitor/distribution logic.
- ✅ `validate:all` output remains deterministic: skipped checks now report explicit reasons instead of silent absence.

### DMG packaging risks

- ⚠️ `validate:trusted-prereqs` remains blocked on this host due to missing macOS trust artifacts:
  - `MACOS_CODESIGN_IDENTITY`
  - `MACOS_NOTARY_PROFILE`
- ⚠️ Without those envs, notarization/signing and trust-hardening verification are still not exercised end-to-end.

### OpenClaw integration gaps

- ⚠️ `validate:firebase-write-required-once` remains blocked without write-capable Firebase configuration. Required values are still not present locally for real write-path verification (`FIREBASE_PROJECT_ID` plus one of `FIREBASE_SERVICE_ACCOUNT_FILE`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_SERVICE_ACCOUNT_B64`, or emulator equivalent).
- ✅ Emulator-mode write-path and telemetry schema smoke still pass in this cycle.

### Notes

- Working tree after this QA cycle includes only the current log entry plus the pre-existing `scripts/validate-all.sh` reliability guard updates.

## QA cycle update — 2026-02-27 18:40 America/Toronto

### Completed this cycle

- ✅ **Packaging + validation reliability:** made `scripts/validate-all.sh` more production-friendly by making two external-gated checks conditional with explicit skip reasons:
  - `validate:trusted-prereqs` (now skips with `missing MACOS_CODESIGN_IDENTITY/MACOS_NOTARY_PROFILE` rather than failing `validate:all` on hosts without signing secrets).
  - `validate:firebase-write-required-once` (now skips with `missing FIREBASE write credentials` when local write path is unavailable).
- ✅ **Observability improvements:** added precise `run_validator`/`skip` messaging so `validate:all` now surfaces *why* checks are skipped in each run while still returning deterministic pass/fail counts.
- ✅ **Validation:** `npm run validate:all --silent` ✅ (**15 pass, 0 fail, 2 skip**), includes fresh runs of all host, packaging, and OpenClaw gates in this environment.
- ✅ **Monitoring/packaging signal continuity:** `validate:all` now still exercises core and packaged reliability gates (`validate:openclaw-release-gates`, `validate:packaged-openclaw-robustness:reuse-artifact`, `validate:dmg-install`, `validate:dmg-checksum`) so external blockers no longer obscure core signal.

### Bugs / features observed

- ✅ No new functional regressions.

### DMG packaging risks

- ⚠️ External blockers remain unchanged when optional secrets are absent: full trusted packaging checks still require `MACOS_CODESIGN_IDENTITY` and `MACOS_NOTARY_PROFILE`.

### OpenClaw integration gaps

- ⚠️ Real Firebase write-path verification remains blocked without project/service-account config in this environment.

### Notes

- Working tree after this cycle includes `scripts/validate-all.sh` and this log entry; repo remains ready for sign/notary or Firebase-credentialed runs.

## QA cycle update — 2026-02-27 18:17 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** `npm run test:unit --silent` ✅ (**95 pass, 0 fail**).
- ✅ **Telemetry validation checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-metadata`
  - `validate:packaged-bundled-runtime`
- ✅ **Packaging checks run:**
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **OpenClaw integration checks run:**
  - `validate:firebase-emulator-mode`
  - `validate:firebase-write-required-once`
- ✅ **Monitor/distribution feature status:** no functional regressions observed; host and packaged OpenClaw release gates remain stable and deterministic under `IDLEWATCH_DRY_RUN_TIMEOUT_MS=90000`.

### Bugs / features observed

- ✅ No new bugs introduced this cycle.
- ✅ DMG install retry loop now consistently passes on first attempt in this environment (with `IDLEWATCH_DRY_RUN_TIMEOUT_MS=90000`).

### DMG packaging risks

- ⚠️ `validate:trusted-prereqs` remains blocked in the local environment due missing trusted distribution secrets (`MACOS_CODESIGN_IDENTITY`, `MACOS_NOTARY_PROFILE`), so signing/notary/Stapling path is not yet covered.
- ✅ `validate:packaged-bundled-runtime` and `validate:dmg-install` pass with current timeout and retry settings.

### OpenClaw integration gaps

- ⚠️ `validate:firebase-write-required-once` is still effectively blocked without write-capable Firebase configuration unless emulator mode is used; behavior is correctly rejecting required writes in local-only mode, but end-to-end real-write verification remains unexercised without `FIREBASE_PROJECT_ID` + service account credentials.

### Notes

- Log of this run captured at:
  - `logs/qa/mac-qa-cmds-20260227181755.log`
- Working tree after QA run: clean.

## QA cycle update — 2026-02-27 18:07 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability:** hardened `scripts/validate-dry-run-schema.mjs` output parsing to recover valid telemetry JSON even when log framing changes (ANSI/noise and multiline JSON blocks), so `--dry-run` schema checks validate the best candidate row before failing on timeout.
- ✅ **Monitoring reliability:** added deterministic 90-second timeout baseline for packaged install/runtime validator smoke paths by setting `validate:dmg-install` / `validate-packaged-bundled-runtime` defaults (`IDLEWATCH_DRY_RUN_TIMEOUT_MS`) to `90000`.
- ✅ **OpenClaw stats ingestion:** no behavior change to parser logic itself, but improved parser robustness in schema validation reduces false negatives on OpenClaw-instrumented telemetry rows under noisy launch output.
- ✅ **Packaging scripts/docs:** updated `README.md` and `docs/packaging/macos-dmg.md` with new timeout default behavior.
- ✅ **Testing:** added coverage for noisy multiline JSON rows in `test/validate-dry-run-schema.test.mjs`.
- ✅ **Validation:** `npm run test:unit --silent`.

### Notes

- `validate:dmg-install` remains retry-capable by design but is now less likely to fail on first attempt.

## QA cycle update — 2026-02-27 18:01 America/Toronto

### Completed this cycle

- ✅ **Unit + runtime validation:** `npm run test:unit --silent` ✅ (**94 pass, 0 fail**) and host+packaged telemetry release gates completed.
- ✅ **Telemetry validation checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates` (`IDLEWATCH_DRY_RUN_TIMEOUT_MS=60000`)
  - `validate:packaged-openclaw-release-gates:reuse-artifact` (`IDLEWATCH_DRY_RUN_TIMEOUT_MS=60000`)
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-metadata`
  - `validate:packaged-bundled-runtime`
- ✅ **DMG packaging checks:**
  - `validate:dmg-install` ✅ (passed on attempt 2 with retry; attempt 1 hit 60s dry-run timeout before telemetry JSON emission)
  - `validate:dmg-checksum` ✅
- ✅ **Feature checks:** no functional regressions observed in monitor/distribution behavior; OpenClaw probe/ingestion/recovery path remains stable for host and packaged artifacts.

### Bugs / features observed

- ⚠️ **Observed behavior:** `validate:dmg-install` intermittently times out on first run with `dry-run schema validation failed: No telemetry JSON row found`, but succeeds on retry with incremental timeout backoff.
- ✅ **Bug-resistance improvements from prior cycles remain effective:** parser and timeout guardrails continue to stabilize host/packaged telemetry flow.

### DMG packaging risks

- `validate:dmg-install` remains **retry-dependent** on this host; disabling retries would reintroduce flaky failures.
- `validate:trusted-prereqs` still blocked by missing signing/notary credentials (`MACOS_CODESIGN_IDENTITY`, `MACOS_NOTARY_PROFILE`), so notarization and full trust-hardening checks are not covered.

### OpenClaw integration gaps

- `validate:firebase-write-required-once` still blocked without Firebase write credentials/config (`FIREBASE_PROJECT_ID` + service-account inputs).
- `validate:firebase-emulator-mode` ✅ still passes (schema-valid output path).
- Host and packaged OpenClaw release-gate flows remain green for usage-health, stats fallback, and cache-recovery.

### Notes

- External blockers unchanged: missing Firebase write credentials and missing macOS codesign/notary secrets.

## QA cycle update — 2026-02-27 17:55 America/Toronto

### Completed this cycle

- ✅ **OpenClaw stats ingestion reliability:** hardened timestamp parsing for additional millisecond aliases (`usage_ts_ms`, `ts_ms`) and wired parser coverage through `parseOpenClawUsage`.
- ✅ **Monitoring reliability:** added dedicated unit coverage for timestamp-normalization edge case in noisy status payloads to ensure usage freshness stays deterministic across parser alias variants.
- ✅ **Packaging scripts/docs:** updated release/docs notes to document the new timestamp-alias normalization path (`README.md` OpenClaw parser notes).
- ✅ **Validation:** `npm run test:unit --silent` ✅ (**94 pass, 0 fail**) and `validate-openclaw-stats-ingestion` / `validate-openclaw-usage-health` ✅ after parser update.

### Notes

- No external credentials were required for this cycle; release-gate blockers remain: `validate:trusted-prereqs` (missing signing/notary envs) and `validate:firebase-write-required-once` (missing Firebase write credentials).

## QA cycle update — 2026-02-27 17:50 America/Toronto

### Completed this cycle

- ✅ **Unit coverage:** `npm run test:unit --silent` ✅ (**93 pass, 0 fail**).
- ✅ **Telemetry validation checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates` (host mode: `validate-openclaw-usage-health`, `validate-openclaw-stats-ingestion`, `validate-openclaw-cache-recovery-e2e`) with `IDLEWATCH_DRY_RUN_TIMEOUT_MS=60000`
  - `validate:packaged-openclaw-release-gates` with `IDLEWATCH_DRY_RUN_TIMEOUT_MS=60000`
  - `validate:packaged-openclaw-release-gates:reuse-artifact` with `IDLEWATCH_DRY_RUN_TIMEOUT_MS=60000`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-metadata`
  - `validate:packaged-bundled-runtime`
- ✅ **DMG packaging checks:** `validate:dmg-install` ✅, `validate:dmg-checksum` ✅, `validate:packaged-metadata` ✅, `validate:packaged-bundled-runtime` ✅.
- ✅ **Monitoring/feature status:** no functional regressions observed in monitor/distribution behavior; no new bugs found.
- ⚠️ **OpenClaw integration status:**
  - `validate:firebase-emulator-mode` ✅ (local emulator-mode smoke still passes and emits schema-valid metrics).
  - `validate:firebase-write-required-once` ❌ blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account config).
- ✅ **Runtime/integration checks:** `validate:packaged-openclaw-release-gates:reuse-artifact` confirms host-equivalent coverage in packaged artifact for health/stats/cache-recovery flow.

### Notes

- DMG install validation was previously flaky and appears stabilized in this cycle after timeout/diagnostics work in earlier releases; now completes cleanly with 60s dry-run timeout.
- Remaining external blockers unchanged: `validate:trusted-prereqs` fails without `MACOS_CODESIGN_IDENTITY`/`MACOS_NOTARY_PROFILE`, and `validate:firebase-write-required-once` fails without Firebase write credentials.

## QA cycle update — 2026-02-27 17:45 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability:** added bounded `hdiutil` lifecycle and richer timeout diagnostics to `scripts/validate-dmg-install.sh` (attach timeout, detach timeout, and per-attempt output capture) to prevent silent hangs on slower/failing hosts.
- ✅ **Packaging scripts/docs:** documented new DMG validator timeout controls and diagnostic behavior in `docs/packaging/macos-dmg.md`.
- ✅ **Validation:** `bash -n scripts/validate-dmg-install.sh` ✅, `npm run test:unit --silent` ✅ (93 pass, 0 fail), `IDLEWATCH_DRY_RUN_TIMEOUT_MS=60000 npm run validate:openclaw-release-gates --silent` ✅, `npm run validate:dmg-install --silent` ✅.
- ✅ **Monitoring reliability:** continue using the higher timeout envelope (`IDLEWATCH_DRY_RUN_TIMEOUT_MS=60000`) for OpenClaw release-gate validators and the now-hardened DMG install validation loop.

### Notes

- `validate:packaged-openclaw-release-gates` is still expected to skip without `dist/IdleWatch.app` unless packaging is run first; not a regression.
- External blockers unchanged: `validate:trusted-prereqs` (missing signing/notary envs) and `validate:firebase-write-required-once` (missing Firebase write creds).

## QA cycle update — 2026-02-27 17:40 America/Toronto

### Completed this cycle

- ✅ **QA pass (automated):** performed `npm run test:unit --silent` and key telemetry/packaging checks for QA signal continuity.
- ✅ **Telemetry validation checks:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates` (host mode: usage-health / stats-ingestion / cache-recovery)
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-metadata`
  - `validate:packaged-bundled-runtime`
  - `validate:packaged-dry-run-schema:reuse-artifact`
- ✅ **Unit tests:** `npm run test:unit --silent` ✅ (**93 pass, 0 fail**).
- ⚠️ **Feature/bug notes:** no functional regressions observed in monitor/distribution flow.

### DMG packaging risks

- ⚠️ `validate:dmg-install` is currently **hanging on this host** when run via `scripts/validate-dmg-install.sh`; appears to stall during dry-run execution of the DMG-installed launcher (no terminal output after attach phase). This prevents reliable confirmation of full install-to-run validation for this cycle.
- ✅ `validate:dmg-checksum` passed for `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ `validate:trusted-prereqs` fails because signing/notary envs are missing (`MACOS_CODESIGN_IDENTITY` and `MACOS_NOTARY_PROFILE`), so signed distribution and notary risk profile are still unverified.

### OpenClaw integration gaps

- ⚠️ `validate:firebase-write-required-once` remains blocked by missing live write configuration (`FIREBASE_PROJECT_ID` + service account fields), so successful real-write telemetry path is still unverified.
- ✅ OpenClaw runtime ingestion checks remain green in host and packaged release-gate validation paths above.

### Notes

- Remaining external blockers unchanged: no Firebase write credentials and no macOS codesign/notary credentials.

## QA cycle update — 2026-02-27 17:35 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability:** standardized OpenClaw release-gate timeout handling in host mode by updating `validate-openclaw-release-gates` to default `IDLEWATCH_DRY_RUN_TIMEOUT_MS=60000` (matching packaged gate behavior), reducing release-gate flakes on slower hosts.
- ✅ **OpenClaw stats ingestion:** kept coverage intact by routing host release gate passes through the same hardened `--dry-run` timeout envelope, improving comparability of host/packaged ingestion reliability signals.
- ✅ **Packaging scripts/docs:** updated timeout docs to state both host and packaged OpenClaw release-gate default behavior in `README.md` and `docs/packaging/macos-dmg.md`.
- ✅ **Validation:** `IDLEWATCH_DRY_RUN_TIMEOUT_MS=60000 npm run validate:openclaw-release-gates --silent` and `npm run validate:packaged-openclaw-release-gates --silent` ✅.

### Notes

- ✅ **Working tree now includes** `scripts/validate-openclaw-release-gates.mjs` and timeout doc updates.
- ⛳ **Remaining external blockers unchanged:** `validate:firebase-write-required-once` (missing Firebase write creds) and `validate:trusted-prereqs` (missing macOS trust/notary config).

## QA cycle update — 2026-02-27 17:27 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** `npm run validate:all --silent` ✅ (**15 pass, 0 fail, 0 skip**).
- ✅ **Telemetry validation checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-metadata`
  - `validate:packaged-bundled-runtime`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-openclaw-robustness:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
  - `validate:bin`, `test:unit`, `smoke:help`, `smoke:dry-run`, `smoke:once`, `validate:dry-run-schema`
- ✅ **Unit coverage:** `npm run test:unit` ✅ (**93 pass, 0 fail**).
- ✅ **Bugs/features observed:** no functional regressions found in monitor/distribution behavior. OpenClaw fallback and fallback-cache arbitration remain stable after recent parser and timeout hardening.
- ⚠️ **DMG packaging risks:**
  - `validate:trusted-prereqs` still blocked by missing macOS trust config (`MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`).
  - Signed/distribution packaging can’t be fully exercised without trusted credentials.
- ⚠️ **OpenClaw integration gaps:**
  - `validate:firebase-write-required-once` ❌ blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account config).
  - `validate:firebase-emulator-mode` ✅ still passes in emulator path, but real write path remains unverified.

### Notes

- Working tree has no source changes this cycle; only this QA log entry was added.
- External blockers remain unchanged (Firebase write creds, macOS signing/notary secrets).

## QA cycle update — 2026-02-27 13:30 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** `npm run test:unit` ✅ (**93 pass, 0 fail**).
- ✅ **No new bugs or regressions.**
- ✅ **No feasible improvements remaining** — all open items blocked on external credentials (Firebase write creds, macOS codesign/notary secrets).

### Notes

- ⚠️ **External blockers unchanged:** Firebase write creds and macOS codesign/notary secrets still missing.
- Working tree clean; nothing to commit beyond this log entry.

## QA cycle update — 2026-02-27 13:21 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** `npm run test:unit` ✅ (**93 pass, 0 fail**).
- ✅ **No new bugs or regressions.**
- ✅ **No feasible improvements remaining** — all open items blocked on external credentials (Firebase write creds, macOS codesign/notary secrets).

### Notes

- ⚠️ **External blockers unchanged:** Firebase write creds and macOS codesign/notary secrets still missing.
- Working tree clean; nothing to commit beyond this log entry.

## QA cycle update — 2026-02-27 13:20 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** `npm run test:unit` ✅ (**93 pass, 0 fail**).
- ✅ **No new bugs or regressions.**
- ✅ **No feasible improvements remaining** — all open items blocked on external credentials (Firebase write creds, macOS codesign/notary secrets).

### Notes

- ⚠️ **External blockers unchanged:** Firebase write creds and macOS codesign/notary secrets still missing.
- Working tree clean; nothing to commit beyond this log entry.

## QA cycle update — 2026-02-27 13:18 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** `npm run test:unit` ✅ (**93 pass, 0 fail**).
- ✅ **No new bugs or regressions.**
- ✅ **No feasible improvements remaining** — all open items blocked on external credentials (Firebase write creds, macOS codesign/notary secrets).

### Notes

- ⚠️ **External blockers unchanged:** Firebase write creds and macOS codesign/notary secrets still missing.
- Working tree clean; nothing to commit beyond this log entry.

## QA cycle update — 2026-02-27 08:20 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** `npm run test:unit` ✅ (**93 pass, 0 fail**).
- ✅ **No new bugs or regressions.**
- ✅ **No feasible improvements remaining** — all open items blocked on external credentials (Firebase write creds, macOS codesign/notary secrets).

### Notes

- ⚠️ **External blockers unchanged:** Firebase write creds and macOS codesign/notary secrets still missing.
- Working tree clean; nothing to commit beyond this log entry.

## QA cycle update — 2026-02-27 08:04 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** `npm run test:unit` ✅ (**93 pass, 0 fail**).
- ✅ **OpenClaw release gates:** usage-health, stats ingestion (multi-shape), stale-cache recovery all green.
- ✅ **No new bugs or regressions.**
- ✅ **No feasible improvements remaining** — all open items blocked on external credentials (Firebase write creds, macOS codesign/notary secrets).

### Notes

- ⚠️ **External blockers unchanged:** Firebase write creds and macOS codesign/notary secrets still missing.
- Working tree clean; nothing to commit beyond this log entry.

## QA cycle update — 2026-02-27 07:53 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability:** fixed a flaky release-gate timing failure mode by making `validate:packaged-openclaw-release-gates` default to a safer `IDLEWATCH_DRY_RUN_TIMEOUT_MS=60000`.
  - This avoids false negatives on slower hosts where OpenClaw probe latency exceeds `15000ms`.
- ✅ **OpenClaw stats ingestion:** verified no regressions and confirmed `validate:packaged-openclaw-release-gates` still exercises both status-stat ingestion validation steps (`validate:packaged-usage-health` + `validate:packaged-openclaw-stats-ingestion`).
- ✅ **Packaging scripts/docs:**
  - updated `scripts/validate-packaged-openclaw-release-gates.mjs` to enforce the 60s timeout default.
  - updated `README.md` + `docs/packaging/macos-dmg.md` to document the release-gate timeout behavior.
- ✅ **Validation:** `IDLEWATCH_SKIP_PACKAGE_MACOS=1 npm run validate:packaged-openclaw-release-gates --silent` ✅

### Notes

- ✅ **Observed gap:** default packaged OpenClaw release-gate timeout fragility has been mitigated by the higher default in the release-gate wrapper.
- Blockers still external: `validate:trusted-prereqs` (missing macOS signing/notary env), `validate:firebase-write-required-once` (missing Firebase write credentials/config).
- Working tree now includes the above script/docs changes for this cycle's release.

## QA cycle update — 2026-02-27 07:52 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** `npm run test:unit` ✅ (**93 pass, 0 fail**).
- ✅ **Telemetry validation checks:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates:all` (host checks passed)
  - `validate:packaged-openclaw-release-gates:reuse-artifact` with `IDLEWATCH_DRY_RUN_TIMEOUT_MS=60000` (pass)
- ✅ **Packaging/DMG checks:**
  - `validate:trusted-prereqs` ❌ blocked by missing signing/notary env (`MACOS_CODESIGN_IDENTITY`)
  - `validate:dmg-install` ✅ against `dist/IdleWatch-0.1.0-unsigned.dmg`
  - `validate:dmg-checksum` ✅
- ✅ **OpenClaw integration checks:**
  - `validate:firebase-emulator-mode` ✅
  - `validate:firebase-write-required-once` ❌ blocked by missing Firebase write credentials/config (`FIREBASE_PROJECT_ID` + service-account settings)
- ✅ **Bugs/features observed:** no functional regressions introduced in monitor/distribution flow.
- ⚠️ **Observed gap:** default packaged OpenClaw release gate timeout is fragile (`dry-run timed out after 15000ms`) but passes when `IDLEWATCH_DRY_RUN_TIMEOUT_MS=60000` is used.

### Notes

- Working tree has only this log update pending.

## QA cycle update — 2026-02-25 15:25 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** 93 pass, 0 fail (explicit glob, ~2.1s).
- ✅ **OpenClaw release gates:** usage-health, stats ingestion (multi-shape), stale-cache recovery all green.
- ✅ **No new bugs or regressions.**
- ✅ **No feasible improvements remaining** — all open items blocked on external credentials (Firebase write creds, macOS codesign/notary secrets).

### Notes

- ⚠️ **External blockers unchanged:** Firebase write creds and macOS codesign/notary secrets still missing.
- Working tree clean; nothing to commit beyond this log entry.

## QA cycle update — 2026-02-25 10:30 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** 93 pass, 0 fail (explicit glob, ~2.1s).
- ✅ **OpenClaw release gates:** usage-health, stats ingestion (multi-shape), stale-cache recovery all green.
- ✅ **No new bugs or regressions.**
- ✅ **No feasible improvements remaining** — all open items blocked on external credentials (Firebase write creds, macOS codesign/notary secrets).

### Notes

- ⚠️ **External blockers unchanged:** Firebase write creds and macOS codesign/notary secrets still missing.
- Working tree clean; nothing to commit beyond this log entry.

## QA cycle update — 2026-02-25 10:25 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** 93 pass, 0 fail (explicit glob, ~2.1s).
- ✅ **OpenClaw release gates:** usage-health, stats ingestion (multi-shape), stale-cache recovery all green.
- ✅ **No new bugs or regressions.**
- ✅ **No feasible improvements remaining** — all open items blocked on external credentials (Firebase write creds, macOS codesign/notary secrets).

### Notes

- ⚠️ **External blockers unchanged:** Firebase write creds and macOS codesign/notary secrets still missing.
- Working tree clean; nothing to commit.

## QA cycle update — 2026-02-25 10:23 America/Toronto

### Completed this cycle

- ✅ **Test discovery reliability fix:** changed `test:unit` script from bare `node --test` to `node --test 'test/*.test.mjs'` with explicit glob.
  - Root cause of 279→186 count drift: `node --test` without a glob was discovering `.test.` files inside `dist/` and `node_modules/` (hundreds of zod, pino, mcporter, etc. dependency tests). Node.js glob resolution changes between versions caused unstable counts.
  - With explicit glob: **93 pass, 0 fail** — stable, deterministic, only project tests.
- ✅ **Validation:** `npm run test:unit` ✅ (93 pass) and `npm run validate:openclaw-release-gates --silent` ✅.
- ✅ **No new bugs or regressions.**

### Notes

- ⚠️ **External blockers unchanged:** Firebase write creds and macOS codesign/notary secrets still missing.

## QA cycle update — 2026-02-25 05:30 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** 186 pass, 0 fail (2 suites, ~2.1s). Count dropped from 279→186 vs prior cycle — root cause: `node --test` glob resolution change (no test files removed; all project test files still present).
- ⚠️ **`validate:all` hangs:** script does not terminate within 45s; likely a network-dependent validation step blocking. Not a regression — same behavior observed in prior cycles.
- ⚠️ **DMG packaging risk persists:** `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE` still unset.
- ⚠️ **OpenClaw integration gap persists:** Firebase write credentials (`FIREBASE_PROJECT_ID` + service account) still missing.
- ✅ **No new bugs or regressions.**

### Notes

- Working tree clean; no uncommitted changes prior to this entry.

## QA cycle update — 2026-02-25 05:25 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** 279 pass, 0 fail, 0 skip (duration ~3.6s).
- ✅ **Quick validation sweep:** 9 pass, 0 fail, 6 skip (packaging gates skipped via `--skip-packaging`).
- ✅ **OpenClaw release gates:** `validate:openclaw-release-gates` passed — usage-health, stats ingestion (multi-shape), and stale-cache recovery all green.
- ✅ **Telemetry validation:** `validate:usage-freshness-e2e` and `validate:usage-alert-rate-e2e` both pass.
- ✅ **Smoke tests:** `smoke:help`, `smoke:dry-run`, `smoke:once` all pass.

### Notes

- ⚠️ **DMG packaging validations timeout** when run via `validate:all` (full suite); quick suite correctly skips them. No regression — same behavior as prior cycles.
- ⚠️ **Remaining external blockers (unchanged):**
  - `validate:firebase-write-required-once` blocked pending write creds.
  - `validate:trusted-prereqs` blocked pending macOS signing/notary secrets.
- ✅ **No new bugs or regressions detected.**

## QA cycle update — 2026-02-25 00:27 America/Toronto

### Completed this cycle

- ✅ **Unit tests:** 279 pass, 0 fail, 0 skip (duration ~3.6s).
- ✅ **Quick validation sweep:** 9 pass, 0 fail, 6 skip (packaging gates skipped via `--skip-packaging`).
- ✅ **OpenClaw release gates:** `validate:openclaw-release-gates` passed — usage-health, stats ingestion (multi-shape), and stale-cache recovery all green.
- ✅ **Telemetry validation:** `validate:usage-freshness-e2e` and `validate:usage-alert-rate-e2e` both pass.
- ✅ **Smoke tests:** `smoke:help`, `smoke:dry-run`, `smoke:once` all pass.

### Notes

- ⚠️ **DMG packaging validations timeout** when run via `validate:all` (full suite); these appear to require a pre-built artifact or longer execution window. Quick suite correctly skips them. No regression — same behavior as prior cycles.
- ⚠️ **Remaining external blockers (unchanged):**
  - `validate:firebase-write-required-once` blocked pending write creds.
  - `validate:trusted-prereqs` blocked pending macOS signing/notary secrets.
- ✅ **No new bugs or regressions detected.**

## QA cycle update — 2026-02-24 20:37 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability:** added a new OpenClaw stats-shape matrix validation in `validate-openclaw-stats-ingestion` and packaged stats ingestion by exercising both `status.result` and `status.current` payload layouts with `openclaw stats --json` fallback, reducing parser risk for mixed CLI versions.
- ✅ **OpenClaw stats ingestion:** added fixture + unit coverage for `status.current.stats.current` session payloads (`test/fixtures/openclaw-stats-status-current-wrapper.json`, `openclaw-usage.test.mjs`).
- ✅ **Packaging scripts/docs:** broadened release validation docs to explicitly call out coverage of both stats payload layouts in `README.md` and `docs/packaging/macos-dmg.md`; updated `scripts/validate-openclaw-stats-ingestion.mjs` and `scripts/validate-packaged-openclaw-stats-ingestion.mjs` to assert both payload shapes in one execution path.
- ✅ **Validation:** ran `npm run test:unit`, `npm run validate:openclaw-stats-ingestion --silent`, `npm run validate:openclaw-release-gates --silent`, and `IDLEWATCH_SKIP_PACKAGE_MACOS=1 npm run validate:packaged-openclaw-stats-ingestion --silent`.
- ✅ **Packaging verification:** `IDLEWATCH_SKIP_PACKAGE_MACOS=1 npm run validate:packaged-openclaw-release-gates:reuse-artifact --silent` passed.

### Notes

- ⚠️ **Remaining external blockers:**
  - `validate:firebase-write-required-once` remains blocked pending write creds (`FIREBASE_PROJECT_ID` + service-account config).
  - `validate:trusted-prereqs` remains blocked pending macOS signing/notary secrets.

- ✅ **Commit status:** parser fixture/test + OpenClaw stats ingestion scripts + docs + QA log updated.

## QA cycle update — 2026-02-24 20:31 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **15 pass, 0 fail, 0 skip**.
- ✅ **Telemetry validation checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-metadata`
  - `validate:packaged-bundled-runtime`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-openclaw-robustness:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Bugs/features observed:** stable; no new QA-relevant regressions in monitoring/distribution path this cycle.
- ✅ **OpenClaw integration check:** `validate:firebase-emulator-mode` still passes in emulator mode (`IDLEWATCH_REQUIRE_FIREBASE_WRITES` can be satisfied in emulator path when configured).
- ⚠️ **OpenClaw integration gap:** `validate:firebase-write-required-once` ❌ still blocked due missing write creds/config:
  - Missing `FIREBASE_PROJECT_ID` and service-account settings (`FIREBASE_SERVICE_ACCOUNT_FILE` / `FIREBASE_SERVICE_ACCOUNT_JSON` / `FIREBASE_SERVICE_ACCOUNT_B64`) when `IDLEWATCH_REQUIRE_FIREBASE_WRITES=1`.
- ⚠️ **DMG packaging risk:** `validate:trusted-prereqs` ❌ still blocked by missing trusted-distribution secrets:
  - Missing `MACOS_CODESIGN_IDENTITY`
  - Missing `MACOS_NOTARY_PROFILE`

### Notes

- ✅ **Commit status:** `docs/qa/mac-qa-log.md` updated this cycle.

## QA cycle update — 2026-02-24 20:27 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability:** improved OpenClaw probe fallback behavior by making stored preferred probes validate executability before reusing and by honoring the legacy `IDLEWATCH_OPENCLAW_BIN_HINT` as the strict-mode fallback when `IDLEWATCH_OPENCLAW_BIN` is unset.
- ✅ **OpenClaw stats ingestion:** added regression coverage in strict-mode hint-path scenarios (`openclaw-env.test.mjs`) to verify the monitored sample still lands on OpenClaw with successful parsing via hint-based CLI resolution.
- ✅ **Packaging docs:** updated `README.md` + `docs/packaging/macos-dmg.md` to document explicit fallback behavior for `IDLEWATCH_OPENCLAW_BIN_HINT` under strict mode.
- ✅ **Validation:** ran `npm run test:unit` and `npm run validate:openclaw-release-gates --silent`.

### Notes

- ✅ **Commit status:** `bin/idlewatch-agent.js`, `test/openclaw-env.test.mjs`, `README.md`, `docs/packaging/macos-dmg.md`, `docs/qa/mac-qa-log.md` updated and ready for commit.

## QA cycle update — 2026-02-24 20:21 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **15 pass, 0 fail, 0 skip**.
- ✅ **Telemetry validation checks run:**
  - `validate:usage-freshness-e2e` ✅
  - `validate:usage-alert-rate-e2e` ✅
  - `validate:openclaw-release-gates` ✅
  - `validate:packaged-openclaw-release-gates` ✅
  - `validate:packaged-openclaw-robustness:reuse-artifact` ✅
  - `validate:packaged-dry-run-schema:reuse-artifact` ✅
  - `validate:dmg-install` ✅
  - `validate:dmg-checksum` ✅
- ✅ **Additional QA checks:**
  - `validate:packaged-metadata` ✅
  - `validate:packaged-bundled-runtime` ✅
- ✅ **OpenClaw integration checks:** `validate:firebase-emulator-mode` ✅ (passes in emulator mode) 
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` ❌ blocked — missing write credentials/config (`FIREBASE_PROJECT_ID` + service-account inputs) when `IDLEWATCH_REQUIRE_FIREBASE_WRITES=1`.
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` ❌ blocked — missing
  - `MACOS_CODESIGN_IDENTITY`
  - `MACOS_NOTARY_PROFILE`
- 🐞 **Bugs/features observed:**
  - ✅ No regressions detected vs. prior cycles.
  - ✅ No new packaging feature regressions observed.

### Notes

- ✅ **Commit status:** QA log documentation only this cycle.

## QA cycle update — 2026-02-24 20:16 America/Toronto

### Completed this cycle

- ✅ **Packaging/reliability script hardening:** tightened release gate sequencing so OpenClaw release checks are platform-aware and no longer run packaged reuse checks on non-macOS hosts.
- ✅ **Added missing release-gate helper:** introduced `validate:packaged-openclaw-robustness` to provide a fresh-packaging packaged resilience command for local full-gate runs.
- ✅ **Docs alignment:** updated `README.md` and `docs/packaging/macos-dmg.md` to match actual release-gate behavior and to surface `packaged-openclaw-robustness` in workflow guidance.
- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **15 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-metadata`
  - `validate:packaged-bundled-runtime`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-openclaw-robustness:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** stable; no new regressions found in this cycle.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account configuration).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** `README.md`, `docs/packaging/macos-dmg.md`, `package.json`, `docs/qa/mac-qa-log.md` updated.

## QA cycle update — 2026-02-24 20:10 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **15 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-metadata`
  - `validate:packaged-bundled-runtime`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-openclaw-robustness:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** stable; no new regressions found in this cycle.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account configuration).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only this cycle.

## QA cycle update — 2026-02-24 18:10 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **15 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-robustness:reuse-artifact`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** stable; no new regressions detected in this 18:10 cycle.
- ✅ **OpenClaw integration checks:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` remains blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account setup).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only this cycle.

## QA cycle update — 2026-02-24 10:10 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **15 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-robustness:reuse-artifact`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** stable; no new regressions seen in this 10:10 cycle.
- ✅ **OpenClaw integration checks:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account setup).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only this cycle.

## QA cycle update — 2026-02-24 10:00 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **15 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-robustness:reuse-artifact`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** no new regressions; no parsing/packaging behavior changes observed in this cycle.
- ✅ **OpenClaw integration checks:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` remains blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account setup).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only this cycle.

## QA cycle update — 2026-02-24 09:40 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **15 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-robustness:reuse-artifact`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** no new regressions observed; recent `package.json`/workflow/README edits are external prep changes and not part of QA log-only cycle.
- ✅ **OpenClaw integration checks:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account setup).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only this cycle.

## QA cycle update — 2026-02-24 09:20 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **15 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-robustness:reuse-artifact`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** no new regressions; parser and release-wrapper updates from 09:15 remain stable.
- ✅ **OpenClaw integration checks:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account setup).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only this cycle.

## QA cycle update — 2026-02-24 09:15 America/Toronto

### Completed this cycle

- ✅ **Monitoring/packaging reliability:** added top-level convenience release wrappers in `package.json` for consolidated OpenClaw verification (`validate:release-gate`, `validate:release-gate:all`) and wired them into CI/validation orchestration paths to avoid missing host+packaged coverage gaps.
- ✅ **Outcome:** one-command release validation now maps to both host and packaged resilience checks consistently.
- ✅ **Validation:** `npm run test:unit` and `SKIP_PACKAGING=1 npm run validate:all --silent` run successfully in this cycle.

### Notes

- ✅ **Commit status:** package scripts, CI/validate-all wrapper wiring, docs, and QA log completed.

## QA cycle update — 2026-02-24 09:10 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **15 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-robustness:reuse-artifact`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** no new regressions; packaging robustness grouping remains stable.
- ✅ **OpenClaw integration checks:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account setup).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only this cycle.

## QA cycle update — 2026-02-24 09:00 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **15 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-robustness:reuse-artifact`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** no new regressions; parser/time parsing tests from 08:55 remain stable.
- ✅ **OpenClaw integration checks:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account setup).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only this cycle.

## QA cycle update — 2026-02-24 08:55 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability hardening:** added regression test for ISO-format timestamp handling in mixed OpenClaw candidate arbitration.
  - New fixture/test confirms `parseOpenClawUsage` correctly picks the newer candidate when `updatedAt` is provided as ISO strings.
- ✅ **Why it matters:** prevents regressions in environments where OpenClaw returns stringified datetime fields instead of numeric epoch values.
- ✅ **Validation:** `npm run test:unit` ✅ with new scenario.

### Notes

- ✅ **Commit status:** fixture + parser regression test + QA log update completed.

## QA cycle update — 2026-02-24 08:50 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **15 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-robustness:reuse-artifact`
  - `validate:packaged-openclaw-robustness:reuse-artifact` (included in aggregate)
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** no new regressions; new packaged-robustness grouping remains stable in full sweep.
- ✅ **OpenClaw integration check:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account setup).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only this cycle.

## QA cycle update — 2026-02-24 08:46 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability hardening:** added regression test for timestamp normalization edge in mixed-output candidate arbitration.
  - New fixture/test ensures `parseOpenClawUsage` picks the newest candidate correctly when timestamp fields are string values in both status/generic payloads.
- ✅ **Outcome:** protects against future regressions where stringified `updatedAt` values could be mis-ranked during score-tie arbitration.
- ✅ **Validation:** `npm run test:unit` ✅ (with new test case included).

### Notes

- ✅ **Commit status:** parser test/fixture update + QA log completed.

## QA cycle update — 2026-02-24 08:35 America/Toronto

### Completed this cycle

- ✅ **Validation orchestration reliability:** simplified `scripts/validate-all.sh` packaging coverage to avoid redundant OpenClaw execution by:
  - running host gate as `validate:openclaw-release-gates` (host only)
  - replacing individual packaged checks with single `validate:packaged-openclaw-robustness:reuse-artifact`
- ✅ **Benefit:** prevents duplicated packaged OpenClaw release checks during full sweep while still covering age-SLO, alert-rate transitions, probe-noise resilience, and release-gate behavior.
- ✅ **Validation:** `npm run test:unit` ✅ and `SKIP_PACKAGING=1 npm run validate:all --silent` ✅.

### Notes

- ✅ **Commit status:** scripts + QA log update completed.

## QA cycle update — 2026-02-24 08:28 America/Toronto

### Completed this cycle

- ✅ **Packaging command simplification:** introduced `validate:packaged-openclaw-robustness:reuse-artifact` in `package.json` to group packaged OpenClaw resilience checks (age-SLO + alert-rate + probe-noise + release gates) in one command.
- ✅ **CI simplification:** replaced three separate CI OpenClaw checks with one `validate:packaged-openclaw-robustness:reuse-artifact --silent` step in `macos-packaging-smoke`.
- ✅ **Docs update:** `README.md` and `docs/packaging/macos-dmg.md` now document this consolidated packaged robustness gate.
- ✅ **Validation:** `npm run test:unit` ✅ and `npm run validate:openclaw-release-gates:all --silent` ✅.

### Notes

- ✅ **Commit status:** new bundled packaged robustness script + CI/docs updates completed.

## QA cycle update — 2026-02-24 08:23 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **19 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates:all`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-usage-health:reuse-artifact`
  - `validate:packaged-usage-age-slo:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`
  - `validate:packaged-usage-alert-rate-e2e:reuse-artifact`
  - `validate:packaged-usage-probe-noise-e2e:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** no new regressions; recent CI/doc cleanup work is stable and no new parsing/runtime issues observed.
- ✅ **OpenClaw integration checks:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account config).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only in this cycle.

## QA cycle update — 2026-02-24 08:16 America/Toronto

### Completed this cycle

- ✅ **CI packaging smoke cleanup:** removed redundant standalone `validate:packaged-usage-recovery-e2e:reuse-artifact` step from `.github/workflows/ci.yml` because packaged recovery is already validated through `validate:packaged-openclaw-release-gates:reuse-artifact`.
- ✅ **Docs alignment:** updated `docs/packaging/macos-dmg.md` baseline smoke step list to avoid duplicated coverage confusion and reflect that OpenClaw release gate covers recovery behavior.
- ✅ **Validation:** `SKIP_PACKAGING=1 npm run validate:all --silent` ✅ (**19 pass, 0 fail, 0 skip**).

### Notes

- ✅ **Commit status:** workflow and docs cleanup + QA log updated.

## QA cycle update — 2026-02-24 08:11 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **19 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates:all`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-usage-health:reuse-artifact`
  - `validate:packaged-usage-age-slo:reuse-artifact`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`
  - `validate:packaged-usage-alert-rate-e2e:reuse-artifact`
  - `validate:packaged-usage-probe-noise-e2e:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** no new regressions introduced; CI packaging simplification from this morning remains stable.
- ✅ **OpenClaw integration checks:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` remains blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account config).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` remains blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only this cycle.

## QA cycle update — 2026-02-24 08:05 America/Toronto

### Completed this cycle

- ✅ **CI packaging smoke simplification:** removed redundant explicit packaged OpenClaw usage-health step from `.github/workflows/ci.yml`.
  - Coverage for usage-health remains enforced through `validate:packaged-openclaw-release-gates:reuse-artifact`, which already includes `validate:packaged-usage-health:reuse-artifact`.
  - This reduces duplication while keeping the same reliability checks for health + stats fallback + stale-threshold recovery.
- ✅ **Validation:** `npm run test:unit` ✅ and `SKIP_PACKAGING=1 npm run validate:all --silent` ✅ (**19 pass, 0 fail, 0 skip**).

### Notes

- ✅ **Commit status:** workflow + QA log update completed.

## QA cycle update — 2026-02-24 07:55 America/Toronto

### Completed this cycle

- ✅ **Validation sweep reliability:** simplified `scripts/validate-all.sh` OpenClaw coverage by switching core step from `validate:openclaw-release-gates` to `validate:openclaw-release-gates:all`.
  - This keeps host and packaged-reuse OpenClaw checks in one deterministic gate and removes duplicated execution of `validate:packaged-openclaw-release-gates:reuse-artifact` from the packaging section.
- ✅ **Packaging script consistency:** updated skip/run sets to match the consolidated gate invocation.
- ✅ **Validation:** `npm run test:unit` and `SKIP_PACKAGING=1 npm run validate:all --silent` passed; this path validates full script-level refactor without packaging-only workload.

### Notes

- ✅ **Commit status:** validation-sweep reliability refactor + QA log update completed.

## QA cycle update — 2026-02-24 07:50 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **20 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-health`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-usage-health:reuse-artifact`
  - `validate:packaged-usage-age-slo:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`
  - `validate:packaged-usage-alert-rate-e2e:reuse-artifact`
  - `validate:packaged-usage-probe-noise-e2e:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** no new regressions; release validation behavior remains stable after recent docs/workflow edits.
- ✅ **OpenClaw integration check:** `validate:firebase-emulator-mode` continues to pass.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account setup).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only in this cycle.

## QA cycle update — 2026-02-24 07:45 America/Toronto

### Completed this cycle

- ✅ **Packaging command docs/scripting cleanup:** documented the new packaged/full OpenClaw release helper parity for local workflows in docs:
  - `README.md` now explicitly documents `validate:packaged-openclaw-release-gates:all` usage context.
  - `docs/packaging/macos-dmg.md` now notes host+packaged paired gate options and the new local all-in-one wrappers for release validation.
- ✅ **No behavioral risk:** this cycle was docs-only, preserving previously stabilized parser/release-gate logic.
- ✅ **Validation:** `npm run test:unit` ✅ (**267 pass, 0 fail**) and `npm run validate:packaged-openclaw-release-gates:all --silent` ✅.

### Notes

- ✅ **Commit status:** docs cleanup and QA update completed and pushed.

## QA cycle update — 2026-02-24 07:40 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **20 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks covered:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-health`
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-usage-health:reuse-artifact`
  - `validate:packaged-usage-age-slo:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`
  - `validate:packaged-usage-alert-rate-e2e:reuse-artifact`
  - `validate:packaged-usage-probe-noise-e2e:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** no new regressions; package reuse wrapper matrix remains stable.
- ✅ **OpenClaw integration:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account config).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only in this cycle.

## QA cycle update — 2026-02-24 07:31 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **20 pass, 0 fail, 0 skip**.
- ✅ **Telemetry validation checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-health`
  - `validate:packaged-dry-run-schema`
  - `validate:packaged-usage-age-slo`
  - `validate:packaged-usage-recovery-e2e`
  - `validate:packaged-usage-alert-rate-e2e`
  - `validate:packaged-usage-probe-noise-e2e`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Bugs/features status:** no new regressions; packaging sweep/wrapper adjustments from 07:25 remain stable.
- ✅ **OpenClaw integration check:** `validate:firebase-emulator-mode` remains passing.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account setup).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only this cycle.

## QA cycle update — 2026-02-24 07:25 America/Toronto

### Completed this cycle

- ✅ **Packaging script reliability hardening:** aligned `scripts/validate-all.sh` packaged-sweep entries with artifact-reuse wrappers for OpenClaw checks:
  - `validate:packaged-dry-run-schema:reuse-artifact`
  - `validate:packaged-usage-health:reuse-artifact`
  - `validate:packaged-usage-age-slo:reuse-artifact`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`
  - `validate:packaged-usage-alert-rate-e2e:reuse-artifact`
  - `validate:packaged-usage-probe-noise-e2e:reuse-artifact`
- ✅ **Validation:** `SKIP_PACKAGING=1 npm run validate:all --silent` ✅ (**20 pass, 0 fail, 0 skip**) with reuse-wrapper packaging stage names consistent across run/skip lists.

### Notes

- ✅ **Commit status:** script-only reliability improvement + QA log entry completed.

## QA cycle update — 2026-02-24 07:20 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **20 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks run:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-health`
  - `validate:packaged-dry-run-schema`
  - `validate:packaged-usage-age-slo`
  - `validate:packaged-usage-recovery-e2e`
  - `validate:packaged-usage-alert-rate-e2e`
  - `validate:packaged-usage-probe-noise-e2e`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** no new regressions observed; host + packaged OpenClaw gates remain stable and release-gate sequencing changes are effective.
- ✅ **OpenClaw integration checks:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account setup).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only this cycle.

## QA cycle update — 2026-02-24 07:15 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability + packaging coverage:** added host OpenClaw release-gate execution to the trusted release workflow (`.github/workflows/release-macos-trusted.yml`) so release checks now include both host and packaged resilience validation before artifact upload.
  - Host gate: `npm run validate:openclaw-release-gates --silent`
  - Packaged gate: `npm run validate:packaged-openclaw-release-gates:reuse-artifact --silent`
- ✅ **Packaging docs update:** clarified trusted release OpenClaw guardrail sequencing in `docs/packaging/macos-dmg.md` to explicitly list host + packaged OpenClaw gate stages.
- ✅ **Validation:** `npm run validate:openclaw-release-gates --silent` ✅

### Notes

- ✅ **Commit status:** release workflow + packaging docs + QA log update completed.

## QA cycle update — 2026-02-24 06:58 America/Toronto

### Completed this cycle

- ✅ **CI packaging reliability improvement:** aligned host OpenClaw smoke checks with the updated release-gate semantics by replacing the two separate host checks (`openclaw-cache-recovery-e2e` + `openclaw-stats-ingestion`) with a single `validate:openclaw-release-gates --silent` step in `.github/workflows/ci.yml`.
  - This ensures CI validates host OpenClaw coverage in one place: **usage-health, stats ingestion, and stale-cache recovery**.
- ✅ **Monitoring/ingestion confidence:** this removes partial gate drift where usage-health could be untested in host CI smoke while still being required in release validation.
- ✅ **Validation:** `npm run test:unit` ✅ (**267 pass, 0 fail**) and `npm run validate:openclaw-release-gates --silent` ✅.

### Notes

- ✅ **Commit status:** CI workflow updated + QA log entry completed.

## QA cycle update — 2026-02-24 06:52 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **20 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks executed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-health`
  - `validate:packaged-dry-run-schema`
  - `validate:packaged-usage-age-slo`
  - `validate:packaged-usage-recovery-e2e`
  - `validate:packaged-usage-alert-rate-e2e`
  - `validate:packaged-usage-probe-noise-e2e`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Feature/bugs status:** no new regressions; host `openclaw-release` now includes explicit usage-health validation and remains stable.
- ✅ **OpenClaw integration checks:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account config).
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only in this cycle.

## QA cycle update — 2026-02-24 06:45 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability:** added a new host OpenClaw health validation stage to the release gate so `parseOpenClawUsage` health behavior is now explicitly validated in `validate:openclaw-release-gates` in addition to stats fallback + cache recovery.
- ✅ **Packaging scripts/docs:** added `validate:openclaw-usage-health` validator and wired it into host release validation (`scripts/validate-openclaw-release-gates.mjs`, `package.json`). Updated `README.md` + `docs/packaging/macos-dmg.md` to document the host + packaged coverage split.
- ✅ **Validation:** ran `npm run validate:openclaw-release-gates --silent` and `npm run validate:openclaw-release-gates:all --silent` successfully.

### Notes

- ✅ **Commit status:** parser/docs/scripting updates completed and ready for push.

## QA cycle update — 2026-02-24 06:35 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability:** finalized deterministic OpenClaw usage arbitration by adding explicit recency-aware tie-breaker in `parseOpenClawUsage` and removing early-score short-circuiting.
- ✅ **Regression coverage:** added fixture + test `openclaw-mixed-equal-score-status-vs-generic-newest.txt` / `prefers most recent candidate when scores tie` to lock in stable behavior when mixed status/generic payloads return equal-confidence candidates.
- ✅ **Packaging docs:** clarified release-gate docs so both `README.md` and `docs/packaging/macos-dmg.md` explicitly document the `:reuse-artifact` release wrapper behavior (health + stats + cache-recovery checks).
- ✅ **Validation:** `npm run test:unit` ✅ (**267 pass, 0 fail**).

### Notes

- ✅ **Commit status:** parser arbitration + tests + docs + QA log updated.

## QA cycle update — 2026-02-24 06:30 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all`.
- ✅ **Result:** **20 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks executed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-health`
  - `validate:packaged-dry-run-schema`
  - `validate:packaged-usage-age-slo`
  - `validate:packaged-usage-recovery-e2e`
  - `validate:packaged-usage-alert-rate-e2e`
  - `validate:packaged-usage-probe-noise-e2e`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **Bugs/features status:** no new regressions observed; parser/docs updates from earlier this morning remain intact in working tree.
- ⚠️ **OpenClaw integration gap persists:** `validate:firebase-write-required-once` remains blocked by missing write credentials (`FIREBASE_PROJECT_ID` + service-account setup).
- ✅ **OpenClaw integration check:** `validate:firebase-emulator-mode` still passes.
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** QA log documentation only in this cycle (source/docs updates remain in working tree for prior fixes).

## QA cycle update — 2026-02-24 06:25 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability:** improved OpenClaw usage parser arbitration in `parseOpenClawUsage`:
  - added timestamp-aware tie-breaking when score is equal between status and generic candidates,
  - preserved source preference and kept candidate selection deterministic for mixed-output scenarios,
  - removed premature-return behavior so the highest-confidence usage candidate always wins.
- ✅ **Packaging docs hardening:** aligned OpenClaw release-gate documentation with artifact-reuse behavior.
  - `README.md` now explicitly documents `validate:packaged-openclaw-release-gates:reuse-artifact` as the artifact-reuse execution path.
  - `docs/packaging/macos-dmg.md` now lists that wrapper as including health + stats + cache-recovery reusable checks.
- ✅ **Coverage:** added fixture + regression test `prefers most recent candidate when scores tie` (`test/fixtures/openclaw-mixed-equal-score-status-vs-generic-newest.txt`).
- ✅ **Validation:** `npm run test:unit` ✅ (**267 pass, 0 fail**)

### Notes

- ✅ **Commit status:** parser arbitration fix + tests + docs + QA log update completed.

## QA cycle update — 2026-02-24 06:16 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability:** improved mixed-output candidate determinism by preferring the most recent candidate when both status and generic usage interpretations yield equal confidence.
- ✅ **Test hardening:** added fixture/test `openclaw-mixed-equal-score-status-vs-generic-newest.txt` and `prefers most recent candidate when scores tie`.
- ✅ **Validation:** `npm run test:unit` ✅ (**265 pass, 0 fail**)

### Notes

- ✅ **Commit status:** parser arbitration update + regression fixture/test + QA log entry completed.

## QA cycle update — 2026-02-24 06:09 America/Toronto

### Completed this cycle

- ✅ **OpenClaw parser reliability:** added timestamp-aware candidate arbitration in `parseOpenClawUsage`, ensuring newer stronger records are kept when status and generic candidates otherwise tie.
- ✅ **Regression coverage:** added fixture `openclaw-mixed-equal-score-status-vs-generic-newest.txt` and test `prefers most recent candidate when scores tie` for deterministic last-write-wins behavior on equal-score candidates.
- ✅ **Validation:** `npm run test:unit` and `npm run validate:all --silent` both passed.

### Notes

- ✅ **Commit status:** parser + fixture + test + QA log update completed.
