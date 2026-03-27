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

## Cycle Status: Cycle 91 - COMPLETE ✅

**Finding:** One more genuinely tiny real-`npx status` presentation fix still cleared the bar in the live checkout.
- In real `npx` status screens, the durable-install commands now sit as visibly nested lines under `For background mode:` instead of reading like a flatter sibling list
- This keeps the one-off `Run now: npx idlewatch run` path visually separate from the durable `npm install -g idlewatch` → `idlewatch install-agent` path at the exact status/check-your-work moment where copy-paste clarity matters most
- The change is output-only: no setup behavior, saved-config handling, launch-agent behavior, packaging shape, auth flow, or the now-working telemetry path changed
- Matching `status` regressions now assert the nested two-line block in both the no-sample and saved-sample real-`npx` paths so this visual hierarchy does not quietly drift back

**Last updated:** Friday, March 27th, 2026 — 5:50 PM (America/Toronto)
---

## Next Polish Cycle

When to run next:
- New polish issues identified in QA monitoring
- User feedback highlights UX friction points
- Config/behavior changes requested

**Recommended frequency:** Bi-weekly during active development phases
