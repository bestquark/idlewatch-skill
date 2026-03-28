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

## Cycle Status: Cycle 97 - COMPLETE ✅

**Finding:** Re-ran the exact current installer/CLI polish scope in the live checkout and did not surface another product-facing issue worth shipping.
- Install-before-setup still stays truthful and low-noise (`Background integration installed`, then `stays off for now`)
- Saved setup + reconfigure still keep device identity continuity and metric persistence visible inline
- Global npm-install handoff still leads with `idlewatch quickstart`, with `idlewatch quickstart --no-tui` kept secondary
- One-off setup/run/configure hints still stay literally runnable as `npx idlewatch ...`
- The durable background-mode handoff still stays separate on `npm install -g idlewatch`, then `idlewatch install-agent`
- Standalone macOS uninstall still stays truthful in a fresh no-setup/no-log home (`Saved config would live ...`, `Logs would go in ...`)
- Uninstall remains a calm reversible off-ramp, and the now-working telemetry path stayed untouched
- The right move this cycle was to log the clean verification pass and avoid speculative churn that might disturb the working setup/install path

**Last updated:** Friday, March 27th, 2026 — 10:40 PM (America/Toronto)
---

## Next Polish Cycle

When to run next:
- New polish issues identified in QA monitoring
- User feedback highlights UX friction points
- Config/behavior changes requested

**Recommended frequency:** Bi-weekly during active development phases
