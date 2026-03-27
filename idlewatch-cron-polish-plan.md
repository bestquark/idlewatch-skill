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

## Cycle Status: Cycle 92 - COMPLETE ✅

**Finding:** One more genuinely tiny source-checkout `status` literalness fix still cleared the bar in the live checkout.
- In saved-setup `status` with no samples yet, the `Test:` hint now stays on the same calmer product-command shape as the rest of the screen: `idlewatch --once`
- That removes the last raw repo-script fallback from this no-sample status block, so `Test`, `Run now`, and background-mode hints now read as one neat product-shaped group instead of mixing `node bin/idlewatch-agent.js --once` with calmer `idlewatch ...` commands
- The change is output-only: no setup behavior, saved-config handling, launch-agent behavior, packaging shape, auth flow, or the now-working telemetry path changed
- Matching `status` regression coverage now asserts the calmer no-sample `Test:` hint in source checkouts so this small copy seam does not drift back

**Last updated:** Friday, March 27th, 2026 — 6:15 PM (America/Toronto)
---

## Next Polish Cycle

When to run next:
- New polish issues identified in QA monitoring
- User feedback highlights UX friction points
- Config/behavior changes requested

**Recommended frequency:** Bi-weekly during active development phases
