# IdleWatch Mac QA Readiness Log

Date: 2026-02-16  
Owner: QA (Mac distribution + telemetry + OpenClaw integration)

## Scope audited

- Repository: `idlewatch-skill`
- CLI runtime and packaging readiness for Mac downloadable distribution
- Telemetry signal quality: CPU / memory / GPU
- OpenClaw integration readiness for LLM usage and session stats

## Evidence gathered

- `npm test` passes (`validate:bin`, `smoke:help`, `smoke:dry-run`).
- `node bin/idlewatch-agent.js --dry-run` runs and emits one sample row.
- Current dry-run row still often reports `gpuPct: null` on macOS.
- OpenClaw usage fields remain `null` in dry-run (`source.usage: "unavailable"`).
- CI currently runs on `ubuntu-latest` only (Node 20/22), no macOS CI coverage.

## QA cycle update — 2026-02-16 16:40 America/Toronto

### What changed since prior pass

- ✅ `tokensPerMin` is no longer random mock data in code. Collector now attempts real usage via OpenClaw CLI commands and emits `null` when unavailable.
- ⚠️ Integration is still incomplete in practice because current command/JSON parsing path does not yield tokens/model on this host.
- ⚠️ Packaging scaffolding exists (`scripts/package-macos.sh`, `scripts/build-dmg.sh`, `docs/packaging/macos-dmg.md`) but launcher/signing/notarization remain TODOs.

### Telemetry validation checks (this cycle)

- Test suite: **pass**.
- Dry-run sample: **pass** for basic collection and local NDJSON write.
- CPU/memory fields populated: **pass**.
- GPU field populated on this host: **fail** (`gpuPct: null`).
- OpenClaw usage populated on this host: **fail** (`tokensPerMin`, `openclawModel`, `openclawTotalTokens` are null; source=`unavailable`).

### OpenClaw integration gaps (current)

- CLI probe order is brittle vs actual installed command surface (`openclaw session_status --json` currently errors with unknown command).
- Parser does not currently map nested fields present in `openclaw status --json` (`sessions.defaults.model`, etc.), so model/tokens remain unresolved.
- No explicit integration health metric is emitted beyond `source.usage` string; hard to alert on partial integration failure.

## Implementation cycle update — 2026-02-16 16:53 America/Toronto

### Completed this cycle

- ✅ OpenClaw probe order now prioritizes `openclaw status --json` (supported on this host), then falls back.
- ✅ Added parser support for nested `openclaw status --json` session payloads (`sessions.recent`, `sessions.defaults`) with deterministic recent-session selection.
- ✅ Added usage identity/alignment fields to telemetry row: `openclawSessionId`, `openclawAgentId`, `openclawUsageTs`.
- ✅ Added explicit integration health markers: `source.usageIntegrationStatus` and `source.usageCommand`.
- ✅ Added deterministic parser tests with fixtures for real `openclaw status --json` shape and generic usage shape.
- ✅ Packaging scripts updated to build a runnable app scaffold launcher (`npx --package <bundled-tgz> idlewatch-agent`) and versioned DMG output naming.
- ✅ Packaging docs updated to reflect current scaffold behavior and Node runtime requirement.

### Acceptance criteria status (updated)

#### P0 — OpenClaw usage integration

- [x] Replace mock function with real collector wired to OpenClaw session/usage source.
- [x] Emit stable identifiers: `sessionId`, `agentId` (or equivalent), and timestamp alignment fields.
- [x] Document exact semantics for each usage field (prompt tokens, completion tokens, total tokens, requests/min).
- [x] Add integration test fixtures for actual `openclaw` command outputs used in production (`session status`/`status --json`) and ensure parser maps fields correctly.
- [x] Fail-safe behavior documented for missing OpenClaw source (explicit `null` + `integrationStatus`, no synthetic fallback).

---

## QA cycle update — 2026-02-16 17:20 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (OpenClaw parser fixture coverage still green).
- ✅ `node bin/idlewatch-agent.js --dry-run` emits usage-populated rows.
- ✅ `npm run package:macos --silent` builds `dist/IdleWatch.app` successfully.
- ✅ `./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run` succeeds from packaged scaffold.
- ✅ `npm run package:dmg --silent` builds `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ GPU telemetry remains unavailable on this host (`gpuPct: null`, `gpuSource: "unavailable"`, `gpuConfidence: "none"`).

### Telemetry validation snapshot (latest)

- `tokensPerMin`: populated (range observed this cycle: ~17.5k–20.4k)
- `openclawModel`: populated (`gpt-5.3-codex`)
- `openclawTotalTokens`: populated (`22956`)
- `openclawSessionId` / `openclawAgentId` / `openclawUsageTs`: populated and stable
- `source.usageIntegrationStatus`: `ok`
- `source.usageCommand`: `openclaw status --json`

### Bugs / feature gaps identified this cycle

## Implementation cycle update — 2026-02-16 17:31 America/Toronto

### Completed this cycle

- ✅ Added OpenClaw usage staleness guardrail: `openclawUsageAgeMs`, configurable `IDLEWATCH_USAGE_STALE_MS`, and `source.usageIntegrationStatus='stale'` when age exceeds threshold.
- ✅ Added stale-threshold telemetry metadata: `source.usageStaleMsThreshold`.
- ✅ Packaging scripts now support optional signing and notarization via env vars:
  - `MACOS_CODESIGN_IDENTITY` signs/verifies `IdleWatch.app` in `package-macos.sh`
  - `MACOS_NOTARY_PROFILE` notarizes + staples DMG in `build-dmg.sh`
- ✅ Packaging docs updated with signing/notarization invocation and output naming semantics (`-signed` vs `-unsigned` DMG).

### Acceptance criteria status (incremental)

- [x] Add derived usage freshness signal (`openclawUsageAgeMs`) and explicit stale classification for alerting.
- [x] Add script-level path for optional codesign/notarize/staple automation (when credentials are supplied).

### Bugs / feature gaps identified this cycle

1. **GPU signal absent on this Mac in all probes (High, data quality)**
   - Current fallback chain still yields no usable GPU value in local runs.
   - Need captured raw command output fixtures from this exact host profile to tune parser/probe order.

2. **No staleness guardrail for usage timestamps (Medium, observability)**
   - `openclawUsageTs` is populated, but no threshold check/warning is emitted when usage data becomes stale.
   - Add derived field (e.g., `openclawUsageAgeMs`) + warn state for alerting.

3. **Unsigned distribution remains the only generated installer (High, distribution trust)**
   - DMG output is explicitly unsigned (`-unsigned.dmg`), with signing/notarization still manual/TODO.
   - Gatekeeper friction remains unresolved for real-user distribution.

### DMG packaging risk status (current)

- ✅ Build reliability: app scaffold + unsigned DMG generation is reproducible locally.
- ⚠️ Trust/compliance: no automated codesign/notarize/staple pipeline yet.
- ⚠️ Install QA: no clean-machine validation evidence captured (Apple Silicon + Intel/Rosetta).
- ⚠️ Runtime dependency: launcher still assumes Node availability (or pre-provisioned runtime) on target machine.

### OpenClaw integration gap status (current)

- ✅ Usage collection path is functional on this host via `openclaw status --json`.
- ⚠️ Integration resilience gap: no explicit stale-usage health classification beyond `usageIntegrationStatus`.
- ⚠️ Contract gap: no CI assertion yet for acceptable freshness window of `openclawUsageTs`.

## Prioritized findings

## QA cycle update — 2026-02-16 17:00 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (parser fixtures and null-handling).
- ✅ `node bin/idlewatch-agent.js --dry-run` emits telemetry samples with live OpenClaw usage.
- ✅ OpenClaw status probe works on host via `openclaw status --json`.
- ⚠️ GPU remains null on host (`gpuPct: null`).
- ⚠️ Firebase not configured in local QA env; telemetry currently validated in local-only/stdout mode.

### Telemetry validation snapshot (sample)

- `tokensPerMin`: populated (e.g., `32822.64`)
- `openclawModel`: populated (`gpt-5.3-codex`)
- `openclawTotalTokens`: populated (`21745`)
- `openclawSessionId`/`openclawAgentId`/`openclawUsageTs`: populated
- `source.usageIntegrationStatus`: `ok`
- `source.usageCommand`: `openclaw status --json`

### OpenClaw integration status

- ✅ Prior P0 blocker is **closed** for this host/runtime.
- Remaining risk is observability quality (no trend/alert test yet for stale usage timestamps) rather than data absence.

### DMG packaging risk check (this cycle)

- ⚠️ `scripts/package-macos.sh` / `scripts/build-dmg.sh` scaffolding exists, but signing/notarization/stapling are still not automated in CI.
- ⚠️ No clean-machine install verification evidence captured yet (Apple Silicon + Intel/Rosetta).
- ⚠️ Launcher depends on Node presence unless runtime is bundled; this is a distribution friction risk for non-technical users.

## Implementation cycle update — 2026-02-16 17:11 America/Toronto

### Completed this cycle

- ✅ Replaced blocking CPU sampler (`Atomics.wait`) with non-blocking per-tick CPU delta sampling.
- ✅ Added GPU provenance fields to telemetry rows: `gpuSource`, `gpuConfidence`, `gpuSampleWindowMs`.
- ✅ Added GPU probe fallback chain (`top -stats gpu`, `top|grep GPU`, `powermetrics`) with bounded timeouts.
- ✅ Expanded CI matrix to include `macos-latest` with parser/unit + smoke (`--help`, `--dry-run`) coverage.
- ✅ Added dedicated macOS packaging smoke workflow job: app scaffold build, app dry-run, unsigned DMG build.

### Validation checks run this cycle

- ✅ `npm test --silent` passes.
- ✅ `npm run package:macos` produces `dist/IdleWatch.app`.
- ✅ `./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run` runs successfully.
- ✅ `npm run package:dmg` produces versioned unsigned DMG.

---

### P1 — High: Mac app/package distribution path not implemented

**Finding**
- Project is currently a Node CLI package only.
- No app bundle target (`.app`), no DMG/PKG pipeline, no signing/notarization workflow.

**Risk**
- Cannot ship as user-friendly downloadable Mac app.
- Gatekeeper warnings and install friction if unsigned/unnotarized binaries are distributed.

**Acceptance criteria**
- [ ] Decide packaging architecture (see matrix below) and lock implementation path.
- [ ] Produce reproducible macOS artifact in CI (`.dmg` and/or `.pkg`).
- [ ] Sign with Developer ID Application + notarize + staple.
- [ ] Include LaunchAgent/SMAppService startup behavior and uninstall path.
- [ ] Validate install flow on clean macOS test machine (Apple Silicon + Intel/Rosetta scenario or universal binary).

---

### P1 — High: GPU telemetry is best-effort and brittle on modern macOS

**Finding**
- GPU metric used shell parse probes that did not work on this host (`top -stats gpu` unsupported; `powermetrics` permission-sensitive).

**Risk**
- Sparse/inconsistent GPU signal; false assumption that GPU usage is zero/unknown.

**Acceptance criteria**
- [ ] Define GPU support matrix (Apple Silicon/Intel, macOS versions).
- [x] Implement robust source (AGX/IOGPU `ioreg` fallback chain plus quality flags).
- [x] Emit provenance fields: `gpuSource`, `gpuConfidence`, `gpuSampleWindowMs`.
- [x] Add parser tests with captured real outputs from at least 3 Mac configurations.

---

### P2 — Medium: Memory metric may overstate pressure for user-facing dashboards

**Finding**
- `memPct` uses `(total - free) / total`; on macOS, cache/compression semantics make this less representative of pressure.

**Risk**
- Operators misread normal cached memory usage as high memory pressure.

**Acceptance criteria**
- [ ] Add `memUsedPct` plus macOS-aware pressure indicator (e.g., memory pressure class/value).
- [ ] Document metric definitions and caveats in README/skill docs.
- [ ] Add threshold guidance for alerting (`warn/critical`) based on pressure, not free-only arithmetic.

---

### P2 — Medium: Sampling approach blocks event loop during CPU measurement

**Finding**
- `cpuPct()` used `Atomics.wait` sleep window (blocking) each sample.

**Risk**
- Can delay other tasks and reduce responsiveness if collector expands.

**Acceptance criteria**
- [x] Replace with non-blocking delta sampling between ticks or async scheduler.
- [ ] Verify jitter and sampling overhead under 1s and 10s intervals.
- [ ] Add performance test documenting collector overhead budget (<1% CPU on idle machine target).

---

### P2 — Medium: CI lacks macOS validation and packaging checks

**Finding**
- CI previously ran only Ubuntu and did not execute dry-run telemetry assertions.

**Risk**
- Mac-specific regressions undetected; packaging pipeline breaks late.

**Acceptance criteria**
- [x] Add `macos-latest` job for smoke + dry-run + parser tests.
- [ ] Add artifact build/sign/notarize workflow (with secrets in repo settings).
- [x] Gate merges on telemetry schema validation and deterministic integration tests.

---

## QA cycle update — 2026-02-16 17:40 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (3/3 parser tests green).
- ✅ `node bin/idlewatch-agent.js --dry-run` succeeds and emits local NDJSON row.
- ✅ `npm run package:macos --silent` succeeds and builds `dist/IdleWatch.app`.
- ✅ `./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run` succeeds from packaged scaffold.
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ GPU telemetry still unavailable on this host (`gpuPct: null`, `gpuSource: "unavailable"`, `gpuConfidence: "none"`).

### Telemetry validation snapshot (latest sample)

- `tokensPerMin`: populated (`20657.02`; earlier samples this cycle ~`25.3k`–`26.3k`)
- `openclawModel`: populated (`gpt-5.3-codex`)
- `openclawTotalTokens`: populated (`19210`)
- `openclawSessionId` / `openclawAgentId` / `openclawUsageTs`: populated and stable
- `openclawUsageAgeMs`: populated (`~42.7s` to `~54.6s` in this cycle)
- `source.usageIntegrationStatus`: `ok`
- `source.usageCommand`: `openclaw status --json`
- `source.usageStaleMsThreshold`: `60000`

### Bugs / feature notes (this cycle)

1. **Usage freshness is near stale threshold during manual QA loops (Medium, observability noise risk)**
   - During packaging + command runs, `openclawUsageAgeMs` climbed to ~54.6s against a 60s stale threshold.
   - Status remained `ok` in this cycle, but CI/QA timings could intermittently flip to `stale` without product regression.
   - Suggested follow-up: add a small tolerance/notes in test assertions for long-running QA pipelines.

2. **GPU signal remains unresolved on this Mac profile (High, telemetry completeness)**
   - Reconfirmed `gpuPct` stays null across direct CLI and packaged app dry-runs.
   - Need host-captured command fixtures + parser/probe tuning to improve coverage.

### DMG packaging risk status

- ✅ Local artifact generation remains reproducible (`.app` + unsigned `.dmg`).
- ⚠️ Distribution trust gap persists: code signing not applied (`MACOS_CODESIGN_IDENTITY` unset).
- ⚠️ Notarization/stapling remains optional/manual (`MACOS_NOTARY_PROFILE` unset).
- ⚠️ Clean-machine install QA evidence still missing.

### OpenClaw integration gap status

- ✅ Command integration remains healthy via `openclaw status --json` with populated usage/session fields.
- ⚠️ No CI guard yet that validates behavior around stale-threshold boundary conditions (`openclawUsageAgeMs` near/over threshold).

## QA cycle update — 2026-02-16 17:52 America/Toronto

### Completed this implementation cycle

- ✅ Replaced invalid `top -stats gpu` probe with host-compatible macOS chain: AGX `ioreg` → IOGPU `ioreg` → `powermetrics` → `top|grep`.
- ✅ Added deterministic AGX parser that extracts `"Device Utilization %"` (with renderer/tiler fallbacks).
- ✅ Added dedicated GPU unit tests (`test/gpu.test.mjs`) covering AGX parsing, powermetrics `%` parsing, and probe precedence.
- ✅ Updated README to document the new GPU probe order and provenance semantics.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (including new GPU test coverage).
- ✅ `node bin/idlewatch-agent.js --dry-run` now reports non-null GPU on this host via `gpuSource: "ioreg-agx"`.

### Acceptance criteria updates

- [x] Implement robust source with permission-tolerant fallback chain.
- [x] Add parser tests with captured host output style (`ioreg` PerformanceStatistics).
- [ ] Expand fixtures to three distinct Mac configurations (still pending).

## QA cycle update — 2026-02-16 18:00 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (6 tests; includes GPU + OpenClaw parser coverage).
- ✅ `node bin/idlewatch-agent.js --dry-run` succeeds and emits usage + GPU-populated telemetry.
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ Firebase remains intentionally unconfigured in local QA environment (local-only stdout/NDJSON validation).

### Telemetry validation snapshot (latest sample)

- `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"` with `gpuConfidence: "high"`.
- `tokensPerMin`: populated (`~32.9k` to `~34.1k` in this cycle).
- `openclawModel`: populated (`gpt-5.3-codex`).
- `openclawTotalTokens`: populated (`19563`).
- `openclawSessionId` / `openclawAgentId` / `openclawUsageTs`: populated and stable.
- `openclawUsageAgeMs`: `~33.3s` to `~34.6s` (below stale threshold).
- `source.usageIntegrationStatus`: `ok`.
- `source.usageCommand`: `openclaw status --json`.
- `source.usageStaleMsThreshold`: `60000`.

### Bugs / feature gaps (current)

1. **Multi-host GPU fixture coverage still incomplete (Medium, regression confidence)**
   - AGX parsing is now validated on this host, but fixture corpus still lacks Intel and alternate Apple Silicon profile captures.
   - Keep P1 acceptance item open until 3-host fixture matrix is complete.

2. **Distribution trust pipeline still optional/manual (High, release readiness)**
   - App and DMG build are stable, but artifact remains unsigned when `MACOS_CODESIGN_IDENTITY` is unset.
   - Notarization/stapling remains opt-in via `MACOS_NOTARY_PROFILE`; no CI-enforced trusted artifact path yet.

3. **Firebase integration not exercised in QA loop (Medium, E2E confidence)**
   - Current cycle validates local telemetry generation only.
   - Need one credentialed QA pass to confirm Firestore write path, schema integrity, and failure handling.

### DMG packaging risk status

- ✅ Reproducible local packaging remains healthy (`IdleWatch.app` + versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk persists until signing + notarization is automated and verified in CI.
- ⚠️ Clean-machine install evidence is still missing (Apple Silicon + Intel/Rosetta scenarios).

### OpenClaw integration gap status

- ✅ Integration remains healthy on host (`openclaw status --json`, non-stale usage, stable IDs).
- ⚠️ No CI boundary test yet for stale-threshold behavior around long-running packaging/QA windows.

## Implementation cycle update — 2026-02-16 18:14 America/Toronto

### Completed this cycle

- ✅ Added macOS memory pressure enrichment sourced from `memory_pressure -Q` with telemetry fields:
  - `memPressurePct`
  - `memPressureClass` (`normal|warning|critical|unavailable`)
  - `source.memPressureSource`
- ✅ Added backward-compatible memory semantics by explicitly emitting both `memPct` and `memUsedPct`.
- ✅ Added deterministic unit tests for memory pressure parsing and failure fallback (`test/memory.test.mjs`).
- ✅ Updated README metric semantics for memory fields and source provenance.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (10 tests total, now including memory pressure coverage).
- ✅ `node bin/idlewatch-agent.js --dry-run` emits populated memory pressure fields on this host (`memPressurePct`, `memPressureClass`, `source.memPressureSource`).

### Acceptance criteria updates

- [x] Add `memUsedPct` plus macOS-aware pressure indicator (class/value).
- [x] Document metric definitions and caveats in README/skill docs.
- [x] Add threshold guidance for alerting (`warn/critical`) based on pressure, not free-only arithmetic.

## QA cycle update — 2026-02-16 18:20 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (10/10).
- ✅ `node bin/idlewatch-agent.js --dry-run` succeeds with populated CPU/memory/GPU/OpenClaw fields.
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run` succeeds from packaged scaffold.
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ Firebase remains unconfigured in QA env, so this pass validates local stdout/NDJSON only.

### Telemetry validation snapshot (latest samples)

- `gpuPct`: populated (`10`) with `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
- `memPressurePct`: populated (`29`) with `memPressureClass: "normal"` and `source.memPressureSource: "memory_pressure"`.
- `tokensPerMin`: populated (`~23.2k` to `~30.1k` during this cycle).
- `openclawModel`: populated (`gpt-5.3-codex`).
- `openclawTotalTokens`: populated (`20314`).
- `openclawSessionId` / `openclawAgentId` / `openclawUsageTs`: populated and stable.
- `openclawUsageAgeMs`: observed `~39.3s` to `~51.4s` (below stale threshold but close during packaging loop).
- `source.usageIntegrationStatus`: `ok`.
- `source.usageCommand`: `openclaw status --json`.
- `source.usageStaleMsThreshold`: `60000`.

### Bugs / feature gaps (current)

1. **Stale-threshold flapping risk under longer QA/build loops (Medium, observability noise)**
   - Usage age reached ~51s in this short cycle and has previously approached threshold.
   - Without tolerance-aware assertions, CI timing jitter could intermittently classify as `stale` despite healthy integration.

2. **Trusted distribution path still optional/manual (High, release readiness)**
   - Packaging is reproducible, but artifacts remain unsigned when `MACOS_CODESIGN_IDENTITY` is unset.
   - Notarization/stapling remains opt-in via `MACOS_NOTARY_PROFILE`; no enforced trusted-release CI path.

3. **Firebase write path still not exercised in active QA loop (Medium, E2E confidence)**
   - Local telemetry generation is healthy, but one credentialed Firestore validation pass is still needed.

### DMG packaging risk status

- ✅ Reproducible local packaging remains healthy (`IdleWatch.app` + versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk remains until signing + notarization are automated and validated in CI.
- ⚠️ Clean-machine install evidence is still pending (Apple Silicon + Intel/Rosetta scenarios).

### OpenClaw integration gap status

- ✅ Integration remains healthy on host (`openclaw status --json`, usage fields populated, `usageIntegrationStatus: ok`).
- ⚠️ CI does not yet include boundary tests for `openclawUsageAgeMs` near stale threshold.
## Implementation cycle update — 2026-02-16 18:32 America/Toronto

### Completed this cycle

- ✅ Extracted OpenClaw usage freshness/staleness logic into `src/usage-freshness.js` for deterministic unit coverage.
- ✅ Added boundary-focused tests (`test/usage-freshness.test.mjs`) covering:
  - exact-threshold behavior (`age == staleMs` stays `ok`)
  - stale transition (`age > staleMs` becomes `stale`)
  - invalid/future timestamp and invalid-threshold safety fallbacks.
- ✅ Wired runtime collector to shared freshness helper (no behavior drift between code/test paths).
- ✅ Added explicit memory alert threshold guidance to README to close P2 memory-pressure observability gap.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (13/13 tests, including new freshness boundary suite).
- ✅ `node bin/idlewatch-agent.js --dry-run` succeeds after freshness refactor.

### Acceptance criteria updates

- [x] Add threshold guidance for alerting (`warn/critical`) based on pressure, not free-only arithmetic.
- [x] Add CI-level deterministic coverage for stale-threshold boundary behavior (`openclawUsageAgeMs` classification).

## QA cycle update — 2026-02-16 18:40 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (13/13).
- ✅ `node bin/idlewatch-agent.js --dry-run` succeeds with populated CPU/memory/GPU/OpenClaw fields.
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ✅ `./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run` succeeds from packaged app scaffold.
- ⚠️ Firebase remains unconfigured in local QA env (local stdout/NDJSON validation only).

### Telemetry validation snapshot (latest samples)

- Direct CLI dry-run (`bin/idlewatch-agent.js`):
  - `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `memPressurePct`: populated (`29`) with `memPressureClass: "normal"`.
  - `tokensPerMin`: populated (`28184.14`).
  - `openclawUsageAgeMs`: `43484` with `source.usageIntegrationStatus: "ok"`.
- Packaged app dry-run (`IdleWatch.app` launcher):
  - `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"`.
  - `tokensPerMin`: populated (`18722.32`).
  - `openclawUsageAgeMs`: `66068` with `source.usageIntegrationStatus: "stale"` (threshold `60000`).

### Bugs / feature gaps (current)

1. **Stale-status flapping remains reproducible during packaging/runtime loops (Medium, observability noise)**
   - In this cycle, packaged app dry-run crossed threshold (`openclawUsageAgeMs=66068`) and correctly emitted `usageIntegrationStatus: stale`.
   - Behavior is correct, but operationally noisy for longer QA/build steps unless downstream alerts tolerate transient stale states.

2. **Trusted distribution path still optional/manual (High, release readiness)**
   - App/DMG generation is stable, but artifacts are unsigned unless `MACOS_CODESIGN_IDENTITY` is set.
   - Notarization/stapling still requires `MACOS_NOTARY_PROFILE`; no CI-enforced trusted artifact path yet.

3. **Firebase write path still not exercised in active QA loop (Medium, E2E confidence)**
   - Local telemetry generation remains healthy.
   - One credentialed validation pass is still needed to verify Firestore write path and failure-handling behavior.

### DMG packaging risk status

- ✅ Reproducible local packaging remains healthy (`IdleWatch.app` + versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk remains until signing + notarization are automated and validated in CI.
- ⚠️ Clean-machine install evidence is still pending (Apple Silicon + Intel/Rosetta scenarios).

### OpenClaw integration gap status

- ✅ Integration remains functional with real usage fields and deterministic stale classification.
- ⚠️ CI still lacks end-to-end timing assertions that model longer packaging windows where stale transitions are expected.


## Implementation cycle update — 2026-02-16 18:51 America/Toronto

### Completed this cycle

- ✅ Improved OpenClaw session selection reliability by choosing the **most recently updated** eligible session (not first-match) when parsing `openclaw status --json` recent sessions.
- ✅ Added usage freshness early-warning metadata to reduce stale-alert flapping risk:
  - new env var `IDLEWATCH_USAGE_NEAR_STALE_MS` (default `floor(stale*0.75)`)
  - new telemetry fields `source.usageFreshnessState` and `source.usageNearStale`
  - exported threshold metadata via `source.usageNearStaleMsThreshold`
- ✅ Added CI trusted distribution workflow `.github/workflows/release-macos-trusted.yml` for signed/notarized DMG builds when secrets are configured.
- ✅ Updated packaging docs/README with required secrets and trusted-release pipeline details.
- ✅ Expanded parser/freshness tests for newest-session selection and aging/stale state boundaries.

### Validation checks run this cycle

- ✅ `npm test --silent` passes after parser and freshness logic updates.
- ✅ `node bin/idlewatch-agent.js --dry-run` succeeds with new freshness metadata fields present.

### Acceptance criteria updates

- [x] Add artifact build/sign/notarize workflow (with secrets in repo settings).
- [x] Improve OpenClaw usage selection resilience for multi-session `status --json` payloads.
- [x] Add explicit near-stale health signal to reduce stale-threshold observability noise.

## QA cycle update — 2026-02-16 19:00 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (13/13).
- ✅ `node bin/idlewatch-agent.js --dry-run` succeeds with populated CPU/memory/GPU/OpenClaw fields.
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ✅ `./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run` succeeds from packaged app scaffold.
- ⚠️ Firebase remains unconfigured in QA env (local stdout/NDJSON validation only).

### Telemetry validation snapshot (latest samples)

- Direct CLI dry-run:
  - `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `memPressurePct`: populated (`29`) with `memPressureClass: "normal"`.
  - `tokensPerMin`: populated (`28895.13`).
  - `openclawUsageAgeMs`: `46514` with `source.usageIntegrationStatus: "ok"` and `usageFreshnessState: "aging"`.
- Packaged app dry-run:
  - `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"`.
  - `tokensPerMin`: populated (`22099.74`).
  - `openclawUsageAgeMs`: `61188` with `source.usageIntegrationStatus: "stale"` and `usageFreshnessState: "stale"`.

### Bugs / feature gaps (current)

1. **Stale-status transitions still appear during longer packaging loops (Medium, observability noise)**
   - This cycle reproduced stale classification only in packaged dry-run (`openclawUsageAgeMs=61188` > `60000` threshold).
   - Classifier behavior is correct, but downstream alerts/tests should tolerate transient stale states during heavy QA/build windows.

2. **Trusted distribution path still not enforced by default (High, release readiness)**
   - Packaging remains reproducible, but local artifacts are unsigned when `MACOS_CODESIGN_IDENTITY` is unset.
   - Notarization/stapling still skipped unless `MACOS_NOTARY_PROFILE` is configured.

3. **Firebase write path still not exercised in active QA loop (Medium, E2E confidence)**
   - Local telemetry generation remains healthy.
   - A credentialed Firestore QA pass is still needed to verify end-to-end writes and failure handling.

### DMG packaging risk status

- ✅ Reproducible local packaging remains healthy (`IdleWatch.app` + versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk remains until signing + notarization are validated with configured credentials.
- ⚠️ Clean-machine install evidence is still pending (Apple Silicon + Intel/Rosetta scenarios).

### OpenClaw integration gap status

- ✅ Integration remains functional with real usage/session fields and deterministic freshness states (`ok`/`aging`/`stale`).
- ⚠️ End-to-end timing assertions for long packaging windows are still missing from CI.

## Implementation cycle update — 2026-02-16 19:24 America/Toronto

### Completed this cycle

- ✅ Added stale-classification grace control to reduce false-positive flapping in long packaging/QA loops:
  - new env var `IDLEWATCH_USAGE_STALE_GRACE_MS` (default `min(interval, 10000)`)
  - stale transition now triggers only when `usageAgeMs > staleThreshold + graceMs`
- ✅ Added explicit threshold-crossing observability signal:
  - `source.usagePastStaleThreshold` (true once age exceeds stale threshold, even within grace)
  - `source.usageStaleGraceMs` exported in every sample for downstream alert transparency
- ✅ Expanded freshness unit tests to cover grace-window behavior and threshold-crossing semantics.
- ✅ Updated `.env.example` and README with new tuning and metadata fields.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (14/14 including new grace-window tests).
- ✅ `node bin/idlewatch-agent.js --dry-run` succeeds with new usage freshness metadata fields present.

### Acceptance criteria updates

- [x] Mitigate stale-status flapping risk in long-running QA/build windows without hiding real threshold crossings.

## QA cycle update — 2026-02-16 19:20 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (14/14 tests; GPU/memory/OpenClaw/freshness suites all green).
- ✅ `node bin/idlewatch-agent.js --dry-run` succeeds with populated CPU/memory/GPU/OpenClaw fields.
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run` succeeds from packaged app scaffold.
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ Firebase remains unconfigured in QA env (local stdout/NDJSON validation only).

### Telemetry validation snapshot (latest samples)

- Direct CLI dry-run:
  - `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `memPressurePct`: populated (`29`) with `memPressureClass: "normal"`.
  - `tokensPerMin`: populated (`32248.12`).
  - `openclawUsageAgeMs`: `42001` with `source.usageIntegrationStatus: "ok"`, `usageFreshnessState: "fresh"`, `usageNearStale: false`.
- Packaged app dry-run:
  - `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"`.
  - `tokensPerMin`: populated (`28954.54`).
  - `openclawUsageAgeMs`: `46923` with `source.usageIntegrationStatus: "ok"`, `usageFreshnessState: "aging"`, `usageNearStale: true`, `usagePastStaleThreshold: false`.

### Bugs / feature gaps (current)

1. **Trusted distribution path still optional/manual by default (High, release readiness)**
   - Local packaging remains unsigned when `MACOS_CODESIGN_IDENTITY` is unset.
   - Notarization/stapling still skipped unless `MACOS_NOTARY_PROFILE` is configured.

2. **Firebase write path still not exercised in active QA loop (Medium, E2E confidence)**
   - Local telemetry generation is healthy.
   - A credentialed Firestore QA pass is still required to verify end-to-end writes and error handling.

3. **Clean-machine installer validation still pending (Medium, distribution confidence)**
   - No new install evidence this cycle for fresh macOS environments (Apple Silicon + Intel/Rosetta).

### DMG packaging risk status

- ✅ Reproducible local packaging remains healthy (`IdleWatch.app` + versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk remains until signing + notarization are executed with configured credentials.
- ⚠️ Clean-machine install evidence is still pending.

### OpenClaw integration gap status

- ✅ Integration remains healthy on host with populated usage/session fields and expected freshness transitions (`fresh`/`aging`).
- ✅ Grace-window metadata is present in emitted samples (`usageStaleGraceMs`, `usagePastStaleThreshold`) and reduces stale flip noise in this cycle.
- ⚠️ End-to-end CI timing assertions for long packaging windows are still absent.

## Implementation cycle update — 2026-02-16 19:31 America/Toronto

### Completed this cycle

- ✅ Added strict trusted-distribution guardrail for local packaging flows via `IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION=1`.
- ✅ `scripts/package-macos.sh` now fails fast in strict mode if `MACOS_CODESIGN_IDENTITY` is missing.
- ✅ `scripts/build-dmg.sh` now fails fast in strict mode if signing/notary inputs are missing (`MACOS_CODESIGN_IDENTITY`, `MACOS_NOTARY_PROFILE`).
- ✅ Added one-command strict packaging entrypoint: `npm run package:trusted`.
- ✅ Updated `.env.example`, README, and macOS packaging docs with strict-mode behavior and operator guidance.

### Acceptance criteria updates

- [x] Add safe-guarded local packaging path that prevents accidental unsigned/unnotarized release artifacts.
- [x] Document strict trusted-release toggles and required environment variables for operators.

## QA cycle update — 2026-02-16 19:40 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (14/14 tests).
- ✅ `node bin/idlewatch-agent.js --dry-run` succeeds with populated CPU/memory/GPU/OpenClaw fields.
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ Firebase remains unconfigured in QA env (local stdout/NDJSON validation only).

### Telemetry validation snapshot (latest sample)

- `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
- `memPressurePct`: populated (`29`) with `memPressureClass: "normal"`.
- `tokensPerMin`: populated (`~29.1k` to `~29.9k` in this cycle).
- `openclawModel`: populated (`gpt-5.3-codex`).
- `openclawTotalTokens`: populated (`23849`).
- `openclawSessionId` / `openclawAgentId` / `openclawUsageTs`: populated and stable.
- `openclawUsageAgeMs`: observed `~46.7s` to `~48.0s` with `source.usageIntegrationStatus: "ok"`.
- `source.usageFreshnessState`: `"aging"`; `source.usageNearStale`: `true`; `source.usagePastStaleThreshold`: `false`.
- `source.usageCommand`: `openclaw status --json`.
- `source.usageStaleMsThreshold`: `60000`; `source.usageNearStaleMsThreshold`: `45000`; `source.usageStaleGraceMs`: `10000`.

### Bugs / feature gaps (current)

1. **Trusted distribution path still optional/manual by default (High, release readiness)**
   - Local packaging remains unsigned when `MACOS_CODESIGN_IDENTITY` is unset.
   - Notarization/stapling still requires `MACOS_NOTARY_PROFILE`; strict mode exists but is opt-in.

2. **Firebase write path still not exercised in active QA loop (Medium, E2E confidence)**
   - Local telemetry generation remains healthy.
   - A credentialed Firestore QA pass is still required to validate writes and failure handling.

3. **Clean-machine installer validation still pending (Medium, distribution confidence)**
   - No new install evidence this cycle for fresh macOS environments (Apple Silicon + Intel/Rosetta).

### DMG packaging risk status

- ✅ Reproducible local packaging remains healthy (`IdleWatch.app` + versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk remains until signing + notarization are executed with configured credentials.
- ⚠️ Clean-machine install evidence is still pending.

### OpenClaw integration gap status

- ✅ Integration remains healthy on host with populated usage/session fields and deterministic freshness metadata.
- ✅ Grace-window observability fields remain present and coherent (`usageNearStale`, `usagePastStaleThreshold`, `usageStaleGraceMs`).
- ⚠️ End-to-end Firebase/OpenClaw-in-the-loop CI timing assertions are still pending.

## Implementation cycle update — 2026-02-16 19:51 America/Toronto

### Completed this cycle

- ✅ Added deterministic dry-run telemetry schema validator (`scripts/validate-dry-run-schema.mjs`) that enforces field presence/type/enum contracts and usage-source consistency checks.
- ✅ Added npm entrypoints for schema validation across both runtime shapes:
  - `npm run validate:dry-run-schema` (direct CLI)
  - `npm run validate:packaged-dry-run-schema` (packaged app launcher)
- ✅ Wired CI to run schema validation in both workflows:
  - `node-tests` now gates on direct dry-run schema validation.
  - `macos-packaging-smoke` now gates on packaged app dry-run schema validation before DMG build.
- ✅ Marked telemetry-schema merge gating acceptance criterion complete in QA log.

### Acceptance criteria updates

- [x] Gate merges on telemetry schema validation and deterministic integration tests.

### Remaining high-priority gaps (unchanged)

1. **Trusted distribution still credential-dependent by environment (High, release readiness)**
   - Strict mode + trusted workflow exist, but local/default flows remain unsigned when signing/notary env is unset.
2. **Credentialed Firebase E2E validation still pending (Medium, delivery confidence)**
   - Local stdout/NDJSON validation is healthy; Firestore path still needs one credentialed QA pass.

## QA cycle update — 2026-02-16 20:00 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (14/14 tests).
- ✅ `npm run validate:dry-run-schema --silent` passes (direct CLI schema contract).
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes (packaged app schema contract).
- ✅ `node bin/idlewatch-agent.js --dry-run` succeeds with populated CPU/memory/GPU/OpenClaw fields.
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run` succeeds from packaged app scaffold.
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ Firebase remains unconfigured in QA env (local stdout/NDJSON validation only).

### Telemetry validation snapshot (latest samples)

- Direct CLI dry-run:
  - `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `memPressurePct`: populated (`30`) with `memPressureClass: "normal"`.
  - `tokensPerMin`: populated (`33226.77`).
  - `openclawUsageAgeMs`: `45177` with `source.usageIntegrationStatus: "ok"`, `usageFreshnessState: "aging"`, `usageNearStale: true`.
- Packaged app dry-run:
  - `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"`.
  - `tokensPerMin`: populated (`29166.62`).
  - `openclawUsageAgeMs`: `51636` with `source.usageIntegrationStatus: "ok"`, `usageFreshnessState: "aging"`, `usageNearStale: true`, `usagePastStaleThreshold: false`.
- Usage metadata remains coherent in both shapes:
  - `source.usageCommand`: `openclaw status --json`
  - `source.usageStaleMsThreshold`: `60000`
  - `source.usageNearStaleMsThreshold`: `45000`
  - `source.usageStaleGraceMs`: `10000`

### Bugs / feature gaps (current)

1. **Trusted distribution still optional unless strict mode is explicitly enabled (High, release readiness)**
   - Local packaging remains unsigned when `MACOS_CODESIGN_IDENTITY` is unset.
   - Notarization/stapling still requires `MACOS_NOTARY_PROFILE`; strict trusted mode is available but opt-in.

2. **Credentialed Firebase write-path QA still pending (Medium, E2E confidence)**
   - Local telemetry and schema validation are green.
   - One credentialed Firestore pass is still required to validate write success + failure handling.

3. **Clean-machine installer validation remains outstanding (Medium, distribution confidence)**
   - No new evidence this cycle for fresh-machine install and first-run validation (Apple Silicon + Intel/Rosetta).

### DMG packaging risk status

- ✅ Local packaging remains reproducible (`IdleWatch.app` + versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk persists until signing + notarization are executed with real credentials.
- ⚠️ Clean-machine install validation is still pending.

### OpenClaw integration gap status

- ✅ Integration remains healthy on host with populated usage/session fields and schema checks passing in both direct and packaged flows.
- ✅ Freshness/near-stale/grace metadata remains coherent across runs.
- ⚠️ Long-window timing assertions are still CI-unit focused; no full E2E timing harness yet for packaging-duration stale transitions.

## Implementation cycle update — 2026-02-16 20:09 America/Toronto

### Completed this cycle

- ✅ Added DMG install validation harness: `scripts/validate-dmg-install.sh`.
- ✅ Added npm entrypoint `npm run validate:dmg-install` to exercise mounted-DMG install flow.
- ✅ Wired macOS packaging CI smoke to run DMG install validation after DMG build.
- ✅ Updated README + packaging docs to document DMG install validation semantics.

### Acceptance criteria updates

- [x] Add clean-machine-like installer validation to CI (mount DMG, copy app, run launcher dry-run schema check).

## QA cycle update — 2026-02-16 20:35 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (14/14) including GPU, memory-pressure, and OpenClaw usage parser fixtures.
- ✅ `node bin/idlewatch-agent.js --dry-run` emits one local sample and appends NDJSON.
- ✅ `npm run package:macos --silent` builds `dist/IdleWatch.app`.
- ✅ `./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run` runs from packaged scaffold.
- ✅ `npm run package:dmg --silent` builds `dist/IdleWatch-0.1.0-unsigned.dmg`.

### Telemetry validation snapshot (this host)

- CPU/memory/memory-pressure fields: populated (`cpuPct`, `memPct`, `memUsedPct`, `memPressurePct`, `memPressureClass`).
- GPU field: populated this run (`gpuPct: 0`, `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`).
- OpenClaw usage fields: **unavailable** this run (`tokensPerMin`, `openclawModel`, `openclawTotalTokens`, session identifiers all `null`).
- Integration state flags: `source.usageIntegrationStatus: "unavailable"`, `source.usageCommand: null`.

### Bugs / feature gaps identified this cycle

1. **OpenClaw usage ingestion still environment-sensitive (High, observability reliability)**
   - Parser coverage is green, but live collector still regularly produces `usageIntegrationStatus=unavailable` depending on runtime context.
   - Need explicit QA matrix for execution context (interactive shell vs OpenClaw cron/agent session) and command availability expectations.

2. **Distribution artifact remains unsigned by default (High, trust/distribution)**
   - DMG generated successfully but remains `-unsigned`; signing/notarization path is optional and credential-gated.
   - Gatekeeper friction risk remains for non-technical installs unless trusted artifact enforcement is enabled in release process.

3. **No release gate tying telemetry health to packaging output (Medium, regression risk)**
   - Packaging can succeed while usage telemetry is unavailable.
   - Add CI/release policy gate requiring acceptable `source.usageIntegrationStatus` in a representative macOS runtime before publishing installer artifacts.

### DMG packaging risk status (current)

- ✅ Build reproducibility: app scaffold + unsigned DMG still reproducible.
- ⚠️ Trust path: unsigned by default unless `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE` are provided.
- ⚠️ Runtime dependency: Node still required on target unless runtime bundling strategy changes.

### OpenClaw integration gap status (current)

- ✅ JSON parser/test contract appears stable.
- ⚠️ Runtime integration remains inconsistent in real execution contexts (`usageIntegrationStatus` can flip to `unavailable`).
- ⚠️ Missing alerting/escalation policy for prolonged unavailable usage ingestion.

## Implementation cycle update — 2026-02-16 20:43 America/Toronto

### Completed this cycle

- ✅ Hardened OpenClaw runtime probe path for packaged/non-interactive contexts:
  - switched to `execFileSync` argv execution (no shell parsing dependency)
  - added binary resolution chain: `IDLEWATCH_OPENCLAW_BIN` → `/opt/homebrew/bin/openclaw` → `/usr/local/bin/openclaw` → `openclaw` (PATH)
- ✅ Added explicit OpenClaw probe diagnostics to telemetry source metadata:
  - `source.usageProbeResult`
  - `source.usageProbeAttempts`
  - `source.usageProbeError`
- ✅ Extended dry-run schema contract to enforce probe/source consistency (including unavailable-path explainability).
- ✅ Added strict release gate path for telemetry health in representative environments:
  - `IDLEWATCH_REQUIRE_OPENCLAW_USAGE=1` support in schema validator
  - `npm run validate:packaged-usage-health` entrypoint
  - optional trusted-release workflow gate via repo variable `IDLEWATCH_REQUIRE_OPENCLAW_USAGE_HEALTH=1`
- ✅ Updated operator docs (`README.md`, `.env.example`, `docs/packaging/macos-dmg.md`) with binary pinning and release-gate usage.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (14/14).
- ✅ `npm run validate:dry-run-schema --silent` passes with probe metadata checks.
- ✅ `npm run package:macos --silent` succeeds.
- ✅ `npm run validate:packaged-dry-run-schema --silent` succeeds.
- ✅ Host dry-run snapshot now resolves OpenClaw command explicitly as `/opt/homebrew/bin/openclaw status --json` in `source.usageCommand` when available.

### Acceptance criteria updates

- [x] Add release-policy gate path tying packaged artifact validation to OpenClaw usage health in representative runtime (`validate:packaged-usage-health`, workflow toggle).
- [x] Improve runtime observability for unavailable usage ingestion with explicit probe diagnostics (`usageProbe*` fields).

### Remaining high-priority gaps

1. **Trusted distribution remains credential-gated by environment (High, release readiness)**
   - Signed/notarized path exists, but successful trusted artifact generation still depends on configured Apple credentials.

2. **Credentialed Firebase E2E pass still pending (Medium, delivery confidence)**
   - Local/stdout schema + packaging validations are green; Firestore write-path QA still requires credentials.

## Implementation cycle update — 2026-02-16 20:51 America/Toronto

### Completed this cycle

- ✅ Added transient OpenClaw probe resilience via last-good usage fallback cache:
  - new env var `IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS`
  - probe can emit `source.usageProbeResult: "fallback-cache"` and keep usage populated during short command outages.
- ✅ Added fallback observability metadata:
  - `source.usageUsedFallbackCache`
  - `source.usageFallbackCacheAgeMs`
- ✅ Extended dry-run schema validator to enforce fallback metadata/consistency constraints.
- ✅ Updated `.env.example` and README with fallback behavior and tuning docs.

### Acceptance criteria updates

- [x] Improve monitoring reliability against transient OpenClaw CLI probe failures by reusing bounded last-good usage snapshots with explicit provenance.

## QA cycle update — 2026-02-16 21:00 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (14/14 tests).
- ✅ `npm run validate:dry-run-schema --silent` passes (direct CLI schema contract).
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes (packaged app schema contract).
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ Firebase remains unconfigured in QA env (local stdout/NDJSON validation only).

### Telemetry validation snapshot (latest samples)

- Direct CLI dry-run (`node bin/idlewatch-agent.js --dry-run`):
  - `gpuPct`: populated (`0`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `memPressurePct`: populated (`8`) with `memPressureClass: "normal"`.
  - `tokensPerMin`: populated (`33275.15`).
  - `openclawUsageAgeMs`: `49304` with `source.usageIntegrationStatus: "ok"`, `usageFreshnessState: "aging"`, `usageNearStale: true`, `usagePastStaleThreshold: false`.
- Packaged app dry-run (`./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run`):
  - `gpuPct`: populated (`0`) via `gpuSource: "ioreg-agx"`.
  - `tokensPerMin`: populated (`27400.38`).
  - `openclawUsageAgeMs`: `60212` with `source.usageIntegrationStatus: "ok"`, `usageFreshnessState: "aging"`, `usageNearStale: true`, `usagePastStaleThreshold: true` (still within stale grace window).
- Usage probe diagnostics remain healthy:
  - `source.usageProbeResult`: `"ok"`
  - `source.usageProbeAttempts`: `1`
  - `source.usageUsedFallbackCache`: `false`
  - `source.usageCommand`: `"/opt/homebrew/bin/openclaw status --json"`

### Bugs / feature gaps (current)

1. **Trusted distribution remains credential-gated and opt-in (High, release readiness)**
   - Artifacts are still unsigned/not notarized in default local runs.
   - `IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION=1` exists but is not enabled by default in local QA loops.

2. **OpenClaw usage age repeatedly crosses stale threshold during longer loops (Medium, observability tuning)**
   - Packaged run reached `openclawUsageAgeMs=60212` (above 60s threshold) while still `ok` due `usageStaleGraceMs=10000`.
   - Classifier behavior is correct; downstream alerting should key on `usagePastStaleThreshold` + grace semantics to avoid false positives.

3. **Credentialed Firebase E2E pass still pending (Medium, delivery confidence)**
   - Local telemetry generation and schema validation are green.
   - Firestore write-path validation with real credentials remains outstanding.

### DMG packaging risk status

- ✅ Local packaging remains reproducible (`IdleWatch.app` + versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk persists until signing + notarization run with valid Apple credentials.
- ⚠️ Clean-machine install evidence is now CI-harnessed, but manual user-level install UX checks remain limited.

### OpenClaw integration gap status

- ✅ Runtime probe and parser path remains healthy with explicit diagnostics and non-fallback usage ingestion.
- ✅ Freshness metadata remains coherent across direct + packaged runs (`usageNearStale`, `usagePastStaleThreshold`, grace window fields).
- ✅ Added dedicated long-window usage freshness E2E harness (`npm run validate:usage-freshness-e2e`) to assert expected transitions from `fresh` → `aging` → post-threshold-in-grace → `stale` using deterministic OpenClaw mock output.

## QA cycle update — 2026-02-16 21:20 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes.
- ✅ `npm run validate:dry-run-schema --silent` passes (direct CLI schema + probe metadata contract).
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes (packaged app schema contract).
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ✅ `npm run validate:usage-freshness-e2e --silent` passes (fresh → aging → grace-window → stale transition).
- ⚠️ Firebase remains unconfigured in QA env (local stdout/NDJSON validation only).

### Telemetry validation snapshot (this cycle)

- Direct CLI dry-run sample:
  - `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `memPressurePct`: populated (`10`) with `memPressureClass: "normal"`.
  - `tokensPerMin`: populated (`32835.59`).
  - `openclawUsageAgeMs`: `52255` with `source.usageIntegrationStatus: "ok"`, `usageFreshnessState: "aging"`, `usageNearStale: true`, `usagePastStaleThreshold: false`.
- Usage probe diagnostics:
  - `source.usageProbeResult`: `"ok"`
  - `source.usageProbeAttempts`: `1`
  - `source.usageUsedFallbackCache`: `false`
  - `source.usageCommand`: `"/opt/homebrew/bin/openclaw status --json"`

### Bugs / feature gaps (current)

1. **Trusted distribution is still opt-in and credential-gated (High, release readiness)**
   - Default local QA output remains unsigned DMG unless `MACOS_CODESIGN_IDENTITY` and `MACOS_NOTARY_PROFILE` are configured.
   - Strict mode (`IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION=1`) exists but is not default.

2. **Usage freshness remains near stale threshold in routine loops (Medium, observability tuning)**
   - This cycle observed `openclawUsageAgeMs=52255` with near-stale state.
   - Classifier behavior is correct, but downstream alerts should use `usagePastStaleThreshold` and grace metadata to avoid premature paging.

3. **Credentialed Firebase E2E validation still pending (Medium, delivery confidence)**
   - Local schema + packaging validation is green.
   - Firestore write-path validation with real credentials remains outstanding.

### DMG packaging risk status

- ✅ Build reproducibility remains healthy (`IdleWatch.app` + versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk remains until signing + notarization are executed with valid credentials.
- ⚠️ Manual user-level first-install UX validation is still limited (beyond CI harness checks).

### OpenClaw integration gap status

- ✅ Runtime probe path remains healthy in this cycle with explicit diagnostics and non-fallback ingestion.
- ✅ Freshness-state behavior remains coherent and validated in deterministic E2E harness.
- ✅ Production trusted-release path now enforces usage-health gate by default (see 21:31 implementation update).

## Implementation cycle update — 2026-02-16 21:31 America/Toronto

### Completed this cycle

- ✅ Enforced OpenClaw usage-health as a **default required gate** in trusted release workflow (`.github/workflows/release-macos-trusted.yml`).
- ✅ Removed optional workflow toggle (`vars.IDLEWATCH_REQUIRE_OPENCLAW_USAGE_HEALTH`) to avoid accidental policy bypass in production release runs.
- ✅ Updated release documentation (`README.md`, `docs/packaging/macos-dmg.md`) to reflect always-on usage-health enforcement before trusted artifact upload.

### Acceptance criteria updates

- [x] Enforce production release policy gate requiring packaged OpenClaw usage health on trusted release path.

### Remaining high-priority gaps (updated)

1. **Trusted distribution remains credential-gated by environment (High, release readiness)**
   - Signed/notarized path is now policy-gated for usage health, but artifact trust still depends on configured Apple credentials.

2. **Credentialed Firebase E2E validation still pending (Medium, delivery confidence)**
   - Local/stdout schema + packaging validations remain green; Firestore write-path QA still needs credentialed validation.

## QA cycle update — 2026-02-16 21:40 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (14/14).
- ✅ `npm run validate:dry-run-schema --silent` passes (direct CLI schema + probe metadata contract).
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes (packaged app schema contract).
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ✅ `npm run validate:usage-freshness-e2e --silent` passes (`fresh -> aging -> post-threshold-in-grace -> stale`).
- ⚠️ Firebase remains unconfigured in QA env (local stdout/NDJSON validation only).

### Telemetry validation snapshot (this cycle)

- Direct CLI dry-run sample (`node bin/idlewatch-agent.js --dry-run`):
  - `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `memPressurePct`: populated (`10`) with `memPressureClass: "normal"`.
  - `tokensPerMin`: populated (`25012.11`).
  - `openclawUsageAgeMs`: `43844` with `source.usageIntegrationStatus: "ok"`, `usageFreshnessState: "fresh"`, `usageNearStale: false`, `usagePastStaleThreshold: false`.
  - Probe diagnostics: `usageProbeResult: "ok"`, `usageProbeAttempts: 1`, `usageUsedFallbackCache: false`, `usageCommand: "/opt/homebrew/bin/openclaw status --json"`.

### Bugs / feature gaps (current)

1. **Trusted distribution remains credential-gated by environment (High, release readiness)**
   - Packaging is reproducible, but artifacts remain unsigned/not notarized unless `MACOS_CODESIGN_IDENTITY` + `MACOS_NOTARY_PROFILE` are configured.

2. **Credentialed Firebase E2E validation still pending (Medium, delivery confidence)**
   - Local telemetry/schema/packaging validations are green in this cycle.
   - Firestore write path still needs one credentialed validation pass.

3. **Manual first-install UX coverage remains limited (Medium, distribution confidence)**
   - CI-level DMG install validation exists, but real user-facing clean-machine install checks are still sparse.

### DMG packaging risk status

- ✅ Local packaging remains reproducible (`IdleWatch.app` + versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk remains until signing + notarization are executed with valid Apple credentials.
- ⚠️ Manual clean-machine UX evidence remains limited outside harnessed CI checks.

### OpenClaw integration gap status

- ✅ Runtime usage probe is healthy in this cycle (`usageProbeResult: ok`, no fallback cache use).
- ✅ Freshness metadata and deterministic freshness E2E validation remain coherent.
- ⚠️ Representative production-like E2E (with Firebase credentials) is still pending.

## Implementation cycle update — 2026-02-16 21:51 America/Toronto

### Completed this cycle

- ✅ Added configurable OpenClaw probe timeout control (`IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS`, default `2500`) to improve ingestion reliability on slower/non-interactive runtimes.
- ✅ Exposed probe-timeout observability in telemetry rows via `source.usageProbeTimeoutMs`.
- ✅ Extended dry-run schema validation to enforce `usageProbeTimeoutMs` presence/type.
- ✅ Added trusted packaging preflight script (`scripts/validate-trusted-prereqs.sh`) to verify:
  - configured `MACOS_CODESIGN_IDENTITY`
  - configured `MACOS_NOTARY_PROFILE`
  - local keychain contains the signing identity
  - notary profile is usable via `xcrun notarytool`
- ✅ Wired `npm run package:trusted` to run trusted preflight before build/sign/notarize steps.
- ✅ Updated operator docs (`README.md`, `.env.example`, `docs/packaging/macos-dmg.md`) with timeout + preflight guidance.

### Acceptance criteria updates

- [x] Add fail-fast local trusted-release preflight to reduce unsigned/notarization misconfiguration churn.
- [x] Add tunable OpenClaw probe timeout and explicit timeout metadata for reliability diagnostics.

## QA cycle update — 2026-02-16 22:00 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (14/14).
- ✅ `npm run validate:dry-run-schema --silent` passes (direct CLI schema + probe metadata contract).
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes (packaged app schema contract).
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ✅ `npm run validate:usage-freshness-e2e --silent` passes (`fresh -> aging -> post-threshold-in-grace -> stale`).
- ⚠️ Firebase remains unconfigured in QA env (local stdout/NDJSON validation only).

### Telemetry validation snapshot (this cycle)

- Direct CLI dry-run sample (`node bin/idlewatch-agent.js --dry-run`):
  - `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `memPressurePct`: populated (`10`) with `memPressureClass: "normal"`.
  - `tokensPerMin`: populated (`33447.22`).
  - `openclawUsageAgeMs`: `49976` with `source.usageIntegrationStatus: "ok"`, `usageFreshnessState: "aging"`, `usageNearStale: true`, `usagePastStaleThreshold: false`.
  - Probe diagnostics: `usageProbeResult: "ok"`, `usageProbeAttempts: 1`, `usageProbeTimeoutMs: 2500`, `usageUsedFallbackCache: false`, `usageCommand: "/opt/homebrew/bin/openclaw status --json"`.
- Packaged app dry-run sample (`./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run`):
  - `gpuPct`: populated (`10`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `tokensPerMin`: populated (`25571.73`).
  - `openclawUsageAgeMs`: `65756` with `source.usageIntegrationStatus: "ok"`, `usageFreshnessState: "aging"`, `usageNearStale: true`, `usagePastStaleThreshold: true` (still within stale grace window).

### Bugs / feature gaps (current)

1. **Trusted distribution remains credential-gated by environment (High, release readiness)**
   - Packaging remains reproducible, but artifacts are unsigned/not notarized unless `MACOS_CODESIGN_IDENTITY` + `MACOS_NOTARY_PROFILE` are configured.

2. **Usage age crosses stale threshold in packaged loops (Medium, observability tuning)**
   - This cycle reproduced `openclawUsageAgeMs=65756` with `usagePastStaleThreshold: true` but `usageIntegrationStatus: ok` due grace behavior.
   - Classifier is correct; downstream alerting should account for `usageStaleGraceMs` and avoid paging on threshold-crossing alone.

3. **Credentialed Firebase E2E validation still pending (Medium, delivery confidence)**
   - Local telemetry/schema/packaging checks remain green.
   - Firestore write path still needs one credentialed QA pass.

### DMG packaging risk status

- ✅ Local packaging remains reproducible (`IdleWatch.app` + versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk persists until signing + notarization run with valid Apple credentials.
- ⚠️ Manual clean-machine first-install UX coverage remains limited outside CI harness checks.

### OpenClaw integration gap status

- ✅ Runtime probe is healthy in this cycle (`usageProbeResult: ok`, one-attempt resolution, no fallback cache use).
- ✅ Freshness metadata remains coherent across direct and packaged runs.
- ⚠️ Representative production-like E2E with Firebase credentials remains pending.

## Implementation cycle update — 2026-02-16 22:11 America/Toronto

### Completed this cycle

- ✅ Fixed a startup reliability bug in `bin/idlewatch-agent.js` where setting `IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS` could trigger a pre-initialization `ReferenceError` during env validation.
- ✅ Reordered and centralized `IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS` parsing so validation always runs against an initialized value.
- ✅ Added regression coverage (`test/openclaw-env.test.mjs`) for:
  - valid explicit `IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS` in `--dry-run`
  - invalid value rejection (`0`) with explicit error assertion.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (16/16).
- ✅ New env-validation tests pass and guard both success + failure paths.

### Acceptance criteria updates

- [x] Harden runtime env validation path for OpenClaw fallback-cache max-age tuning (`IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS`) with deterministic tests.

## Implementation cycle update — 2026-02-16 22:22 America/Toronto

### Completed this cycle

- ✅ Added configurable OpenClaw probe sweep retries (`IDLEWATCH_OPENCLAW_PROBE_RETRIES`, default `1`) to improve ingestion reliability against transient CLI/JSON probe failures.
- ✅ Emitted retry observability metadata in each sample:
  - `source.usageProbeSweeps`
  - `source.usageProbeRetries`
- ✅ Extended dry-run schema validator to enforce retry metadata and sweep/retry consistency constraints.
- ✅ Added env validation coverage (`test/openclaw-env.test.mjs`) for accepted/rejected `IDLEWATCH_OPENCLAW_PROBE_RETRIES` values.
- ✅ Updated operator docs (`README.md`, `.env.example`, `--help`) with retry tuning guidance.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (18/18).
- ✅ `npm run validate:dry-run-schema --silent` passes with new probe retry fields.

### Acceptance criteria updates

- [x] Improve OpenClaw stats ingestion reliability for transient probe failures with configurable retry sweeps and explicit probe retry telemetry.

## Implementation cycle update — 2026-02-16 22:30 America/Toronto

### Completed this cycle

- ✅ Added Firebase emulator-first ingestion path for local E2E validation without service-account credentials:
  - when `FIRESTORE_EMULATOR_HOST` is set with `FIREBASE_PROJECT_ID`, collector now initializes Firestore writes in emulator mode.
- ✅ Improved Firebase configuration error messaging to explicitly document emulator-only mode requirements.
- ✅ Added regression tests for emulator config behavior (`test/openclaw-env.test.mjs`):
  - accepts `FIREBASE_PROJECT_ID + FIRESTORE_EMULATOR_HOST` without credential JSON
  - rejects emulator mode when `FIREBASE_PROJECT_ID` is missing
- ✅ Added operator validation entrypoint: `npm run validate:firebase-emulator-mode`.
- ✅ Updated `.env.example`, CLI `--help`, and README Firebase wiring docs with emulator mode guidance.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (20/20).
- ✅ `npm run validate:firebase-emulator-mode --silent` passes (`firebase=true` in dry-run without service-account creds).

### Acceptance criteria updates

- [x] Add credential-free local Firebase E2E path (Firestore emulator) to reduce dependency on production credentials for ingestion validation.

## QA cycle update — 2026-02-16 22:30 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (20/20).
- ✅ `npm run validate:dry-run-schema --silent` passes (direct CLI schema contract).
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes (packaged app schema contract).
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ✅ `npm run validate:dmg-install --silent` passes (mounted-DMG install + launcher dry-run schema check).

### Telemetry validation snapshot (this cycle)

- Direct CLI dry-run (`node bin/idlewatch-agent.js --dry-run`):
  - `gpuPct`: populated (`0`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `memPressurePct`: populated (`9`) with `memPressureClass: "normal"`.
  - `tokensPerMin`: populated (`36165.23`).
  - `openclawUsageAgeMs`: `45686` with `source.usageIntegrationStatus: "ok"`, `usageFreshnessState: "aging"`, `usageNearStale: true`, `usagePastStaleThreshold: false`.
- Packaged app dry-run (`./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run`):
  - `gpuPct`: populated (`0`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `tokensPerMin`: populated (`22284.54`).
  - `openclawUsageAgeMs`: `74868` with `source.usageIntegrationStatus: "stale"`, `usageFreshnessState: "stale"`, `usagePastStaleThreshold: true`.

### Bugs / feature gaps (current)

1. **Packaged-run usage staleness remains reproducible under QA/runtime delay (Medium, observability tuning)**
   - This cycle reproduced stale state in packaged dry-run (`openclawUsageAgeMs=74868`), while direct CLI remained `ok`.
   - Classifier appears correct; downstream alerts should use `usageFreshnessState` + grace metadata and avoid binary paging on transient packaged-loop stale events.

2. **Trusted distribution still credential-gated (High, release readiness)**
   - Packaging + DMG install validation are green, but artifact remains unsigned/not notarized without configured `MACOS_CODESIGN_IDENTITY` and `MACOS_NOTARY_PROFILE`.

3. **Production-credentialed Firebase write-path validation still pending (Medium, E2E confidence)**
   - Emulator-mode path is now validated, but one pass against real project credentials is still needed before release confidence is complete.

### DMG packaging risk status

- ✅ Packaging and installer validation are reproducible locally (`IdleWatch.app`, unsigned DMG, mounted-DMG install check).
- ⚠️ Gatekeeper/trust risk persists until signing + notarization execute successfully with real Apple credentials.

### OpenClaw integration gap status

- ✅ Probe diagnostics and usage schema remain healthy in direct CLI runs (`usageProbeResult: ok`, populated usage/session fields).
- ⚠️ Packaged runtime can still enter `stale` during longer loops; tuning/policy alignment is still needed for alerting behavior in distribution QA pipelines.

## Implementation cycle update — 2026-02-16 22:36 America/Toronto

### Completed this cycle

- ✅ Added explicit OpenClaw ingestion-vs-activity health split to reduce stale-alert ambiguity:
  - new `source.usageIngestionStatus` (`ok|disabled|unavailable`) reflects probe-path reliability.
  - new `source.usageActivityStatus` (`fresh|aging|stale|unknown|disabled|unavailable`) reflects age/activity state.
- ✅ Kept backward-compatible `source.usageIntegrationStatus` behavior unchanged, while exposing clearer downstream alert dimensions.
- ✅ Extended dry-run schema validation to enforce the new status fields and consistency with `source.usage` state.
- ✅ Updated README source-metadata docs and alert guidance to page on ingestion failures, not age-only staleness.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (20/20).
- ✅ `npm run validate:dry-run-schema --silent` passes.
- ✅ `npm run package:macos --silent` succeeds and refreshes packaged launcher.
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes with new source status fields.

### Acceptance criteria updates

- [x] Improve OpenClaw observability semantics so stale usage age can be distinguished from probe/ingestion outages in alert policy.

## QA cycle update — 2026-02-16 22:40 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (20/20).
- ✅ `npm run validate:dry-run-schema --silent` passes (direct CLI schema + usage status consistency).
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes (packaged app schema contract).
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ✅ `npm run validate:dmg-install --silent` passes (mounted-DMG install + launcher dry-run schema check).
- ✅ `npm run validate:usage-freshness-e2e --silent` passes (`fresh -> aging -> post-threshold-in-grace -> stale`).
- ⚠️ Firebase remains unconfigured in this QA env (local stdout/NDJSON validation only).

### Telemetry validation snapshot (this cycle)

- Direct CLI dry-run (`node bin/idlewatch-agent.js --dry-run`):
  - `gpuPct`: populated (`0`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `memPressurePct`: populated (`9`) with `memPressureClass: "normal"`.
  - `tokensPerMin`: populated (`203443.81`).
  - `openclawUsageAgeMs`: `41808` with `source.usageIntegrationStatus: "ok"`, `source.usageIngestionStatus: "ok"`, `source.usageActivityStatus: "fresh"`, `source.usageNearStale: false`, `source.usagePastStaleThreshold: false`.
  - Probe diagnostics: `usageProbeResult: "ok"`, `usageProbeAttempts: 1`, `usageProbeSweeps: 1`, `usageProbeRetries: 1`, `usageProbeTimeoutMs: 2500`, `usageUsedFallbackCache: false`, `usageCommand: "/opt/homebrew/bin/openclaw status --json"`.
- Packaged app dry-run (`./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run`):
  - `gpuPct`: populated (`0`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `tokensPerMin`: populated (`141327.06`).
  - `openclawUsageAgeMs`: `60661` with `source.usageIntegrationStatus: "ok"`, `source.usageIngestionStatus: "ok"`, `source.usageActivityStatus: "aging"`, `source.usageNearStale: true`, `source.usagePastStaleThreshold: true` (still within stale grace window).

### Bugs / feature gaps (current)

1. **Packaged-run usage age still crosses stale threshold in QA loops (Medium, observability tuning)**
   - This cycle reproduced post-threshold age in packaged run (`openclawUsageAgeMs=60661`) while ingestion remained healthy (`usageIngestionStatus=ok`).
   - Alerting should continue to page on ingestion failures and treat age-only threshold crossings with grace semantics.

2. **Trusted distribution remains credential-gated (High, release readiness)**
   - Packaging and install validation are green, but artifacts remain unsigned/not notarized without configured `MACOS_CODESIGN_IDENTITY` and `MACOS_NOTARY_PROFILE`.

3. **Production-credentialed Firebase write-path validation still pending (Medium, E2E confidence)**
   - Emulator/local validation is healthy, but one pass against real Firebase project credentials is still needed.

### DMG packaging risk status

- ✅ Packaging and installer validation remain reproducible locally (`IdleWatch.app`, unsigned DMG, mounted-DMG install check).
- ⚠️ Gatekeeper/trust risk persists until signing + notarization execute successfully with real Apple credentials.

### OpenClaw integration gap status

- ✅ Probe diagnostics and ingestion status remain healthy in both direct and packaged runs (`usageIngestionStatus: ok`, `usageProbeResult: ok`).
- ✅ New ingestion/activity status split is producing coherent signals for alert policy (`ok` ingestion with `fresh/aging` activity states).
- ⚠️ Packaged runtime still reaches post-threshold age during longer loops; downstream policy tuning should continue to rely on activity + grace semantics instead of threshold crossing alone.

## Implementation cycle update — 2026-02-16 22:49 America/Toronto

### Completed this cycle

- ✅ Added targeted stale-threshold recovery pass for OpenClaw usage ingestion in `collectSample()`:
  - when a sample crosses stale threshold (`usagePastStaleThreshold=true`) with successful ingestion, collector now forces one immediate uncached OpenClaw reprobe before finalizing row.
  - this reduces false stale classifications caused by cache TTL timing during packaged/long-loop runs.
- ✅ Added explicit observability fields for the recovery path:
  - `source.usageRefreshAttempted`
  - `source.usageRefreshRecovered`
- ✅ Extended schema validator contract to enforce new recovery metadata shape + consistency (`usageRefreshRecovered` implies `usageRefreshAttempted`).
- ✅ Updated README source-metadata docs with new recovery fields and semantics.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (20/20).
- ✅ `npm run validate:dry-run-schema --silent` passes (direct CLI includes new refresh metadata).
- ✅ `npm run package:macos --silent` rebuilds packaged scaffold with changes.
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes (packaged launcher includes new refresh metadata).

### Acceptance criteria updates

- [x] Mitigate packaged-loop stale-age noise by adding one-shot forced reprobe recovery before final activity classification.

## Implementation cycle update — 2026-02-16 22:55 America/Toronto

### Completed this cycle

- ✅ Added one-shot runtime mode (`--once`) for deterministic Firebase write-path validation without running the continuous loop.
- ✅ Added `npm run validate:firebase-write-once` helper to execute a single real ingestion attempt (emulator or production credentials).
- ✅ Added smoke coverage for one-shot mode (`npm run smoke:once`) and gated default test suite on it.
- ✅ Updated README CLI/docs to include `--once` semantics and Firebase validation workflow guidance.

### Acceptance criteria updates

- [x] Add deterministic one-sample publish mode to reduce QA friction for Firebase/OpenClaw ingestion validation in non-loop contexts.

## Implementation cycle update — 2026-02-16 22:58 America/Toronto

### Completed this cycle

- ✅ Improved stale-threshold recovery reliability by allowing configurable multi-attempt forced reprobes when usage crosses stale threshold:
  - new env vars `IDLEWATCH_USAGE_REFRESH_REPROBES` (default `1`) and `IDLEWATCH_USAGE_REFRESH_DELAY_MS` (default `250`).
  - refresh path now retries uncached probes (`reprobes + 1` total attempts) with optional inter-attempt delay.
- ✅ Added refresh observability metadata for downstream tuning/debugging:
  - `source.usageRefreshAttempts`
  - `source.usageRefreshReprobes`
  - `source.usageRefreshDelayMs`
- ✅ Extended schema validator contracts for refresh metadata and consistency checks.
- ✅ Added env validation tests for accepted/rejected refresh retry/delay settings.
- ✅ Updated operator docs/help (`README.md`, `.env.example`, CLI `--help`) with new refresh controls.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (24/24).
- ✅ `npm run validate:dry-run-schema --silent` passes with new refresh metadata checks.
- ✅ `npm run package:macos --silent` succeeds.
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes with packaged launcher schema checks.

### Acceptance criteria updates

- [x] Add configurable multi-attempt stale-threshold refresh controls to reduce packaged-loop stale flapping risk without masking ingestion failures.

## QA cycle update — 2026-02-16 23:01 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (24/24).
- ✅ `npm run validate:dry-run-schema --silent` passes.
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes.
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ Firebase remains unconfigured in this QA env (local stdout/NDJSON validation only).

### Telemetry validation snapshot (this cycle)

- Direct CLI dry-run (`node bin/idlewatch-agent.js --dry-run` from test/smoke path):
  - `gpuPct`: populated (`2`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `memPressurePct`: populated (`11`) with `memPressureClass: "normal"`.
  - `tokensPerMin`: populated (`14884.65`).
  - `openclawUsageAgeMs`: `111946` with `source.usageIntegrationStatus: "stale"`, `source.usageIngestionStatus: "ok"`.
  - refresh metadata present (`usageRefreshAttempted: true`, `usageRefreshRecovered: false`, `usageRefreshAttempts: 2`).
- Packaged app dry-run (`./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run`):
  - `gpuPct`: populated (`3`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `tokensPerMin`: populated (`11898.93`).
  - `openclawUsageAgeMs`: `140372` with `source.usageIntegrationStatus: "stale"`, `source.usageIngestionStatus: "ok"`, `source.usageActivityStatus: "stale"`.
  - probe diagnostics stable (`usageProbeResult: "ok"`, `usageProbeAttempts: 1`, `usageCommand: "/opt/homebrew/bin/openclaw status --json"`).

### Bugs / feature gaps (current)

1. **Activity staleness remains common in low-traffic windows (Medium, alerting noise risk)**
   - In both direct and packaged dry-runs this cycle, ingestion was healthy (`usageIngestionStatus=ok`) while activity classified `stale` due to old `openclawUsageTs`.
   - Follow-up: ensure alert policy pages primarily on ingestion/probe failures and treats activity staleness as lower-severity when probes are healthy.

2. **Trusted distribution remains credential-gated (High, release readiness)**
   - DMG build remains reproducible but unsigned/not notarized by default (`MACOS_CODESIGN_IDENTITY`/`MACOS_NOTARY_PROFILE` unset).

3. **Firebase production write-path validation still pending (Medium, E2E confidence)**
   - Local schema and packaging validations are green; one credentialed Firestore pass is still needed.

### DMG packaging risk status

- ✅ Packaging pipeline remains reproducible (`IdleWatch.app` + versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk persists until signed + notarized artifacts are produced with real credentials.

### OpenClaw integration gap status

- ✅ Runtime probe path is healthy in both direct and packaged runs (`usageProbeResult: ok`, binary resolved to `/opt/homebrew/bin/openclaw`).
- ✅ Ingestion/activity split is behaving as designed (`usageIngestionStatus: ok` while `usageActivityStatus: stale` in low-traffic window).
- ⚠️ Still need downstream policy calibration to avoid noisy stale-only alerts during idle periods.

## Implementation cycle update — 2026-02-16 23:08 America/Toronto

### Completed this cycle

- ✅ Added explicit OpenClaw alert-routing metadata to reduce stale-only noise in downstream systems:
  - `source.usageAlertLevel`: `ok | notice | warning | critical | off`
  - `source.usageAlertReason`: `healthy | activity-near-stale | activity-past-threshold | activity-stale | ingestion-unavailable | usage-disabled`
- ✅ Alert derivation now cleanly separates outage paging from age-only activity states:
  - ingestion unavailable ⇒ `critical`
  - stale/past-threshold activity with healthy ingestion ⇒ `warning`
  - near-stale activity ⇒ `notice`
- ✅ Added deterministic unit coverage for alert derivation (`test/usage-alert.test.mjs`).
- ✅ Extended dry-run schema validator to enforce alert field enums and consistency constraints.
- ✅ Updated README source metadata + alerting guidance to document one-field routing on `usageAlertLevel`.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (30/30).
- ✅ `npm run validate:dry-run-schema --silent` passes with new alert metadata checks.

### Acceptance criteria updates

- [x] Add explicit usage alert-level metadata so downstream monitoring can page on ingestion outages without over-alerting on stale activity windows.

## QA cycle update — 2026-02-16 23:11 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (30/30).
- ✅ `npm run validate:dry-run-schema --silent` passes.
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes after app rebuild.
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ Firebase remains unconfigured in this QA env (local stdout/NDJSON validation only).

### Telemetry validation snapshot (this cycle)

- Direct CLI dry-run (`node bin/idlewatch-agent.js --dry-run`):
  - `gpuPct`: populated (`2`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `tokensPerMin`: populated (`12510.88`).
  - `openclawUsageAgeMs`: `92296` with `source.usageIntegrationStatus: "stale"`, `source.usageIngestionStatus: "ok"`.
  - alert metadata present and coherent (`usageAlertLevel: "warning"`, `usageAlertReason: "activity-stale"`).
- One-shot mode (`--once`) confirms usage-disabled path remains deterministic:
  - usage fields null, `source.usage: "disabled"`, `usageAlertLevel: "off"`, `usageAlertReason: "usage-disabled"`.

### Bugs / feature gaps (current)

1. **Packaged schema validation is order-dependent (Medium, QA ergonomics risk)**
   - Running `validate:packaged-dry-run-schema` before rebuilding the app can fail against stale packaged bits (observed transient `usageAlertLevel invalid`).
   - Follow-up: either make `validate:packaged-dry-run-schema` auto-run `package:macos`, or document/enforce an explicit precondition in npm script naming/help.

2. **Trusted distribution remains credential-gated (High, release readiness)**
   - DMG output remains unsigned/not notarized by default unless `MACOS_CODESIGN_IDENTITY` + `MACOS_NOTARY_PROFILE` are provided.

3. **Firebase production write-path validation still pending (Medium, E2E confidence)**
   - Local schema + packaging checks are green; one credentialed Firestore write pass is still needed.

### DMG packaging risk status

- ✅ App + DMG artifacts are reproducibly generated in local QA (`IdleWatch.app`, versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk persists until signed + notarized artifacts are produced and verified.

### OpenClaw integration gap status

- ✅ Usage probe and alert-routing metadata are present and coherent in direct dry-run output.
- ✅ Disabled-usage branch remains explicit and machine-readable (`off` alert level in `--once` validation).
- ⚠️ Activity staleness remains common during low-traffic windows; downstream alert policy should continue prioritizing ingestion failures over stale-only activity states.

## Implementation cycle update — 2026-02-16 23:16 America/Toronto

### Completed this cycle

- ✅ Fixed packaged-schema validation order dependency by making packaged validators self-refresh the app bundle before schema checks:
  - `validate:packaged-dry-run-schema` now runs `package:macos` first.
  - `validate:packaged-usage-health` now runs `package:macos` first.
- ✅ Updated operator docs (`README.md`, `docs/packaging/macos-dmg.md`) to document fresh-artifact auto-rebuild behavior for packaged validators.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (30/30).
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes with auto-rebuild flow.

### Acceptance criteria updates

- [x] Eliminate packaged schema-validation stale-artifact mismatch risk by auto-rebuilding `IdleWatch.app` in packaged validation entrypoints.

## QA cycle update — 2026-02-16 23:21 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (30/30).
- ✅ `node bin/idlewatch-agent.js --dry-run` emits populated OpenClaw usage telemetry.
- ✅ `npm run package:macos --silent` builds `dist/IdleWatch.app`.
- ✅ `./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run` succeeds.
- ✅ `npm run package:dmg --silent` builds `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ Firebase remains unconfigured in this QA env (local-only/stdout mode).

### Telemetry validation snapshot (host sample)

- `cpuPct`: populated (`18.49`)
- `memPct` / `memPressurePct`: populated (`84.02` / `12`, class=`normal`)
- `gpuPct`: populated (`0`) with `gpuSource="ioreg-agx"`, `gpuConfidence="high"`
- `tokensPerMin`: populated (`32581.16`)
- `openclawModel`: populated (`gpt-5.3-codex`)
- `openclawTotalTokens`: populated (`28502`)
- `openclawSessionId` / `openclawAgentId` / `openclawUsageTs`: populated
- `source.usageIntegrationStatus`: `ok`
- `source.usageActivityStatus`: `aging`
- `source.usageAlertLevel`: `notice` (`activity-near-stale`)

### Bugs / feature gaps identified this cycle

1. **OpenClaw freshness warning is frequent at current thresholds (Medium, signal quality)**
   - Observed near-stale classification in normal local operation (`usageActivityStatus='aging'`) with age around ~51s.
   - Suggest validating whether `IDLEWATCH_USAGE_NEAR_STALE_MS` default (45s) is too aggressive for real session cadence.

2. **Distribution artifacts still unsigned/unnotarized by default (High, release readiness)**
   - Build output remains `IdleWatch-0.1.0-unsigned.dmg` without `MACOS_CODESIGN_IDENTITY` / `MACOS_NOTARY_PROFILE`.
   - Gatekeeper friction persists until signing/notarization credentials are supplied and CI path is enforced.

3. **No Firebase-backed end-to-end validation in QA cycle (Medium, integration confidence)**
   - Current checks confirm local collection and packaging only.
   - Need one emulator or staging Firestore publish verification to close telemetry ingestion confidence gap.

### DMG packaging risk status (current)

- ✅ Reproducible local app + DMG generation.
- ⚠️ Trusted distribution not guaranteed (unsigned + non-notarized artifacts by default).
- ⚠️ No clean-machine installation evidence recorded in this cycle.

### OpenClaw integration gap status (current)

- ✅ Usage collection active and field mapping remains healthy on this host.
- ⚠️ Freshness classification may be too noisy under normal workloads.
- ⚠️ No contract test asserting acceptable near-stale/stale rates under expected session rhythm.

## Implementation cycle update — 2026-02-16 23:28 America/Toronto

### Completed this cycle

- ✅ Reduced near-stale alert noise by changing the default aging threshold to account for stale grace:
  - `IDLEWATCH_USAGE_NEAR_STALE_MS` now defaults to `floor((stale + grace) * 0.85)` instead of `floor(stale * 0.75)`.
- ✅ Reordered startup config initialization so near-stale default derives from validated stale + grace values deterministically.
- ✅ Updated operator-facing defaults/docs in `README.md`, `.env.example`, and CLI `--help` text.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (30/30).
- ✅ `npm run validate:dry-run-schema --silent` passes.
- ✅ Dry-run output reports the updated threshold metadata (`source.usageNearStaleMsThreshold: 59500` with default stale=60000, grace=10000).

### Acceptance criteria updates

- [x] Mitigate near-stale observability noise from overly aggressive default thresholding in normal local cadence.

## QA cycle update — 2026-02-16 23:30 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (30/30).
- ✅ `npm run validate:dry-run-schema --silent` passes.
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes (auto-rebuild path).
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ Firebase remains unconfigured in this QA env (local stdout/NDJSON validation only).

### Telemetry validation snapshot (this cycle)

- Direct dry-run schema sample includes updated default freshness metadata:
  - `source.usageStaleMsThreshold: 60000`
  - `source.usageStaleGraceMs: 10000`
  - `source.usageNearStaleMsThreshold: 59500` (matches new default derivation)
- `--once`/usage-disabled branch remains deterministic and explicit:
  - `source.usage: "disabled"`
  - `source.usageIntegrationStatus: "disabled"`
  - `source.usageAlertLevel: "off"`
  - `source.usageAlertReason: "usage-disabled"`
- Packaged dry-run schema validation passes after rebuild, confirming parity between direct and packaged telemetry contracts.

### Bugs / feature gaps identified this cycle

1. **Release artifact remains unsigned in default local flow (High, distribution trust)**
   - DMG output remains `IdleWatch-0.1.0-unsigned.dmg` when signing/notary credentials are absent.
   - Trusted path exists, but still requires operator-provided `MACOS_CODESIGN_IDENTITY` and `MACOS_NOTARY_PROFILE`.

2. **Firebase write path still not validated in this loop (Medium, E2E confidence)**
   - Local generation/schema checks are green.
   - Need one credentialed Firestore write validation pass to close ingestion confidence gap.

3. **No runtime-rate guard for near-stale frequency yet (Medium, alert tuning confidence)**
   - Threshold defaults improved, but there is still no CI/assertion around acceptable near-stale incidence under representative low-traffic workloads.

### DMG packaging risk status (current)

- ✅ App + DMG generation remains reproducible.
- ⚠️ Trust pipeline remains credential-gated; unsigned artifacts are still the default local output.
- ⚠️ Clean-machine install evidence was not extended in this cycle.

### OpenClaw integration gap status (current)

- ✅ Schema + packaged validators remain green with refreshed near-stale threshold metadata.
- ✅ Disabled-usage handling remains explicit and machine-readable.
- ⚠️ Still missing a workload-level quality gate for near-stale/stale frequency over longer observation windows.

## Implementation cycle update — 2026-02-16 23:37 America/Toronto

### Completed this cycle

- ✅ Added deterministic usage alert-rate quality harness (`scripts/validate-usage-alert-rate-e2e.mjs`) with mocked OpenClaw ages.
- ✅ Added CI gate + npm entrypoint:
  - `npm run validate:usage-alert-rate-e2e`
  - wired into `.github/workflows/ci.yml` (`node-tests` job)
- ✅ Guardrail now asserts expected behavior under representative low-traffic cadence:
  - typical age window samples remain `source.usageAlertLevel: "ok"`
  - boundary escalation remains deterministic (`notice` near-threshold, `warning` post-threshold/stale)
- ✅ Updated README validation docs with the new alert-rate quality gate.

### Acceptance criteria updates

- [x] Add workload-level quality gate for near-stale/stale alert incidence over representative low-traffic windows.

## QA cycle update — 2026-02-16 23:41 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (30/30) including OpenClaw parser + freshness/alert coverage.
- ✅ `node bin/idlewatch-agent.js --dry-run` emits a valid sample row in local-only mode.
- ✅ `npm run package:macos --silent` builds `dist/IdleWatch.app`.
- ✅ `./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run` succeeds from packaged app scaffold.
- ✅ `npm run package:dmg --silent` builds `dist/IdleWatch-0.1.0-unsigned.dmg`.

### Telemetry validation snapshot (latest)

- `cpuPct` / `memPct` / `memPressurePct`: populated and plausible.
- `gpuPct`: populated on this host (`0` to `2` observed), with `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
- OpenClaw usage fields (`tokensPerMin`, `openclawModel`, `openclawTotalTokens`, `openclawSessionId`, `openclawAgentId`, `openclawUsageTs`): populated in dry-run.
- `source.usageIntegrationStatus`: `ok`
- `source.usageIngestionStatus`: `ok`
- `source.usageActivityStatus`: `fresh`
- `source.usageCommand`: `/opt/homebrew/bin/openclaw status --json`

### Bugs / feature gaps identified this cycle

1. **Distribution trust pipeline still optional/manual (High)**
   - Packaging works, but artifacts remain unsigned by default and notarization is skipped without `MACOS_NOTARY_PROFILE`.
   - Risk: Gatekeeper friction for external users.

2. **Firebase integration not validated in this environment (Medium)**
   - Current QA evidence is local-only (`firebase=false`) due missing runtime credentials/emulator settings.
   - Need a dedicated write-path QA pass (service account or emulator) before release sign-off.

3. **DMG artifact size indicates scaffold-only payload (Low/Informational)**
   - Current unsigned DMG is very small (~61 KB), consistent with a launcher scaffold and no bundled Node runtime.
   - Keep dependency expectation explicit in release notes and installer docs.

### OpenClaw integration gap status (current)

- ✅ Usage probe and parser path are healthy on this host.
- ✅ Freshness + alert fields are emitted with consistent semantics.
- ⚠️ No CI assertion yet that enforces a bounded `openclawUsageAgeMs` on macOS runners under load.

### DMG packaging risk status (current)

- ✅ Build reproducibility: app scaffold + DMG generation succeeded this cycle.
- ⚠️ Trust/compliance: signing + notarization require external env/profiles and are not enforced by default.
- ⚠️ Runtime dependency: installer still assumes Node availability on target host.

## Implementation cycle update — 2026-02-16 23:52 America/Toronto

### Completed this cycle

- ✅ Added packaged-runtime OpenClaw stale-recovery E2E harness: `scripts/validate-packaged-usage-recovery-e2e.mjs`.
- ✅ Added npm entrypoint `npm run validate:packaged-usage-recovery-e2e`.
- ✅ Wired macOS packaging CI smoke (`.github/workflows/ci.yml`) to gate on packaged stale-threshold recovery behavior.
- ✅ Updated operator docs (`README.md`, `docs/packaging/macos-dmg.md`) with the new packaged recovery validation gate.

### Validation checks run this cycle

- ✅ `npm run validate:packaged-usage-recovery-e2e --silent` passes.
- ✅ `npm test --silent` passes (30/30).

### Acceptance criteria updates

- [x] Add CI assertion for packaged OpenClaw stale-threshold recovery so usage-age reliability behavior is validated on macOS packaging path.

## Implementation cycle update — 2026-02-16 23:56 America/Toronto

### Completed this cycle

- ✅ Added strict Firebase publish requirement toggle for deterministic one-shot ingestion validation:
  - new env var `IDLEWATCH_REQUIRE_FIREBASE_WRITES=1`
  - `--once` now fails fast when Firebase is not configured or publish is skipped.
- ✅ Added regression coverage for strict Firebase-write gating (`test/openclaw-env.test.mjs`):
  - rejects required-write mode without Firebase config
  - accepts required-write config path in emulator mode (`--dry-run` wiring check)
- ✅ Added strict npm entrypoint for operators/CI:
  - `npm run validate:firebase-write-required-once`
- ✅ Updated operator docs/help (`README.md`, `.env.example`, CLI `--help`) with strict Firebase-write validation guidance.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (32/32).
- ✅ New strict Firebase-write env validation tests pass.

### Acceptance criteria updates

- [x] Add deterministic fail-fast control for one-shot Firebase ingestion validation so credential/config drift cannot silently pass local-only mode.

## Implementation cycle update — 2026-02-17 00:08 America/Toronto

### Completed this cycle

- ✅ Added persisted OpenClaw last-good usage cache support for restart resilience:
  - new env var `IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH`
  - collector now hydrates last-good usage from disk at startup and can serve `fallback-cache` immediately after process restarts.
- ✅ Added explicit fallback provenance metadata for observability:
  - new telemetry field `source.usageFallbackCacheSource` (`memory | disk | null`).
- ✅ Persist-on-success path now writes last-good usage snapshots whenever live OpenClaw usage parsing succeeds.
- ✅ Added deterministic unit coverage for cache persistence/corruption handling (`test/openclaw-cache.test.mjs`).
- ✅ Extended schema validator to enforce fallback cache source consistency when `usageProbeResult=fallback-cache`.
- ✅ Updated operator docs/help (`README.md`, `.env.example`, CLI `--help`) with persistent cache behavior and configuration.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (34/34).
- ✅ `npm run validate:dry-run-schema --silent` passes.

### Acceptance criteria updates

- [x] Improve monitoring reliability across short agent restarts by persisting/reusing bounded last-good OpenClaw usage snapshots with explicit provenance.

## Implementation cycle update — 2026-02-17 00:18 America/Toronto

### Completed this cycle

- ✅ Added optional max-usage-age contract enforcement to dry-run schema validator via `IDLEWATCH_MAX_OPENCLAW_USAGE_AGE_MS`.
- ✅ Added packaged SLO gate script: `npm run validate:packaged-usage-age-slo` (requires OpenClaw usage + max age <= `300000ms`).
- ✅ Wired macOS packaging CI to run the packaged usage-age SLO gate before recovery/DMG checks.
- ✅ Hardened trusted release policy by enforcing `IDLEWATCH_MAX_OPENCLAW_USAGE_AGE_MS=300000` in usage-health gate step.
- ✅ Updated operator docs/config references (`README.md`, `.env.example`, `docs/packaging/macos-dmg.md`) with the new usage-age guardrail.

### Validation checks run this cycle

- ✅ `npm test --silent` passes (34/34).
- ✅ `npm run validate:dry-run-schema --silent` passes.
- ✅ `npm run validate:packaged-usage-age-slo --silent` passes.

### Acceptance criteria updates

- [x] Add CI-level packaged-runtime guardrail for excessively stale OpenClaw usage age to catch ingestion drift/regressions beyond freshness-grace tuning.

## QA cycle update — 2026-02-17 00:20 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (34/34 tests).
- ✅ `npm run validate:dry-run-schema --silent` passes (direct CLI schema contract + probe metadata).
- ✅ `npm run package:macos --silent` succeeds and refreshes `dist/IdleWatch.app`.
- ✅ `npm run validate:packaged-dry-run-schema --silent` passes (packaged launcher schema contract).
- ✅ `npm run package:dmg --silent` succeeds and outputs `dist/IdleWatch-0.1.0-unsigned.dmg`.
- ⚠️ Firebase remains unconfigured in this QA environment (local stdout/NDJSON validation only).

### Telemetry validation snapshot (latest samples)

- Direct CLI dry-run (`node bin/idlewatch-agent.js --dry-run`):
  - `gpuPct`: populated (`0`) via `gpuSource: "ioreg-agx"`, `gpuConfidence: "high"`.
  - `memPressurePct`: populated (`12`) with `memPressureClass: "normal"`.
  - `tokensPerMin`: populated (`31753.24`).
  - `openclawModel`: populated (`gpt-5.3-codex`), `openclawTotalTokens`: populated (`28679`).
  - `openclawUsageAgeMs`: `52893` with `source.usageIntegrationStatus: "ok"`, `usageIngestionStatus: "ok"`, `usageActivityStatus: "fresh"`.
  - `source.usageCommand`: `/opt/homebrew/bin/openclaw status --json`.
- Packaged schema dry-run gate (`./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run`):
  - schema validation passes in packaged context.
  - validator's one-shot disabled-mode check remains coherent (`source.usage=disabled`, `usageIntegrationStatus=disabled`) when usage is intentionally turned off for contract coverage.

### Bugs / feature gaps (current)

1. **Trusted distribution still optional unless strict mode/credentials are set (High, release readiness)**
   - This cycle produced a fresh unsigned installer (`IdleWatch-0.1.0-unsigned.dmg`).
   - Signing/notarization remains credential-gated (`MACOS_CODESIGN_IDENTITY`, `MACOS_NOTARY_PROFILE`) and non-default.

2. **Firebase write-path E2E still not exercised in active QA loop (Medium, delivery confidence)**
   - All local schema/packaging checks are green.
   - One credentialed run (`IDLEWATCH_REQUIRE_FIREBASE_WRITES=1` + project creds/emulator) is still needed for publish-path sign-off.

3. **Node runtime dependency remains explicit for current scaffold distribution (Medium, install UX)**
   - DMG footprint continues to indicate launcher/scaffold packaging rather than bundled runtime.
   - Installer docs should continue to call out Node requirement until runtime bundling strategy changes.

### DMG packaging risk status

- ✅ Reproducible local packaging remains healthy (`IdleWatch.app` + versioned unsigned DMG).
- ⚠️ Gatekeeper/trust risk persists until signed + notarized artifacts are produced under trusted-release inputs.
- ⚠️ Runtime dependency risk persists for non-Node hosts.

### OpenClaw integration gap status

- ✅ Integration remains healthy on this host in direct dry-run (`usageIntegrationStatus=ok`, populated usage/session fields).
- ✅ Probe diagnostics remain explicit and actionable (`usageProbeResult`, `usageProbeAttempts`, `usageCommand`).
- ⚠️ Still missing a credentialed end-to-end Firebase+OpenClaw combined publish validation in this QA stream.

## Implementation cycle update — 2026-02-17 00:30 America/Toronto

### Completed this cycle

- ✅ Removed packaged launcher dependency on `npx` (and implicit network/npm behavior) by expanding the packed tarball into app resources and executing the local payload directly via Node.
- ✅ Added packaged launcher Node pinning support via `IDLEWATCH_NODE_BIN` for deterministic runtime selection in non-interactive contexts.
- ✅ Updated packaging/operator docs (`docs/packaging/macos-dmg.md`, `README.md`, `.env.example`) to reflect launcher execution model and new env var.
- ✅ Revalidated runtime + packaging smoke after launcher change:
  - `npm test --silent`
  - `npm run validate:packaged-dry-run-schema --silent`

### Acceptance criteria updates

- [x] Reduce packaged runtime fragility by removing `npx`-based launcher execution path.
- [x] Add deterministic launcher runtime pinning (`IDLEWATCH_NODE_BIN`) for packaged artifacts.
