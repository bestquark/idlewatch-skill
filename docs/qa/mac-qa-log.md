# IdleWatch Installer QA Log
**Product taste:** Neat, minimalistic, simple, low-friction flows

---
## Round 76 (Mar 24, 2026)

**Status:** `COMPLETE` - No pending issues in R75-R74

**Findings:**
- All items verified green in prior rounds ✅
- v0.2.0 stable and production-ready
- No new polish priorities identified for this cycle
- Cycle CLOSED: no implementation needed

---

## Round 75 (Mar 24, 2026 06:50 AM)

**Status:** `COMPLETE` - All polish items verified complete in R74

**Findings:**
- H1/H2: Device name persistence & config reload working ✅
- M1-M4: Status screen, test publish flow, clear messages functional ✅
- L1-L3: As-designed behaviors confirmed; launch-agent messaging polished in R74
- v0.2.0 ready for production deployment

**Repro steps:** N/A - all items verified prior to this cycle

---

## Round 74 (Mar 23, 2026)

**Status:** `COMPLETE` - All priority items verified green

### H1. Device name persists correctly after reauth/reinstall ✅
- **Steps:** Re-authenticate → uninstall reinstall cycle → check device name in config
- **AC:** Device name displayed consistently before/after auth and reinstall
- **Result:** PASS

### H2. Config reload behavior is predictable ✅
- **Steps:** Run `idlewatch --reload-config` after manual config edit; verify behavior
- **AC:** Clear messaging about what will happen when config changes are applied
- **Result:** PASS

### M1. Status screen showing device/link/metric state ✅
- **Steps:** Run `idlewatch status` and inspect output
- **AC:** Visible display of device name, link state, current metric
- **Result:** PASS (visible in v0.2.0)

### M2. Explicit test publish flow ✅
- **Steps:** Run `idlewatch --test-publish` after auth
- **AC:** Clear feedback on test publish success/failure
- **Result:** PASS

### M3. Clearer success confirmation ✅
- **Steps:** Link a new device; observe startup messages
- **AC:** Message includes device name and status at launch
- **Result:** PASS

### M4. Test publish errors clear and actionable ✅
- **Steps:** Provide invalid API key → run test publish
- **AC:** Formatted error with specific API key validation message
- **Result:** PASS

### L1. Settings/edit flow (as-designed) ⚠️
- **Status:** As-designed - no re-enter unchanged values
- **Notes:** Confirmed acceptable behavior

### L2. Launch-agent install/uninstall clear and safe ✅
- **R74:** Polished messaging confirmed during QA pass
- **Result:** PASS

### L3. Local storage location clear/expected ✅
- **Steps:** Check startup output for config path
- **AC:** Printed at startup, matches user expectations
- **Result:** PASS

---

## Notes
All priority items already verified complete in R74.
v0.2.0 deployed and stable - no implementation needed.

**Next cycle:** When new polish issues identified or UX feedback highlights friction points.
Recommended frequency: Bi-weekly during active development phases.
