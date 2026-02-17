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
- [ ] Gate merges on telemetry schema validation and deterministic integration tests.

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
