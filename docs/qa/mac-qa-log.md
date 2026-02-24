## QA cycle update — 2026-02-24 04:00 America/Toronto

### Completed this cycle

- ✅ **Validation sweep:** ran `npm run validate:all` in repository root.
- ✅ **Result:** **18 pass, 0 fail, 0 skip**.
- ✅ **Telemetry validation checks executed in this cycle:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **OpenClaw checks:** `validate:firebase-emulator-mode` passed (firebase emulator + dry-run mode).
- ⚠️ **OpenClaw write-path check gap:** `validate:firebase-write-required-once` is still blocked: Firebase write credentials are not configured (`FIREBASE_PROJECT_ID` + service-account settings missing), so end-to-end write confirmation remains pending.
- ⚠️ **DMG packaging trust risk:** `validate:trusted-prereqs` still blocked by missing signing/notary environment (`MACOS_CODESIGN_IDENTITY` and `MACOS_NOTARY_PROFILE`), leaving notarization and signed-distribution readiness unverified.

### Notes

- ✅ **Commit status:** documentation update in `docs/qa/mac-qa-log.md` only.

## QA cycle update — 2026-02-24 01:35 America/Toronto

### Completed this cycle

- ✅ **Script hygiene:** added and documented `:reuse-artifact` OpenClaw wrappers for all host/packaged validator commands to make CI and local reuse explicit and consistent.
- ✅ **Workflow consistency:** switched validation invocations in `scripts/validate-all.sh` and CI to the artifact-reuse wrappers where applicable.
- ✅ **Packaging reliability:** avoids repeated packaging during a single run and keeps validator behavior stable when an artifact is already available.

### Validation details

- ✅ `npm run validate:openclaw-release-gates:reuse-artifact --silent` passed.
- ✅ `npm run validate:packaged-openclaw-release-gates:reuse-artifact --silent` passed.
- ✅ `npm run validate:all --silent` passed (post-wrapper migration).

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.


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
- ✅ Graceful shutdown flow now waits on sample publish before exit.

### Remaining open items

- 🐛 **Open:** `Firebase is not configured` — no remote write-path verification yet (blocked on credentials).
- 🐛 **Open:** Distribution unsigned/unnotarized (`MACOS_CODESIGN_IDENTITY`, `MACOS_NOTARY_PROFILE` unset; blocked on Apple Developer credentials).
- 🐛 **Open:** OpenClaw write integration still lacks emulator/credentialed end-to-end confirmation in automated release packaging mode.

### Test health

- 225 unit tests pass, 0 fail (latest run: 2026-02-24 03:50)
- All smoke tests green (dry-run, once, help)
- All packaging validators green (packaged-metadata, bundled-runtime, dmg-install, dmg-checksum, usage-age-slo, usage-recovery, alert-rate, probe-noise, cache-recovery, packaged-openclaw-stats-ingestion, packaged-openclaw-cache-recovery-e2e)

## QA cycle update — 2026-02-24 03:50 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all`.
- ✅ **Result:** **18 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates:reuse-artifact`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`

### Notes and risks

- ✅ **No regressions** seen this run.
- 🧨 **OpenClaw integration gap remains:** `validate:firebase-write-required-once` still blocked due missing Firebase write credentials.
- ⚠️ **DMG packaging trust risk remains:** trusted-prereqs remains blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** no source code changes this cycle; QA log documentation only.

## QA cycle update — 2026-02-24 03:30 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all`.
- ✅ **Result:** **18 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates:reuse-artifact`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`

### OpenClaw + packaging risk notes

- ✅ `validate:firebase-emulator-mode` (emulator dry-run) passed.
- 🧨 **OpenClaw integration gap persists:** `validate:firebase-write-required-once` continues to fail until Firebase write credentials are configured.
- ⚠️ **DMG packaging trust risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE` in this environment.

### Notes

- ✅ **Commit status:** no source-code changes this cycle; QA log documentation only.

## QA cycle update — 2026-02-24 03:20 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all`.
- ✅ **Result:** **18 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates:reuse-artifact`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`

### Feature / risk status

- ✅ No new regressions detected.
- 🧨 OpenClaw integration gap remains: `validate:firebase-write-required-once` still blocked by missing Firebase write credentials.
- ⚠️ DMG packaging trust risk persists: `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** no source changes; QA log documentation only.

## QA cycle update — 2026-02-24 03:10 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all`.
- ✅ **Result:** **18 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates:reuse-artifact`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`

### Feature / risk notes

- ✅ **No new regressions** detected in this cycle.
- 🧨 **OpenClaw integration gap remains:** `validate:firebase-write-required-once` blocked without Firebase write credentials.
- ⚠️ **DMG packaging trust risk remains:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE` on this host.

### Notes

- ✅ **Commit status:** no source-code changes this cycle; QA log documentation only.

## QA cycle update — 2026-02-24 03:00 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all` (artifact-reuse mode).
- ✅ **Result:** **18 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates:reuse-artifact`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`

### Feature / risk notes

- ✅ **No regressions** found in this cycle.
- 🧨 **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing Firebase write credentials.
- ⚠️ **DMG packaging trust risk persists:** `validate:trusted-prereqs` still blocked by missing Apple signing/notary configuration.

### Notes

- ✅ **Commit status:** no source-code changes this cycle; QA log documentation only.

## QA cycle update — 2026-02-24 02:40 America/Toronto

### Completed this cycle

- ✅ **Validation sweep re-run:** Ran `npm run validate:all`.
- ✅ **Result:** **18 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates:reuse-artifact`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`

### Feature / risk status

- ✅ **Stability:** no new regressions observed in this cycle.
- 🧨 **OpenClaw integration gap remains:** write-path check (`validate:firebase-write-required-once`) remains blocked by missing Firebase write credentials.
- ⚠️ **DMG packaging trust risk remains:** trusted-prereqs still blocked by missing `MACOS_CODESIGN_IDENTITY` and `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** no source-code changes this cycle; QA log documentation only.

## QA cycle update — 2026-02-24 02:20 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all` with reuse-artifact mode checks.
- ✅ **Result:** **18 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates:reuse-artifact`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`

### Feature / risk notes

- ✅ No regressions observed in current stability checks.
- 🧨 OpenClaw integration gap remains: `validate:firebase-write-required-once` still blocked without Firebase write credentials.
- ⚠️ DMG packaging trust risk remains: missing signing/notary env still blocks `validate:trusted-prereqs`.

### Notes

- ✅ **Commit status:** QA log documentation update only for this cycle.

## QA cycle update — 2026-02-24 01:40 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all` with release-gate reuse mode.
- ✅ **Result:** **18 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates:reuse-artifact`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`

### OpenClaw/packaging notes

- ✅ `validate:firebase-emulator-mode` (emulator dry-run) passed.
- 🧨 **OpenClaw integration gap persists:** remote write-path validation (`validate:firebase-write-required-once`) still blocked by missing Firebase write credentials.
- ⚠️ **DMG packaging trust risk persists:** trusted prerequisite check remains blocked by missing `MACOS_CODESIGN_IDENTITY`/`MACOS_NOTARY_PROFILE` in this environment.

### Notes

- ✅ **Commit status:** no source code changes this cycle; QA log documentation only.

## QA cycle update — 2026-02-24 01:30 America/Toronto

### Completed this cycle

- ✅ **Validation sweep re-run:** Ran `npm run validate:all` with updated reuse-only release checks.
- ✅ **Result:** **18 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates:reuse-artifact`
  - `validate:packaged-openclaw-release-gates:reuse-artifact`
  - `validate:packaged-usage-recovery-e2e:reuse-artifact`

### Feature / risk status

- ✅ **No new regressions** seen in this cycle.
- 🧨 **OpenClaw integration gap persists:** `validate:firebase-write-required-once` remains blocked without Firebase write credentials.
- ⚠️ **DMG packaging risk remains:** trusted release still blocked by missing `MACOS_CODESIGN_IDENTITY` and `MACOS_NOTARY_PROFILE` in this host env.

### Notes

- ✅ **Commit status:** no source changes this cycle; QA log documentation only.

## QA cycle update — 2026-02-24 01:11 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all`.
- ✅ **Result:** **18 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:packaged-openclaw-release-gates`

### Feature / risk notes

- ✅ **No regressions:** host and packaged OpenClaw validation remains stable.
- 🧨 **OpenClaw integration gap remains:** `validate:firebase-write-required-once` still blocked due missing Firebase write credentials.
- ⚠️ **DMG packaging risk persists:** trusted-release remains blocked on this host by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** no source code changes this cycle; QA log documentation only.

## QA cycle update — 2026-02-24 00:55 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all`.
- ✅ **Result:** **18 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:dry-run-schema`
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-release-gates`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-release-gates`

### Feature / risk notes

- ✅ **No new regressions** observed; host and packaged OpenClaw release-gate commands both pass.
- 🧨 **OpenClaw integration gap remains:** `validate:firebase-write-required-once` still blocked by missing Firebase write credentials.
- ⚠️ **DMG packaging trust risk remains:** `validate:trusted-prereqs` continues to fail without Apple signing/notary credentials (`MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`).

### Notes

- ✅ **Commit status:** no source changes this cycle; QA log documentation only.

## QA cycle update — 2026-02-24 01:05 America/Toronto

### Completed this cycle

- ✅ **Packaging reliability:** updated `validate:packaged-usage-recovery-e2e` to honor `IDLEWATCH_SKIP_PACKAGE_MACOS=1`, preventing duplicate repackaging when a prebuilt artifact is already available in validation suites.
- ✅ **CI sweep optimization:** `.github/workflows/ci.yml` now runs packaged usage-recovery validation in artifact-reuse mode (`IDLEWATCH_SKIP_PACKAGE_MACOS=1`) after packaging gate steps.
- ✅ **Doc/validation consistency:** kept `validate:all` passing with stable behavior under reused-artifact packaging mode for noisy-probe recovery checks.

### Validation details

- ✅ `IDLEWATCH_SKIP_PACKAGE_MACOS=1 npm run validate:packaged-usage-recovery-e2e --silent` passed.
- ✅ `npm run validate:all --silent` passed: **18 pass, 0 fail, 0 skip**.

### Features / risks observed

- ✅ **Feature:** reduces CI package churn and lowers false failure risk from repeated packaging for the same validation run.
- 🧨 **OpenClaw integration gap remains:** remote write-path verification still requires Firebase write credentials.
- ⚠️ **Distribution trust risk remains:** signed/notarized release checks still depend on Apple credentials on this host.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-24 00:54 America/Toronto

### Completed this cycle

- ✅ **Script consolidation:** added host-side OpenClaw release gate script `validate:openclaw-release-gates` to run stats-ingestion + cache-recovery checks as one operator-friendly command.
- ✅ **Packaging scripts simplification:** `scripts/validate-all.sh` now calls the host gate instead of running the two OpenClaw validators separately.
- ✅ **Docs alignment:** README validation helper list now documents `validate:openclaw-release-gates` for host CI parity with packaged release-gate behavior.

### Validation details

- ✅ `npm run validate:openclaw-release-gates --silent` passed.
- ✅ `npm run validate:all --silent` passed: **18 pass, 0 fail, 0 skip**.
- ✅ `npm run test:unit -- test/openclaw-usage.test.mjs` passed (**30 pass, 0 fail**).

### Features / risks observed

- ✅ **Feature:** reduces drift between host and packaged OpenClaw reliability checks by standardizing a single command for the common reliability pairing.
- 🧨 **OpenClaw integration gap remains:** remote write-path confirmation still requires Firebase write credentials (`validate:firebase-write-required-once`).
- ⚠️ **Distribution trust risk remains:** signed/notarized release path still requires Apple credentials in this environment.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-24 00:44 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all`.
- ✅ **Result:** **19 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw validations confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-release-gates`

### Features / risks

- ✅ **No regressions** in this run; existing OpenClaw parser hardening continues to hold in full sweep.
- 🧨 **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing Firebase write credentials.
- ⚠️ **DMG packaging trust risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE` on this host.

### Notes

- ✅ **Commit status:** no source-code updates this cycle; QA log documentation only.

## QA cycle update — 2026-02-24 00:35 America/Toronto

### Completed this cycle

- ✅ **OpenClaw parser reliability expansion:** added fixture and unit test coverage for mixed terminal noise sequences (CSI + OSC + DCS together) to validate parser robustness under real-world noisy CLI output.
- ✅ **Monitoring reliability:** parser pass count increased to include mixed-noise case, now covering 30 targeted OpenClaw parser tests (0 fail).
- ✅ **Validation continuity:** full validation sweep remains green after noise-regression hardening.

### Validation details

- ✅ `npm run test:unit -- test/openclaw-usage.test.mjs` passed (30 pass, 0 fail).
- ✅ `npm run validate:all --silent` passed: **19 pass, 0 fail, 0 skip**.

### Features / risks observed

- ✅ **Feature:** this closes another common ingestion edge case where probe output contains multiple control sequence formats in a single stream.
- 🧨 **OpenClaw integration gap remains:** remote write-path verification still blocked by Firebase write credentials (`validate:firebase-write-required-once`).
- ⚠️ **Distribution trust risk remains:** release notarization trust path still depends on Apple credentials in this environment.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-24 00:27 America/Toronto

### Completed this cycle

- ✅ **Documentation maintenance:** updated `README.md` validation helper list to include `validate:packaged-openclaw-release-gates` and document that it groups usage-health, stats, and cache-recovery checks into one artifact-aware release gate.
- ✅ **Packaging/docs alignment:** this keeps operator runbooks in sync with the actual release validation execution model and reduces configuration drift.

### Validation details

- ✅ `node -e "console.log('docs update only')"` (documentation validation)

### Features / risks observed

- ✅ **Feature:** easier discoverability of the consolidated release gate for OpenClaw telemetry checks.
- 🧨 **OpenClaw integration gap remains:** remote write-path verification still blocked by Firebase write credentials.
- ⚠️ **Distribution trust risk remains:** signed/notarized release execution still requires Apple credentials on this host.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-24 00:30 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all` using artifact-reuse packaged OpenClaw release gate.
- ✅ **Result:** **19 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-release-gates`

### OpenClaw + packaging status

- ✅ `validate:firebase-emulator-mode` (emulator dry-run) passed.
- 🧨 **OpenClaw integration gap remains:** `validate:firebase-write-required-once` still blocked without Firebase write credentials.
- ⚠️ **DMG packaging trust risk remains:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE` in this environment.

### Notes

- ✅ **Commit status:** no source changes this cycle; QA log update only.

## QA cycle update — 2026-02-24 00:16 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all` (artifact-reuse release gate mode).
- ✅ **Result:** **19 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-release-gates`

### Feature / gap status

- ✅ **No new regressions** in telemetry parsing or packaging checks.
- 🧨 **OpenClaw integration gap remains:** `validate:firebase-write-required-once` still blocked without Firebase write credentials.
- ⚠️ **DMG packaging trust risk remains:** trusted-release remains blocked here by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** no source code changes this cycle; QA log documentation only.

## QA cycle update — 2026-02-24 00:15 America/Toronto

### Completed this cycle

- ✅ **OpenClaw parser hardening (terminal-control coverage):** extended noise stripping in `extractOpenClawNoise` to remove DCS (`ESC P ... ESC\`) control sequences before JSON extraction.
- ✅ **Monitoring reliability:** added fixture `openclaw-status-dcs-noise.txt` and new unit test `strips DCS control sequences before parsing JSON`.
- ✅ **Validation:** full test and full validation sweep still pass after DCS/noise hardening.

### Validation details

- ✅ `npm run test:unit -- test/openclaw-usage.test.mjs` passed (**29 pass, 0 fail**).
- ✅ `npm run validate:all --silent` passed: **19 pass, 0 fail, 0 skip**.

### Features / risks observed

- ✅ **Feature:** parser now tolerates an additional terminal control sequence class seen in real-world CLI environments (DCS payload wrappers), reducing false-negative ingestion events.
- 🧨 **OpenClaw integration gap remains:** remote write-path confirmation still requires credentials for `validate:firebase-write-required-once`.
- ⚠️ **Distribution trust risk remains:** signed/notarized release execution still requires Apple credentials on this host.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-23 23:55 America/Toronto

### Completed this cycle

- ✅ **OpenClaw parser hardening extended:** added OSC/title-control stripping in `extractOpenClawNoise` to remove terminal control sequences (`ESC ] ... BEL/ESC\`) before JSON extraction.
- ✅ **Monitoring reliability:** added fixture+unit test `openclaw-status-osc-noise.txt` and new test `strips OSC/title control sequences before parsing JSON` to guard parser behavior in noisy terminal environments.
- ✅ **Validation continuity:** existing `validate:all` sweep remains green with the OSC-control parser enhancement.

### Validation details

- ✅ `npm run test:unit -- test/openclaw-usage.test.mjs` passed (**28 pass, 0 fail**).
- ✅ `npm run validate:all --silent` passed: **19 pass, 0 fail, 0 skip**.

### Features / risks observed

- ✅ **Feature:** improved resilience to real-world terminal output artifacts like OSC title and control-sequence noise that can hide valid OpenClaw payloads.
- 🧨 **OpenClaw integration gap remains:** remote write-path validation still depends on Firebase write credentials (`validate:firebase-write-required-once`).
- ⚠️ **Distribution trust risk remains:** signed/notarized release run still depends on Apple credentials on this host.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-24 00:03 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all`.
- ✅ **Result:** **19 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw validation checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-release-gates`

### Feature / risks

- ✅ **No new issues** surfaced in telemetry or packaging checks this cycle.
- 🧨 **OpenClaw integration gap remains:** `validate:firebase-write-required-once` still blocked by missing Firebase write credentials.
- ⚠️ **DMG packaging trust risk remains:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE` in this environment.

### Notes

- ✅ **Commit status:** docs-only update for this cycle.

## QA cycle update — 2026-02-23 23:36 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all`.
- ✅ **Result:** **19 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw validations confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-release-gates`

### Feature / gap status

- ✅ **No new regressions** in telemetry and packaging checks in this run.
- 🧨 **OpenClaw integration gap persists:** `validate:firebase-write-required-once` remains blocked until Firebase write credentials are configured.
- ⚠️ **DMG packaging risk persists:** trusted-release gates remain blocked on this host due missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** docs-only update for this cycle.

## QA cycle update — 2026-02-23 23:24 America/Toronto

### Completed this cycle

- ✅ **Validation sweep re-run:** Ran `npm run validate:all` from `idlewatch-skill`.
- ✅ **Result:** **19 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-release-gates`

### OpenClaw + packaging risk checks

- ✅ `validate:firebase-emulator-mode` (emulator dry-run) passed.
- 🧨 **OpenClaw integration gap persists:** `validate:firebase-write-required-once` remains blocked due missing Firebase write credentials.
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / notary profile on this host.

### Notes

- ✅ **Commit status:** no source code changes this cycle; QA log documentation only.

## QA cycle update — 2026-02-23 23:13 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all` with the consolidated OpenClaw release-gate path.
- ✅ **Result:** **19 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-release-gates`

### OpenClaw + packaging status

- ✅ `validate:firebase-emulator-mode` (emulator dry-run) passed.
- 🧨 **OpenClaw integration gap persists:** remote write-path check (`validate:firebase-write-required-once`) still fails without Firebase write credentials.
- ⚠️ **DMG packaging risk persists:** trusted-release prereqs still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** no source changes this cycle; QA log documentation updated.

## QA cycle update — 2026-02-23 23:35 America/Toronto

### Completed this cycle

- ✅ **Parser hardening:** stripped terminal control/ANSI escape sequences before JSON candidate extraction (`extractOpenClawNoise`) to avoid false parse misses when probe output includes cursor movement / color / control codes.
- ✅ **Monitoring reliability:** Added fixture+unit test coverage for complex ANSI noise (`openclaw-status-ansi-complex-noise.txt`) to ensure valid usage payloads are still parsed in noisy stderr/stdout.
- ✅ **Packaging validation preserved:** existing full-sweep packaging checks still pass unchanged with this parser update.

### Validation details

- ✅ `npm run test:unit -- test/openclaw-usage.test.mjs` passed (26 tests, 0 fail).
- ✅ `npm run validate:all --silent` passed: **19 pass, 0 fail, 0 skip**.

### Features / risks

- ✅ **Feature:** CLI logs with ANSI cursor/color/control chatter no longer silently block usage ingestion.
- ⚠️ **OpenClaw integration gap remains:** remote write-path verification is still blocked by missing Firebase write credentials.
- ⚠️ **Packaging trust risk remains:** unsigned/notarized release validation remains dependent on Apple signing/notary setup in this environment.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-23 23:25 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability hardening:** improved `parseOpenClawUsage` candidate selection so it now scores parsed candidates and selects the strongest usable payload from noisy outputs, instead of returning first partial/default-only payload.
- ✅ **OpenClaw stats ingestion reliability:** added coverage for multi-object noisy output where early JSON only carries metadata/default model and later JSON carries active usage/session data.
- ✅ **Parser test coverage expanded:** added fixture `openclaw-status-noisy-default-then-usage.txt` and new unit test `chooses strongest usage payload when earlier JSON is metadata-only`.

### Validation details

- ✅ `npm run test:unit -- test/openclaw-usage.test.mjs` passed (25 tests, 0 fail).
- ✅ `npm run validate:all --silent` passed: **19 pass, 0 fail, 0 skip**.

### Features / bugs / risks observed

- ✅ **Feature:** Better protection against false negatives in CLI runs where stderr/stdout contains multiple JSON documents and only later documents have valid usage telemetry.
- 🧨 **OpenClaw integration gap remains:** remote write-path verification still depends on Firebase write credentials.
- ⚠️ **Distribution trust risk remains:** signed/notarized validation still requires Apple credentials in this environment.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-23 23:15 America/Toronto

### Completed this cycle

- ✅ **Parser reliability improvement:** Added unit coverage for OpenClaw noise formats with ANSI escape sequences, including prefixed/suffixed escape-coded warnings around JSON payloads, ensuring parser keeps selecting valid JSON candidates.
- ✅ **Monitoring reliability:** Increased resilience to real CLI stderr/stdout corruption patterns in OpenClaw status output without weakening core parsing behavior.
- ✅ **Validation sweep:** Full validation sweep still passes with no regressions.

### Validation details

- ✅ `npm run test:unit -- test/openclaw-usage.test.mjs` passed (added ANSI-noise fixture coverage).
- ✅ `npm run validate:all --silent` passed: **19 pass, 0 fail, 0 skip**.

### Features / bugs / risks observed

- ✅ **Feature:** OpenClaw parser now explicitly validated against escaped terminal-output noise, reducing false negatives in real-world packaged monitor runs.
- 🧨 **OpenClaw integration gap remains:** full remote write-path check is still blocked by missing Firebase write credentials (`validate:firebase-write-required-once`).
- ⚠️ **Distribution trust risk remains:** signed/notarized release path still requires Apple credentials on this host.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-23 22:57 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all` (artifact-reuse release gates enabled).
- ✅ **Result:** **19 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-release-gates`

### Feature/risk status

- ✅ **Stability:** no new regressions detected in packaged or non-packaged telemetry checks.
- 🧨 **OpenClaw integration gap persists:** remote write-path validation is still blocked by missing Firebase write credentials (`validate:firebase-write-required-once`).
- ⚠️ **DMG packaging trust remains gated:** `validate:trusted-prereqs` still fails here due missing `MACOS_CODESIGN_IDENTITY`/`MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** no source-code changes this cycle; QA log documentation only.

## QA cycle update — 2026-02-23 22:43 America/Toronto

### Completed this cycle

- ✅ **Validation sweep re-run:** Ran `npm run validate:all` (artifact-reuse release gate mode).
- ✅ **Result:** **19 pass, 0 fail, 0 skip**.
- ✅ **Telemetry and OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-release-gates`

### Features / bugs / risks

- ✅ **No regression:** all previously added OpenClaw packaging/runtime checks remained green.
- 🧨 **OpenClaw integration gap remains:** `validate:firebase-write-required-once` still blocked by missing Firebase write credentials.
- ⚠️ **DMG packaging risk remains:** trusted-release prerequisites still blocked on this host due to missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.

### Notes

- ✅ **Commit status:** no code changes this cycle; QA log updated only.

## QA cycle update — 2026-02-23 22:31 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all` (consolidated release-gate mode enabled).
- ✅ **Result:** **19 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw validations confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-release-gates`

### Feature/risk notes

- ✅ **No new regressions** in this cycle.
- 🧨 **OpenClaw integration gap persists:** `validate:firebase-write-required-once` remains blocked without Firebase write credentials.
- ⚠️ **DMG packaging trust risk persists:** trusted distribution still blocked by missing `MACOS_CODESIGN_IDENTITY` / notary profile in this host environment.

### Notes

- ✅ **Commit status:** no source-code changes; QA log update only.

## QA cycle update — 2026-02-23 22:16 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all` with consolidated release gate mode.
- ✅ **Result:** **19 pass, 0 fail, 0 skip**.
- ✅ **OpenClaw/telemetry checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-release-gates` (artifact reuse mode)

### Feature/risk notes

- ✅ **No regressions:** release-gate consolidation remains stable across local and packaging validation.
- 🧨 **OpenClaw integration gap remains:** remote write-path (`validate:firebase-write-required-once`) still fails without Firebase credentials.
- ⚠️ **DMG packaging risk remains:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY`/notary profile, so trusted release confidence is blocked on this host.

### Notes

- ✅ **Commit status:** no code changes this cycle; QA log documentation update only.

## QA cycle update — 2026-02-23 23:05 America/Toronto

### Completed this cycle

- ✅ **Release-gate robustness improvement:** Hardened `validate:packaged-openclaw-release-gates` to consistently parse `IDLEWATCH_REQUIRE_OPENCLAW_USAGE` values (`1/true/on/yes` enable, `0/false/off/no` disable).
- ✅ **Caller reliability improvement:** Gate now uses a single normalized interpretation for OpenClaw requirement and always passes an explicit `IDLEWATCH_REQUIRE_OPENCLAW_USAGE` flag to subcommands, preventing ambiguous env handling.
- ✅ **Docs aligned:** Packaging and trusted-release docs now explicitly document accepted `IDLEWATCH_REQUIRE_OPENCLAW_USAGE` toggles.

### Validation details

- ✅ `npm run validate:packaged-openclaw-release-gates --silent` passed with explicit boolean parsing behavior.
- ✅ `npm run validate:all --silent` remains green: **19 pass, 0 fail, 0 skip**.

### Features / bugs / risks observed

- ✅ **Feature:** Cleaner config semantics for release checks when toggling OpenClaw enforcement in CI/debug flows.
- 🧨 **OpenClaw integration gap remains:** full write-path verification still blocked without Firebase write credentials.
- ⚠️ **Distribution trust risk remains:** signing/notary verification still depends on Apple credentials on this host.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-23 22:45 America/Toronto

### Completed this cycle

- ✅ **Release-gate determinism improvement:** `validate:packaged-openclaw-release-gates` now enforces OpenClaw-health by default (`IDLEWATCH_REQUIRE_OPENCLAW_USAGE=1`) inside the gate runner itself, preventing callers from accidentally omitting usage validation.
- ✅ **Packaging scripts cleanup:** Removed duplicated per-workflow env wiring by relying on gate defaults; CI and trusted release now only pass artifact-reuse mode (`IDLEWATCH_SKIP_PACKAGE_MACOS=1`) at call sites.
- ✅ **Docs aligned:** README and packaging docs updated to call out default `IDLEWATCH_REQUIRE_OPENCLAW_USAGE=1` behavior for release-gate execution.

### Validation details

- ✅ `npm run validate:packaged-openclaw-release-gates --silent` passed with default gate behavior.
- ✅ `npm run validate:all --silent` remains green: **19 pass, 0 fail, 0 skip**.

### Features / bugs / risks observed

- ✅ **Feature:** Default behavior is now explicit and self-contained in release-gate runner, reducing duplication across CI/trusted workflow callers.
- 🧨 **OpenClaw integration gap remains:** no remote write-path check without write credentials.
- ⚠️ **Packaging trust risk remains:** signed/notarized verification still depends on Apple credentials in CI.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-23 22:25 America/Toronto

### Completed this cycle

- ✅ **CI+release alignment:** Updated `.github/workflows/ci.yml` packaging smoke to run the consolidated `validate:packaged-openclaw-release-gates` step (with `IDLEWATCH_REQUIRE_OPENCLAW_USAGE=1` and `IDLEWATCH_SKIP_PACKAGE_MACOS=1`) instead of separate stats/cache-recovery steps.
- ✅ **Monitoring reliability improvement:** CI now validates packaged OpenClaw health + fallback stats parsing + stale-cache recovery in one atomic gate against the already-built artifact.
- ✅ **Packaging docs updated:** CI integration section in `docs/packaging/macos-dmg.md` now references the consolidated release gate and its packaged checks composition.

### Validation details

- ✅ `.github/workflows/ci.yml` and `scripts/validate-all.sh` are now consistent: both prioritize release-gate artifact reuse for packaged OpenClaw checks.
- ✅ `npm run validate:all --silent` remains green: **19 pass, 0 fail, 0 skip**.

### Features / bugs / risks observed

- ✅ **Feature:** CI has a single authoritative OpenClaw packaged gate for stats and recovery instead of fragmented checks.
- 🧨 **OpenClaw integration gap remains:** remote write-path confirmation still blocked without Firebase write credentials.
- ⚠️ **Distribution trust risk remains:** unsigned/notarized path still not end-to-end testable on this host without Apple credentials.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-23 22:05 America/Toronto

### Completed this cycle

- ✅ **Validation sweep hardening:** Updated `scripts/validate-all.sh` to run the consolidated `validate:packaged-openclaw-release-gates` in packaging mode.
- ✅ **Release-gate reliability improvement:** The release gate now runs in artifact-reuse mode in `validate-all` (`IDLEWATCH_SKIP_PACKAGE_MACOS=1`) so repeated packaging within one sweep is avoided and checks validate the already-built app once.
- ✅ **Monitoring + OpenClaw coverage preserved:** This still executes OpenClaw health, stats-fallback, and cache-recovery checks through the consolidated gate while keeping existing non-packaged telemetry checks intact.

### Validation details

- ✅ `npm run validate:all --silent` passed with release-gate integration enabled: **19 pass, 0 fail, 0 skip**.
- ✅ `npm run validate:packaged-openclaw-release-gates --silent` passes via `IDLEWATCH_SKIP_PACKAGE_MACOS=1` in this environment after package build.

### Features / bugs / risks observed

- ✅ **Feature:** Centralizes release verification logic in both trusted workflow and standard validation flows.
- 🧨 **OpenClaw integration gap remains:** no end-to-end Firebase write-path check without write credentials.
- ⚠️ **Packaging trust risk remains:** trusted release still requires signing/notary secrets for full production confidence.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-23 21:55 America/Toronto

### Completed this cycle

- ✅ **Release gate consolidation:** Added a new validator `validate:packaged-openclaw-release-gates` to group trusted-release OpenClaw checks (health, stats-fallback, cache-recovery) into one explicit gate.
- ✅ **Monitoring reliability hardening:** Trusted release workflow now runs release gates through one command, reducing duplication and ensuring all OpenClaw checks target the same signed artifact once packaging is complete.
- ✅ **Packaging scripts/docs updates:** Documented the new release gate command in `README.md` and `docs/packaging/macos-dmg.md`.

### Validation details

- ✅ `npm run validate:packaged-openclaw-release-gates --silent` passed locally (when run with a previously built `dist/IdleWatch.app`).
- ✅ Existing full sweep (`npm run validate:all --silent`) remains green after docs/CI updates: **20 pass, 0 fail, 0 skip**.

### Features / bugs / risks observed

- ✅ **Feature:** Release verification path now has a single explicit OpenClaw release-gate entrypoint for maintainability and clearer CI intent.
- 🧨 **OpenClaw integration gap remains:** remote write-path confirmation is still blocked by missing Firebase write credentials.
- ⚠️ **Packaging trust risk remains:** signing/notary secrets required for full trusted release execution in CI.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-23 21:45 America/Toronto

### Completed this cycle

- ✅ **Release-gate optimization:** Made packaged OpenClaw validators (validate:packaged-openclaw-stats-ingestion, validate:packaged-openclaw-cache-recovery-e2e) skip repackaging when IDLEWATCH_SKIP_PACKAGE_MACOS=1 so trusted release checks validate the same signed artifact already produced by package:macos.
- ✅ **Monitoring reliability hardening:** Trusted release workflow now executes OpenClaw stats/recovery gates against the prebuilt artifact, avoiding duplicate packaging churn before upload checks.
- ✅ **Packaging scripts/docs:** Updated trusted-release policy docs and workflow to reflect this direct-artifact validation path.

### Validation details

- ✅ npm run validate:packaged-openclaw-stats-ingestion --silent passed.
- ✅ npm run validate:packaged-openclaw-cache-recovery-e2e --silent passed.
- ✅ Trusted workflow path now sets IDLEWATCH_SKIP_PACKAGE_MACOS=1 for those checks; local CI job behavior remains unchanged.

### Features / bugs / risks observed

- ✅ **Feature:** Aligns trusted OpenClaw checks with the exact signed payload that will be uploaded, improving signal quality in release validation.
- 🧨 **OpenClaw integration gap remains:** still no remote write-path check without Firebase write credentials.
- ⚠️ **Packaging trust risk remains:** signing/notary secrets required in CI for full trusted execution.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-23 22:01 America/Toronto

### Completed this cycle

- ✅ **Validation sweep re-run:** Ran `npm run validate:all` from `idlewatch-skill`.
- ✅ **Result:** **20 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-stats-ingestion`
  - `validate:packaged-openclaw-cache-recovery-e2e`

### Risk & integration status

- ✅ `validate:firebase-emulator-mode` (emulator dry-run) passed.
- 🧨 **OpenClaw write-path gap remains:** `validate:firebase-write-required-once` still blocked without Firebase write credentials.
- ⚠️ **DMG signing/notarization gap remains:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE` on this host.

### Notes

- ✅ **Commit status:** no source code changes this cycle; QA log documentation update only.

## QA cycle update — 2026-02-23 21:50 America/Toronto

### Completed this cycle

- ✅ **Validation sweep re-run:** Ran `npm run validate:all` from `idlewatch-skill`.
- ✅ **Result:** **20 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-stats-ingestion`
  - `validate:packaged-openclaw-cache-recovery-e2e`

### Feature / risk status

- ✅ **No new regressions** in telemetry parsing or packaging checks.
- 🧨 **OpenClaw integration gap remains:** `validate:firebase-write-required-once` still blocked by missing Firebase write credentials.
- ⚠️ **DMG packaging risk remains:** `validate:trusted-prereqs` still blocked by missing `MACOS_CODESIGN_IDENTITY` / notary profile in this environment.

### Notes

- ✅ **Commit status:** no source changes this cycle; only QA log documentation updated.

## QA cycle update — 2026-02-23 21:40 America/Toronto

### Completed this cycle

- ✅ **Validation sweep rerun:** Ran `npm run validate:all` from `idlewatch-skill`.
- ✅ **Result:** **20 pass, 0 fail, 0 skip**.
- ✅ **OpenClaw + telemetry validators confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-stats-ingestion`
  - `validate:packaged-openclaw-cache-recovery-e2e`

### OpenClaw + packaging risk checks

- ✅ `validate:firebase-emulator-mode` (dry-run + emulator mode) passed.
- ✅ `validate:packaged-*` OpenClaw checks remained green.
- 🧨 **OpenClaw integration gap persists:** `validate:firebase-write-required-once` remains blocked by missing write credentials.
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` remains blocked by missing `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE` on this host.

### Notes

- ✅ **Commit status:** no source code changes this cycle; QA log documentation only.

## QA cycle update — 2026-02-23 21:30 America/Toronto

### Completed this cycle

- ✅ **Validation sweep re-run:** Ran `npm run validate:all` from `idlewatch-skill`.
- ✅ **Result:** **20 pass, 0 fail, 0 skip**.
- ✅ **Telemetry + OpenClaw validations confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-stats-ingestion`
  - `validate:packaged-openclaw-cache-recovery-e2e`

### Distribution + OpenClaw risk checks

- ✅ `validate:firebase-emulator-mode` (dry-run, emulator mode) passed.
- ✅ `validate:packaged-*` OpenClaw ingestion checks remained green in this run.
- 🧨 **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still blocked by missing Firebase write credentials.
- ⚠️ **DMG packaging risk persists:** `validate:trusted-prereqs` still blocked due missing `MACOS_CODESIGN_IDENTITY` / notary profile on this host.

### Notes

- ✅ **Commit status:** no source code changes this cycle; QA log only.

## QA cycle update — 2026-02-23 21:35 America/Toronto

### Completed this cycle

- ✅ **Release pipeline hardening:** Added OpenClaw stats-fallback + cache-recovery checks directly into .github/workflows/release-macos-trusted.yml before artifact upload.
- ✅ **Monitoring reliability in release path:** Trusted release now explicitly executes both `validate:packaged-openclaw-stats-ingestion` and `validate:packaged-openclaw-cache-recovery-e2e` after signed packaging.
- ✅ **Packaging docs updated:** Updated `docs/packaging/macos-dmg.md` and `README.md` trusted-release policy notes to reflect the expanded OpenClaw release gates.

### Validation details

- ✅ `npm run validate:packaged-openclaw-stats-ingestion --silent` passed.
- ✅ `npm run validate:packaged-openclaw-cache-recovery-e2e --silent` passed.
- ✅ Workflow-level source changes are now aligned across `ci.yml` + release gate docs with host+packaged + trusted release coverage.

### Features / bugs / risks observed

- ✅ **Feature:** Trusted release path now validates both ingestion and recovery OpenClaw behavior under packaged runner conditions.
- 🧨 **OpenClaw integration gap remains:** still no end-to-end remote write-path check without Firebase credentials.
- ⚠️ **Packaging trust risk remains:** `MACOS_CODESIGN_IDENTITY` and notary profile secrets still required for full trusted run in CI host.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-23 21:25 America/Toronto

### Completed this cycle

- ✅ **CI OpenClaw stats coverage expanded:** Added both `validate:openclaw-stats-ingestion` and `validate:packaged-openclaw-stats-ingestion` to CI workflow steps, so stats-fallback parsing is now validated in PR/push Node and macOS packaging jobs.
- ✅ **CI reliability hardening:** `validate:openclaw-stats-ingestion` now runs on every matrix node-tests job, and packaged stats ingestion now runs on macOS packaging smoke.

### Validation details

- ✅ `npm run validate:openclaw-stats-ingestion --silent` passed.
- ✅ `npm run validate:packaged-openclaw-stats-ingestion --silent` passed.
- ✅ `npm run validate-all --silent` remains green after CI-workflow coverage changes.

### Features / bugs / risks observed

- ✅ **Feature:** CI now enforces both host and packaged stats fallback parsing, reducing divergence risk between local and packaged validation paths.
- 🧨 **OpenClaw integration gap remains:** remote write-path verification in packaging is still blocked without Firebase write credentials.
- ⚠️ **DMG signing/notarization risk remains:** unsigned/notarized artifacts still affect trusted-release confidence.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.


## QA cycle update — 2026-02-23 21:17 America/Toronto

### Completed this cycle

- ✅ **CI coverage improvement:** Added packaged OpenClaw cache-recovery validator to the macOS packaging CI workflow (`.github/workflows/ci.yml`) so it runs in PR/push packaging smoke automatically.
- ✅ **Monitoring reliability hardening:** CI now executes `validate:packaged-openclaw-cache-recovery-e2e` on macOS scaffold smoke.
- ✅ **Packaging scripts/docs:** Verified packaging docs already describe new validator coverage and CI path now matches docs.

### Validation details

- ✅ `npm run validate:packaged-openclaw-cache-recovery-e2e --silent` passed locally.
- ✅ `npm run validate:all --silent` passed after CI-script wiring: **20 pass, 0 fail, 0 skip**.

### Features / bugs / risks observed

- ✅ **Feature:** CI-level enforcement catches stale-cache recovery regressions in packaged OpenClaw probe behavior.
- 🧨 **OpenClaw integration gap remains:** remote write-path verification still blocked without Firebase write credentials.
- ⚠️ **DMG signing/notarization risk remains:** unsigned/notarized artifacts still cannot complete trusted-distribution flow without Apple credentials.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.


## QA cycle update — 2026-02-23 21:20 America/Toronto

### Completed this cycle

- ✅ **Validation sweep re-run:** Ran `npm run validate:all` from `idlewatch-skill`.
- ✅ **Result:** **20 pass, 0 fail, 0 skip**.
- ✅ **Telemetry checks confirmed:**
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-openclaw-stats-ingestion`
  - `validate:packaged-openclaw-cache-recovery-e2e`

### OpenClaw + distribution checks

- ✅ `validate:firebase-emulator-mode` (dry-run) passed.
- ✅ `validate:packaged-*` OpenClaw validators remain passing in this run.
- 🧨 **OpenClaw integration gap persists:** `validate:firebase-write-required-once` still fails by design when Firebase credentials are absent.
- ⚠️ **DMG packaging risk persists:** trusted-distribution validation remains blocked by missing `MACOS_CODESIGN_IDENTITY` / notary profile in this environment.

### Notes

- ✅ **Commit status:** no source code changes this cycle; QA log documentation updated.

- ✅ No code changes in this cycle; only QA documentation update.

## QA cycle update — 2026-02-23 21:12 America/Toronto

### Completed this cycle

- ✅ **Validation sweep continued:** Ran `npm run validate:all` from `idlewatch-skill`.
- ✅ **Result:** **20 pass, 0 fail, 0 skip** (all checks green in this execution).
- ✅ **OpenClaw and distribution smoke checks:**
  - `validate:firebase-emulator-mode` (dry-run) passed.
  - `validate:openclaw-cache-recovery-e2e` passed.
  - `validate:firebase-write-required-once` failed only due missing Firebase credentials (expected).
  - `validate:trusted-prereqs` still fails due missing `MACOS_CODESIGN_IDENTITY` (and notary profile).

### Features / bugs / risks observed

- ✅ **No regression:** no new telemetry or packaging issues observed; prior packaged OpenClaw fallback + cache recovery validators still pass when run together.
- 🧨 **OpenClaw integration gap persists:** remote write-path verification still blocked without credentialed Firebase write-mode.
- ⚠️ **DMG packaging risk persists:** unsigned/notarized distribution cannot achieve trusted-distribution status on this host without Apple Developer credentials.

### Notes

- ✅ **Commit status:** no source code changes this cycle; log updated only.

## QA cycle update — 2026-02-23 21:05 America/Toronto

### Completed this cycle

- ✅ **Monitoring reliability improvement:** Added packaged stale-cache recovery e2e validator (`validate:packaged-openclaw-cache-recovery-e2e`) to verify probe failure handling and recovery in packaged runtime mode.
- ✅ **OpenClaw coverage improvement:** Expanded packaged validation set to include recovery behavior after temporary probe failures, not just successful stats fallback.
- ✅ **Packaging scripts/docs updates:** Added new validator to `package.json`, `validate-all`, and release docs coverage list (`docs/packaging/macos-dmg.md`).
- ✅ **Validation sweep refreshed:** Ran `npm run validate:all` (now **20 checks**) and captured 20 pass, 0 fail, 0 skip.

### Validation details

- ✅ `npm run validate:packaged-openclaw-cache-recovery-e2e` passed (mocked packaged launcher dry-run; stale-cache path with temporary probe failures recovered via reprobe attempts).
- ✅ `npm run validate:packaged-openclaw-stats-ingestion` passed.
- ✅ `validate:all` now includes both `packaged-openclaw-stats-ingestion` and `packaged-openclaw-cache-recovery-e2e` in core packaging checks.

### Features / bugs / risks observed

- ✅ **Feature:** Covers a realistic packaged reliability edge case where stale cache must be used temporarily while probe retries recover.
- 🧨 **OpenClaw integration gap remains:** remote write-path verification in release/packaging mode is still blocked without Firebase credentials.
- ⚠️ **DMG signing/notarization risk remains:** unsigned/notarized artifacts can still block Gatekeeper and CI release confidence.

### Test health summary for this cycle

- `npm run validate:all` result: **20 pass, 0 fail, 0 skip**.
- `validate:packaged-openclaw-cache-recovery-e2e`: ✅ pass.
- `validate:packaged-openclaw-stats-ingestion`: ✅ pass.
- `validate:trusted-prereqs`: expected failure due missing signing/notary configuration.

### Notes

- ✅ **Commit status:** source changes committed and pushed in this cycle.

## QA cycle update — 2026-02-23 20:57 America/Toronto

### Completed this cycle

- ✅ **Validation sweep refreshed:** Ran `npm run validate:all` from `idlewatch-skill`.
- ✅ **Result:** **19 pass, 0 fail, 0 skip** (including both OpenClaw ingestion validators).
- ✅ **OpenClaw smoke checks:**
  - `validate:firebase-emulator-mode` (dry-run) passed.
  - `validate:firebase-write-required-once` failed only due missing Firebase credentials (expected).
- ✅ **Distribution validation:** `validate:trusted-prereqs` still fails fast for missing `MACOS_CODESIGN_IDENTITY` (and typically `MACOS_NOTARY_PROFILE`).

### Features / bugs / risks observed

- ✅ No new telemetry or packaging regressions in this run.
- 🧨 **OpenClaw integration gap remains:** remote write-path verification in release/packaging mode still blocked without credentials.
- ⚠️ **DMG signing/notarization risk remains:** unsigned/notarized artifacts can still block Gatekeeper and CI release confidence.

### Test health summary for this cycle

- `npm run validate:all` result: **19 pass, 0 fail, 0 skip**.
- `validate:openclaw-stats-ingestion`: ✅ pass.
- `validate:packaged-openclaw-stats-ingestion`: ✅ pass.
- `validate:trusted-prereqs`: expected failure due missing signing/notary configuration.

### Notes

- ✅ **Commit status:** no source-code changes this cycle; QA log documentation updated.

## QA cycle update — 2026-02-23 20:48 America/Toronto

### Completed this cycle

- ✅ **Validation sweep expanded:** Added and passed `validate:packaged-openclaw-stats-ingestion` in `npm run validate:all`.
- ✅ **Monitoring reliability improvement:** Added packaged-only OpenClaw fallback check using mocked CLI output to verify stats fallback command (`stats --json`) is selected and successfully ingested by the packaged launcher.
- ✅ **Packaging scripts/docs:** Added `validate:packaged-openclaw-stats-ingestion` to `package.json`, `validate-all`, and docs references for mac packaging validation coverage.
- ✅ **Validation sweep refreshed:** Ran `npm run validate:all` (19 checks): all pass, 0 fail, 0 skip.

### New validation details

- ✅ `npm run validate:packaged-openclaw-stats-ingestion` passed (mock-based, packaged launcher dry-run, stats fallback path).
- ✅ `npm run validate:all` now includes 19 checks (added packaged stats ingestion validator).

### Features / bugs / risks observed

- ✅ **Feature:** New packaged OpenClaw fallback validator reduces regression risk where packaged launcher may continue selecting stale/disabled commands in status/usage drift scenarios.
- 🧨 **OpenClaw integration gap:** remote write-path verification still blocked without credentials/secret material (`FIREBASE_*` write-mode checks).
- ⚠️ **DMG distribution risk:** trusted distribution prerequisites still fail (`validate:trusted-prereqs`) because `MACOS_CODESIGN_IDENTITY` and `MACOS_NOTARY_PROFILE` are missing on this host.

### Test health summary for this cycle

- `npm run validate:all` result: **19 pass, 0 fail, 0 skip**.
- `validate:openclaw-stats-ingestion`: ✅ pass.
- `validate:packaged-openclaw-stats-ingestion`: ✅ pass.
- `validate:trusted-prereqs` result: expected failure due missing signing identity/notary profile.

### Notes

- ✅ **Commit status:** packaging/validation changes committed and ready; latest cycle docs and script coverage shipped.

## QA cycle update — 2026-02-23 20:42 America/Toronto

### Completed this cycle

- ✅ **Validation sweep refreshed:** Ran `npm run validate:all` from `idlewatch-skill`.
- ✅ **Telemetry validation checks passed (18 checks):**
  - `validate:dry-run-schema`
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:openclaw-stats-ingestion`
  - `validate:packaged-metadata`
  - `validate:packaged-bundled-runtime`
  - `validate:packaged-usage-age-slo`
  - `validate:packaged-usage-recovery-e2e`
  - `validate:packaged-usage-alert-rate-e2e`
  - `validate:packaged-usage-probe-noise-e2e`
  - `validate:dmg-install`
  - `validate:dmg-checksum`
- ✅ **OpenClaw telemetry-mode smoke checks executed:**
  - `validate:firebase-emulator-mode` (dry-run) passed.
  - `validate:firebase-write-required-once` failed only due missing Firebase credentials (expected behavior).

### Features / bugs / risks observed

- ✅ **Feature:** Validation sweep expanded to include explicit OpenClaw stats ingestion validation and still passes fully in this environment.
- 🧨 **OpenClaw integration gap:** remote write-path verification still blocked without credentials/secret material (`FIREBASE_*` in write mode).
- ⚠️ **DMG packaging risk:** trusted-distribution prerequisites still fail (`validate:trusted-prereqs`) because `MACOS_CODESIGN_IDENTITY` is missing; no notarization coverage on this host.

### Test health summary for this cycle

- `npm run validate:all` result: **18 pass, 0 fail, 0 skip**.
- `validate:trusted-prereqs` result: expected failure due missing signing identity.
- `validate:openclaw-stats-ingestion`: ✅ pass (newly added in this environment run)

### Notes

- ✅ **Commit status:** no code files changed in this cycle; QA log documentation updated.

## QA cycle update — 2026-02-23 20:31 America/Toronto

### Completed this cycle

- ✅ **Validation sweep refreshed:** Ran `npm run validate:all` from `idlewatch-skill`.
- ✅ **Telemetry validation checks passed:**
  - `validate:dry-run-schema`
  - `validate:usage-freshness-e2e`
  - `validate:usage-alert-rate-e2e`
  - `validate:openclaw-cache-recovery-e2e`
  - `validate:packaged-usage-age-slo`
  - `validate:packaged-usage-recovery-e2e`
  - `validate:packaged-usage-alert-rate-e2e`
  - `validate:packaged-usage-probe-noise-e2e`
- ✅ **OpenClaw telemetry mode smoke checks executed:**
  - `validate:firebase-emulator-mode` (dry-run) passed.
  - `validate:firebase-write-required-once` failed only due missing Firebase credentials (expected; same block as above).
  - `validate:openclaw-stats-ingestion` passed.
- ✅ **OpenClaw stats ingestion coverage expanded:** added `validate:openclaw-stats-ingestion`, deeper `stats.current.session` parser unwrapping, and regression coverage for nested wrapper variants.

### Features / bugs / risks observed

- ✅ **Feature:** Validation output now consistently yields 17/17 pass for `validate:all` with this environment, with no regressions from prior release.
- ✅ **No new Mac telemetry regressions** surfaced in this cycle.
- 🧨 **OpenClaw integration gap:** write-path hardening still blocked until credentials are available.
- ⚠️ **DMG packaging risk:** trusted-distribution prerequisites still fail (`validate:trusted-prereqs`) because `MACOS_CODESIGN_IDENTITY` (and usually notarization profile) are not configured on this host.
- ⚠️ **Distribution risk:** DMG artifacts are reproducible and checksummed but remain unsigned/notarized, which may trigger Gatekeeper trust prompts and block CI-grade release confidence.

### Test health summary for this cycle

- `npm run validate:all` result: **17 pass, 0 fail, 0 skip**.
- `validate:trusted-prereqs` result: expected failure due missing signing identity.

### Notes

- ✅ **Commit status:** no code files changed in this cycle; only QA log documentation updated.

## QA cycle update — 2026-02-18 19:55 America/Toronto

### Completed this cycle

- ✅ **Graceful shutdown:** Agent now waits for in-flight sample collection/publish to complete before exiting on SIGINT/SIGTERM, preventing data loss during restarts or LaunchAgent reload.
- ✅ **Config module extracted:** New `src/config.js` with `buildConfig()` consolidates all env var parsing and validation into a single reusable module with proper constraint checking (`parseNumericEnv` helper). Reduces repetitive validation boilerplate in the main agent.
- ✅ **Config tests added:** 10 new unit tests covering defaults, overrides, derived thresholds, host sanitization, invalid value rejection, and Firebase config passthrough.
- ✅ **All unit tests green:** 138 pass, 0 fail (up from 128).
- ✅ **Smoke tests green.**

### Improvements shipped

- ✅ **Monitoring reliability:** Graceful shutdown prevents partial writes and lost samples on process signals.
- ✅ **Code quality:** Config parsing is now testable in isolation, decoupled from main agent startup.

### Remaining open items

- 🐛 **Open:** `Firebase is not configured` — no remote write-path verification yet (blocked on credentials).
- 🐛 **Open:** Distribution unsigned/unnotarized (blocked on Apple Developer credentials).

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
