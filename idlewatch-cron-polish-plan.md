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

## Cycle Status: Cycle 87 - COMPLETE ✅

**Finding:** One more genuinely tiny loaded-background status truthfulness fix cleared the bar in the live checkout.
- After `idlewatch install-agent` has already applied the current saved setup, `idlewatch status` no longer contradicts itself by also saying `Apply saved config`
- The apply hint now shows only when the saved config is actually newer than the installed launch-agent plist, which keeps post-reconfigure guidance intact without muddying the happy path
- The loaded-background confirmation screen now stays calmer and more literal: `Background: on (waiting for next check)` plus `Background: already on`
- Setup/reconfigure flows, saved-config handling, startup/install quality of life, and the now-working telemetry path remain otherwise unchanged
- The matching source-checkout regression assertion was updated so this loaded-background happy path does not drift back

**Last updated:** Friday, March 27th, 2026 — 4:58 PM (America/Toronto)
---

## Next Polish Cycle

When to run next:
- New polish issues identified in QA monitoring
- User feedback highlights UX friction points
- Config/behavior changes requested

**Recommended frequency:** Bi-weekly during active development phases
