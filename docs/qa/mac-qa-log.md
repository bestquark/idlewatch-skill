# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R77 (polish-focused verification pass)

## Status: CLOSED - small polish fixes shipped

These were small UX/documentation gaps, not architecture problems. The highest-priority low-risk fixes are now implemented.

---

## Checklist
- [x] H1. Clarify config reload/apply behavior
- [x] M1. Reconcile `--test-publish` docs vs actual CLI
- [x] M2. Simplify LaunchAgent no-config messaging
- [x] L1. Tighten install-mode command wording across README/postinstall/docs

---

## H1. Config reload behavior is now explicit
**Priority:** High
**Status:** ✅ Fixed in R77

**What changed:**
- Removed the dead internal `reloadRequested` affordance from `bin/idlewatch-agent.js`.
- `configure` / `reconfigure` / `status` help now state the real rule: saved config applies on the next start.
- README and packaged LaunchAgent docs now tell users how to apply config changes to a running background agent: re-run `idlewatch install-agent` (or the packaged install script) to restart it with saved config.

**Result:**
- No implied live reload behavior.
- One clear mental model: save config now, apply on next start.

---

## M1. `--test-publish` now exists for real
**Priority:** Medium
**Status:** ✅ Fixed in R77

**What changed:**
- Added `--test-publish` as a real alias for `--once`.
- CLI help, README, and status hints now document the alias consistently.

**Result:**
- QA/docs no longer overclaim.
- Users can use either `idlewatch --once` or `idlewatch --test-publish`, with the same behavior.

---

## M2. LaunchAgent install script now tells one clean story
**Priority:** Medium
**Status:** ✅ Fixed in R77

**What changed:**
- Removed the confusing Login Items/System Settings wording from `scripts/install-macos-launch-agent.sh`.
- No-config installs now clearly say:
  - the LaunchAgent is already installed,
  - quickstart is the next step,
  - then re-run the install script once to restart with the new config.

**Result:**
- Packaged setup/reconfigure flow is simpler.
- No mixed signals about multiple startup mechanisms.

---

## L1. Install-path wording is cleaner across surfaces
**Priority:** Low
**Status:** ✅ Fixed in R77

**What changed:**
- `scripts/postinstall.mjs` now distinguishes:
  - global install → `idlewatch ...`
  - one-off use → `npx idlewatch ...`
  - packaged app → bundled command/docs
- `docs/onboarding-external.md` adds the same rule of thumb.
- README/background-install copy now better matches the next-start/restart model.

---

## Validation notes
- Targeted CLI/help and behavior checks should cover this lane.
- No auth/ingest redesign.
- No packaging rewrite.
- Telemetry path preserved.

---

## Summary

**Shipped in this polish pass:**
1. Honest next-start config behavior instead of implied reload.
2. Real `--test-publish` alias for the existing one-shot publish check.
3. Cleaner LaunchAgent no-config guidance.
4. Slightly better install-mode wording across user-facing surfaces.

**Conclusion:** R77 closed.
