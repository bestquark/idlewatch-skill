# IdleWatch Installer Polish Plan

**Focus:** UX polish (no auth/backend redesigns)
**Repo:** `/Users/luismantilla/.openclaw/workspace/idlewatch-skill`

---

## Priority 1: High Severity

### H1. Device name persists correctly after reauth/reinstall
- **Severity:** High
- **Issue:** Users may lose their device name across sessions/config resets
- **Impact:** Better UX, less repetitive configuration
- **Fix Notes:** Ensure device ID/name stored in persistent config before auth, restored on reinstall/reboot

### H2. Config reload behavior is predictable
- **Severity:** High
- **Issue:** Unclear if/when config reloads during runtime vs requiring restart
- **Impact:** Prevents frustration from missing config updates
- **Fix Notes:** Document clear reload commands (if needed), or implement automatic watch

---

## Priority 2: Medium Severity

### M1. Add status screen showing device/link/metric state
- **Severity:** Medium
- **Issue:** Users have no visibility into local device/linkage status beyond auth success
- **Impact:** Reduces support queries, self-verifies setup success
- **Fix Notes:** Display device name, linked status, last publish result, enabled metrics

### M2. Add explicit test publish flow in setup/control
- **Severity:** Medium
- **Issue:** No obvious path to verify connection actually works end-to-end
- **Impact:** Reduces anxiety, catches issues before user sees them on website
- **Fix Notes:** CLI command or UI action that sends sample data with clear feedback

### M3. Clearer success confirmation after first link/publish
- **Severity:** Medium
- **Issue:** Vague success messages don't clearly indicate what succeeded and what happened next
- **Impact:** Reduces confusion, builds trust
- **Fix Notes:** Show device name, status, last publish result with optional dashboard link

### M4. Test publish errors are clear and actionable
- **Severity:** Medium
- **Issue:** Vague error messages don't tell users what to try
- **Impact:** Reduces support tickets, empowers self-service fixes
- **Fix Notes:** Format/API key validation with specific next-step instructions

---

## Priority 3: Low Severity

### L1. Settings/edit flow for changing metrics without re-entering unchanged values
- **Severity:** Low
- **Issue:** Changing metrics requires full reconfiguration instead of partial update
- **Impact:** Lower friction for tuning after initial setup
- **Fix Notes:** Partial config updates should preserve existing values

### L2. Launch-agent install/uninstall is clear and safe
- **Severity:** Low
- **Issue:** Users may not understand when/why agent gets installed/removed
- **Impact:** Avoids confusion around background service state
- **Fix Notes:** Clear output messages, predictable behavior, rollback-safe

### L3. Local storage location is clear/expected
- **Severity:** Low
- **Issue:** Users may not know where config lives
- **Impact:** Self-service fix capability
- **Fix Notes:** Print/config location visible at startup with instructions to edit directly

---

## Round 71 Status: COMPLETE ✅

**All items verified green in Round 71 QA pass.**
- H1/H2: Config persistence & reload working (verified R69)
- M1-M4: Status screen, test publish flow, clear messages functional (verified R70-R71)
- L1-L3: As-designed behaviors confirmed; launch-agent messaging polished in R71
- v0.2.0 ready for production deployment

**Last updated:** 2026-03-23T05:35Z
