# IdleWatch Installer Polish Plan

**Focus:** UX polish (no auth/backend redesigns)  
**Repo:** `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`  
---

## Priority 1: High Severity

All verified as stable in QA cycles R798-R800 ✅

### H1. Device name persists correctly after reauth/reinstall
- **Severity:** ✅ Verified - working in v0.2.0

### H2. Config reload behavior is predictable
- **Severity:** ✅ Verified - documented reload commands available

## Priority 2: Medium Severity

All verified as stable in QA cycles R798-R800 ✅

### M1. Add status screen showing device/link/metric state
- **Severity:** ✅ Verified - visible in v0.2.0

### M2. Add explicit test publish flow in setup/control
- **Severity:** ✅ Verified - CLI `idlewatch --test-publish` available

### M3. Clearer success confirmation after first link/publish
- **Severity:** ✅ Verified - clear messages with device name/status in v0.2.0

### M4. Test publish errors are clear and actionable
- **Severity:** ✅ Verified - formatted/API key validation provided in v0.2.0

## Priority 3: Low Severity

### L1. Settings/edit flow for changing metrics without re-entering unchanged values
- **Status:** ⚠️ As-designed (current behavior)

### L2. Launch-agent install/uninstall is clear and safe
- **Severity:** ✅ Verified - polished messaging confirmed in Round 75 QA pass

### L3. Local storage location is clear/expected
- **Severity:** ✅ Verified - config path printed at startup

---

## Cycle Status: COMPLETE ✅ (Stable)

All remaining polish items verified in QA cycles R798-R800. The current checkout delivers:
- Plain `quickstart` as the lead line across help, install-before-setup, and global npm postinstall
- Truthful install-before-setup messaging (`✅ Background integration installed.` + honest "setup isn't saved yet" disclaimers)
- Device ID persistence through rename/reconfigure and visible inline where continuity matters
- Clean metric-toggle persistence in `status` output for both saved-setup and running-background flows
- Low-friction local-only `--test-publish` flow that stays intentionally lightweight
- Consistent copy across main CLI, global npm postinstall (`idlewatch install-agent   # turn on background mode after setup`), and standalone macOS scripts
- The now-working telemetry path remains untouched; all polish stayed scoped to UX/copy surfaces

**Last updated:** Sunday, March 29th 2026 — 4:45 AM (America/Toronto) | Status: Cycle R809 complete — all items verified stable. Recommendation: disable automated cron as no pending fixes remain.
