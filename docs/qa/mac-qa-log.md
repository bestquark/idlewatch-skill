# IdleWatch Mac QA Readiness Log

Date: 2026-02-16  
Owner: QA (Mac distribution + telemetry + OpenClaw integration)

## Scope audited

- Repository: `idlewatch-skill`
- CLI runtime and packaging readiness for Mac downloadable distribution
- Telemetry signal quality: CPU / memory / GPU
- OpenClaw integration readiness for LLM usage and session stats

## Evidence gathered

- `npm test` passes after dependency install (`validate:bin`, `smoke:help`).
- `node bin/idlewatch-agent.js --dry-run` runs and emits one sample row.
- Current dry-run row includes `tokensPerMin` random placeholder and often `gpuPct: null` on macOS.
- CI currently runs on `ubuntu-latest` only (Node 20/22), no macOS CI coverage.

---

## Prioritized findings

### P0 — Blocker: OpenClaw usage metric is synthetic (not shippable)

**Finding**
- `tokensPerMin` uses `tokensPerMinMock()` (random number), not real OpenClaw usage/session data.
- This makes dashboard conclusions invalid and prevents trust in usage analytics.

**Risk**
- Product/ops decisions based on fake LLM usage data.
- Cannot claim OpenClaw integration completeness.

**Acceptance criteria (must pass before ship)**
- [ ] Replace mock function with real collector wired to OpenClaw session/usage source.
- [ ] Emit stable identifiers: `sessionId`, `agentId` (or equivalent), and timestamp alignment fields.
- [ ] Document exact semantics for each usage field (prompt tokens, completion tokens, total tokens, requests/min).
- [ ] Add unit/integration test proving non-random deterministic behavior under fixed fixture input.
- [ ] Fail-safe behavior documented for missing OpenClaw source (explicit `null` + `integrationStatus`, no synthetic fallback).

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
- `cpuPct()` uses `Atomics.wait` sleep window (blocking) each sample.

**Risk**
- Can delay other tasks and reduce responsiveness if collector expands.

**Acceptance criteria**
- [ ] Replace with non-blocking delta sampling between ticks or async scheduler.
- [ ] Verify jitter and sampling overhead under 1s and 10s intervals.
- [ ] Add performance test documenting collector overhead budget (<1% CPU on idle machine target).

---

### P2 — Medium: CI lacks macOS validation and packaging checks

**Finding**
- CI runs only Ubuntu and does not execute dry-run telemetry assertions.

**Risk**
- Mac-specific regressions undetected; packaging pipeline breaks late.

**Acceptance criteria**
- [ ] Add `macos-latest` job for smoke + dry-run + parser tests.
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
