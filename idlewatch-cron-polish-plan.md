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

## Cycle Status: Cycle 79 - COMPLETE ✅

**Finding:** No new small, low-risk installer/CLI polish fix in the requested lane cleared the bar for a worthwhile change in the live checkout.
- Focused installer/CLI regression subset still passes cleanly (**87 passed, 0 failed**)
- Main help, setup/reconfigure/status/install/uninstall help, saved-config reuse, launch-agent install-before-setup behavior, uninstall retention messaging, `--test-publish`, and `npx` durable-install guidance still read cleanly
- The requested polish areas remain in good shape: setup/reconfigure usability, validation messages, saved-config handling, startup/install quality of life, and tiny reliability behavior
- The now-working telemetry path remains untouched
- Highest-value remaining housekeeping item is operational, not product-facing: the cron payload should point at the live checkout path

**Last updated:** Thursday, March 26th, 2026 — 4:45 PM (America/Toronto)
---

## Next Polish Cycle

When to run next:
- New polish issues identified in QA monitoring
- User feedback highlights UX friction points
- Config/behavior changes requested

**Recommended frequency:** Bi-weekly during active development phases
