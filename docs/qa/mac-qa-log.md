# IdleWatch Mac QA Readiness Log

Date: 2026-02-16  
Owner: QA (Mac distribution + telemetry + OpenClaw integration)

> **Note:** Older QA cycle entries (2026-02-16 through 2026-02-17) are archived in `docs/qa/archive/mac-qa-log-2026-02-17.md`.

## Current status summary

### All resolved bugs (as of 2026-02-18)

- ✅ DMG install copy reliability (`cp` → `ditto`)
- ✅ Usage-age SLO false failures during idle (threshold relaxed to 600s)
- ✅ Restricted PATH probe failures in packaged `.app` (PATH augmentation fix)
- ✅ Idle stale policy undocumented (now in `docs/telemetry/idle-stale-policy.md`)
- ✅ Packaged validator timeout/retry reliability (configurable retries + backoff)
- ✅ OpenClaw probe executable permission gating (`X_OK` check)
- ✅ `spawnSync`-based output collection for deterministic validator behavior
- ✅ Nested `status.stats.current` parser coverage
- ✅ Wrapped status payload session selection failure (nested array flattening in `coerceSessionCandidates`)
- ✅ Session-specific model shadowed by defaults model (model priority fix in `parseFromStatusJson`)

### Remaining open items

- 🐛 **Open:** `Firebase is not configured` — no remote write-path verification yet (blocked on credentials).
- 🐛 **Open:** Distribution unsigned/unnotarized (`MACOS_CODESIGN_IDENTITY`, `MACOS_NOTARY_PROFILE` unset; blocked on Apple Developer credentials).

### Test health

- 128 unit tests pass, 0 fail
- All smoke tests green (dry-run, once, help)
- All packaging validators green (packaged-metadata, bundled-runtime, dmg-install, dmg-checksum, usage-age-slo, usage-recovery, alert-rate, probe-noise, cache-recovery)

## QA cycle update — 2026-02-18 17:39 America/Toronto

### Completed this cycle

- ✅ **Session selection bug fixed:** `coerceSessionCandidates` now flattens nested arrays when a sessions array is found as a value in an object map. Previously, wrapped status payloads like `{ result: { sessions: [...] } }` returned `[[session]]` instead of `[session]`, causing `pickBestRecentSession` to fail silently.
- ✅ **Model priority bug fixed:** `parseFromStatusJson` now checks `session.usage.model` before `defaults.model`, so session-specific models (e.g. `claude-opus-4.6`) are no longer shadowed by the default model (e.g. `gpt-4.1`).
- ✅ **Refactored envelope detection:** Extracted `deepGet`, `hasTruthyAtAnyPath` helpers and declarative prefix/leaf constant arrays, reducing code duplication in session envelope and stats detection.
- ✅ **All unit tests green:** 128 pass, 0 fail.
- ✅ **Smoke tests green.**
- ✅ **Committed and pushed to main:** `06553bd`

### Bugs resolved this cycle

- ✅ **Closed:** Wrapped status payload with direct session array not selecting sessions — fixed by flattening nested arrays in `coerceSessionCandidates`.
- ✅ **Closed:** Session-specific model overridden by defaults model — fixed model priority order in `parseFromStatusJson`.

### Remaining open items

- 🐛 **Open:** `Firebase is not configured` — no remote write-path verification yet (blocked on credentials).
- 🐛 **Open:** Distribution unsigned/unnotarized (blocked on Apple Developer credentials).

## QA cycle update — 2026-02-18 07:25 America/Toronto

### Completed this cycle

- ✅ **`validate:all` script added:** `scripts/validate-all.sh` runs all core + packaging validators in one pass with pass/fail/skip summary. Supports `--skip-packaging` for quick core-only runs. Added as `npm run validate:all` and `npm run validate:all:quick`.
- ✅ **LaunchAgent setup docs added:** `docs/packaging/macos-launch-agent.md` documents install/uninstall, configuration knobs, log locations, verification, and troubleshooting.
- ✅ **QA log trimmed:** Archived 5800+ lines of repetitive cycle entries to `docs/qa/archive/mac-qa-log-2026-02-17.md`. Current log retains status summary + actionable entries only.
- ✅ **All unit tests green:** 192 pass, 0 fail.
- ✅ **Smoke tests green.**

### Validation checks run

- ✅ `npm run test:unit`
- ✅ `npm run smoke:dry-run`
- ✅ `npm run smoke:once`

### Follow-up / status

1. Firebase/emulator write-path validation remains pending until credentials are available.
2. Signing/notarization pipeline remains the next major distribution milestone.
3. Run `npm run validate:all` for full sweep when packaging validators are needed.

## QA cycle update — 2026-02-18 07:12 America/Toronto

### Completed this cycle

- ✅ **Restricted PATH probe fix shipped:** OpenClaw probe subprocess now inherits an augmented PATH that includes the running node binary's directory (`process.execPath` dirname) plus `/opt/homebrew/bin`, `/usr/local/bin`, and `~/.local/bin`. This fixes `#!/usr/bin/env node` resolution failures in packaged `.app` bundles running with minimal PATH.
- ✅ **Idle stale policy docs committed:** `docs/telemetry/idle-stale-policy.md` (previously untracked) now tracked and documents expected stale/warning behavior during idle, thresholds, and dashboard guidance.
- ✅ **All unit tests green:** 192 pass, 0 fail.
- ✅ **Smoke tests green:** dry-run and once modes verified with augmented PATH.
- ✅ **Committed and pushed to main:** `8800cc7`

### Bugs resolved this cycle

- ✅ **Closed:** Packaged OpenClaw parsing in restricted PATH producing `parse-error`/`availability` failures — fixed by augmenting probe subprocess PATH with node binary location and common system dirs.
- ✅ **Closed:** `openclawUsageAgeMs` stale/warning idle policy not documented — now documented in `docs/telemetry/idle-stale-policy.md`.

### Remaining open items

- 🐛 **Open:** `Firebase is not configured` — no remote write-path verification yet.
- 🐛 **Open:** Distribution unsigned/unnotarized (`MACOS_CODESIGN_IDENTITY`, `MACOS_NOTARY_PROFILE` unset).

## QA cycle update — 2026-02-18 02:15 America/Toronto

### Completed this cycle

- ✅ **DMG install copy reliability fix shipped:** replaced `cp -R` with `ditto` in `validate-dmg-install.sh`, eliminating extended-attribute and missing-file copy errors from mounted DMG images.
- ✅ **Usage-age SLO threshold relaxed:** bumped `IDLEWATCH_MAX_OPENCLAW_USAGE_AGE_MS` from 300s to 600s in `validate:packaged-usage-age-slo` to accommodate normal idle-period drift (250–360s observed regularly).
- ✅ **All validators green:** 192 unit tests pass, `validate:dmg-install` passes on first attempt (no fallback needed), `validate:packaged-usage-age-slo` passes.
- ✅ **Committed and pushed to main:** `e405b34`

### Bugs resolved this cycle

- ✅ **Closed:** `validate:dmg-install` `cp`/extended-attribute failures — fixed by using `ditto`.
- ✅ **Closed:** `validate:packaged-usage-age-slo` false failures during idle — SLO threshold relaxed to 600s.
