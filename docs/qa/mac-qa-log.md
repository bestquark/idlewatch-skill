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
- GPU metric uses shell parse: `top -l 1 | grep 'GPU'`.
- On many systems/output variants this returns nothing; current output frequently `null`.

**Risk**
- Sparse/inconsistent GPU signal; false assumption that GPU usage is zero/unknown.

**Acceptance criteria**
- [ ] Define GPU support matrix (Apple Silicon/Intel, macOS versions).
- [ ] Implement robust source (e.g., `powermetrics` with permission handling, or fallback chain with quality flags).
- [ ] Emit provenance fields: `gpuSource`, `gpuConfidence`, `gpuSampleWindowMs`.
- [ ] Add parser tests with captured real outputs from at least 3 Mac configurations.

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

## Packaging options matrix (Mac downloadable app)

| Option | UX | Build complexity | Runtime footprint | Native macOS integration | DMG readiness | Notes |
|---|---|---:|---:|---|---|---|
| Electron menubar app | Strong desktop UX; easy tray/settings | Medium-High | High | Medium (good, but heavy) | Strong (well-known tooling) | Fastest GUI path if web stack preferred; larger binary and memory cost. |
| Tauri menubar app | Strong UX | Medium | Low-Medium | Medium-High | Strong | Smaller footprint than Electron; Rust toolchain complexity. |
| Swift menubar app (native) | Best native UX | High (if greenfield) | Low | Highest | Strong | Best long-term Mac product fit; easiest trust/compliance story for Mac users. |
| CLI + launchd only | Minimal UX (power-user/admin) | Low | Lowest | Low-Medium | Weak for "app" expectation | Best for internal/ops rollout, weakest for consumer-style downloadable app experience. |

## Recommendation

**Recommended shipping strategy: Swift menubar wrapper + embedded/managed collector (or IPC to CLI), with signed/notarized DMG.**

Reasoning:
1. Requirement is explicitly a Mac downloadable app/package; native menubar aligns best with this expectation.
2. Delivers strongest install trust (Gatekeeper/notarization) and best background lifecycle management.
3. Lowest runtime overhead while collecting telemetry continuously.

**Pragmatic phased plan**
- Phase 1 (fast validation): stabilize telemetry + real OpenClaw usage in existing CLI; support `launchd` internal deployment.
- Phase 2 (ship target): Swift menubar productization, DMG pipeline, signing/notarization, onboarding UI.

---

## Release gate checklist (go/no-go)

- [ ] P0 OpenClaw usage/session integration complete and tested.
- [ ] Packaging architecture selected and tracked in implementation issue.
- [ ] Signed + notarized macOS artifact generated in CI.
- [ ] Telemetry schema versioned and validated (`cpuPct`, `mem*`, `gpu*`, usage/session fields).
- [ ] macOS compatibility validation completed on target OS/hardware matrix.
- [ ] Operational docs complete: install, autostart, logs, uninstall, troubleshooting.

## QA cycle update — 2026-02-16 17:40 America/Toronto

### Validation checks run this cycle

- ✅ `npm test --silent` passes (3/3 parser tests green).
- ✅ `node bin/idlewatch-agent.js --dry-run` succeeds and emits local NDJSON row.
- ✅ `npm run package:macos --silent` succeeds and builds `dist/IdleWatch.app`.
- ✅ `./dist/IdleWatch.app/Contents/MacOS/IdleWatch --dry-run` succeeds from packaged app scaffold.
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
