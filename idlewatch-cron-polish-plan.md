# IdleWatch Installer Polish Plan

**Focus:** UX polish (no auth/backend redesigns)
**Repo:** `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
---

## Priority 1: High Severity

### H1. Device name persists correctly after reauth/reinstall
- **Severity:** ✅ Verified - working in v0.2.0

### H2. Config reload behavior is predictable
- **Severity:** ✅ Verified - documented reload commands available

## Priority 2: Medium Severity

### M1. Add status screen showing device/link/metric state
- **Severity:** ✅ Verified - visible in v0.2.0

### M2. Add explicit test publish flow in setup/control
- **Severity:** ✅ Verified - CLI `idlewatch --test-publish` available

### M3. Clearer success confirmation after first link/publish
- **Severity:** ✅ Verified - clear messages with device name/status in v0.2.0

### M4. Test publish errors are clear and actionable
- **Severity:** ✅ Verified - formatted/API key validation provided in v0.2.0
---

## Priority 3: Low Severity

### L1. Settings/edit flow for changing metrics without re-entering unchanged values
- **Status:** ⚠️ As-designed (current behavior)

### L2. Launch-agent install/uninstall is clear and safe
- **Severity:** ✅ Verified - polished messaging confirmed in Round 75 QA pass

### L3. Local storage location is clear/expected
- **Severity:** ✅ Verified - config path printed at startup
---

## Cycle Status: Cycle 93 - COMPLETE ✅

**Finding:** Fresh live verification did not surface another small product-facing installer/CLI issue worth shipping.
- The currently logged true-`npx` next-step concern no longer reproduces in a clean-home pass: `quickstart --no-tui`, saved-setup `status`, and `configure --no-tui` all keep one-off-safe `npx idlewatch ...` foreground/configure hints and a separate durable install handoff
- `install-agent --help` and runtime also still keep the intended split: `Set up now: npx idlewatch quickstart --no-tui`, `Install once: npm install -g idlewatch`, then `idlewatch install-agent`
- That means this cycle's highest-value move was to avoid speculative churn, preserve the now-working telemetry path, and log the verification cleanly in QA instead of forcing another low-value code edit

**Last updated:** Friday, March 27th, 2026 — 6:25 PM (America/Toronto)
---

## Next Polish Cycle

When to run next:
- New polish issues identified in QA monitoring
- User feedback highlights UX friction points
- Config/behavior changes requested

**Recommended frequency:** Bi-weekly during active development phases
