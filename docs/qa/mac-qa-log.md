# IdleWatch Installer QA Log
**Focus:** UX polish findings (installer/CLI flow quality)
**Status:** Completed Round 75 — v0.2.0 ready for production.
---

## Cycle Summary: Round 75 (Completed)

| Priority | Issue | Status | Notes |
|----------|-------|--------|-------|
| H1 | Device name persists after reauth/reinstall | ✅ Verified | Working in v0.2.0 |
| H2 | Config reload behavior predictable | ✅ Verified | Documented commands available |
| M1 | Status screen showing device/link/metric state | ✅ Verified | Visible in v0.2.0 |
| M2 | Explicit test publish flow | ✅ Verified | `idlewatch --test-publish` available |
| M3 | Clearer success confirmation after first link/publish | ✅ Verified | Messages with device name/status present |
| M4 | Test publish errors clear and actionable | ✅ Verified | Formatted API key validation provided |
| L1 | Settings/edit flow for changing metrics | ⚠️ As-designed | Current behavior accepted per design |
| L2 | Launch-agent install/uninstall clear/safe | ✅ Verified | Polished messaging confirmed in R74 |
| L3 | Local storage location clear/expected | ✅ Verified | Config path printed at startup |

**Verdict:** v0.2.0 ready for production deployment. No pending fixes.

---

### To-Do for Next Polish Cycle
When to run next:
- New polish issues identified in QA monitoring
- User feedback highlights UX friction points
- Config/behavior changes requested

**Recommended frequency:** Bi-weekly during active development phases.

---

## Current Version Status

- **Version:** v0.2.0
- **Status:** Ready for production deployment
- **Last QA Pass:** 2026-03-24T10:30Z (America/Toronto)
- **Next Cycle:** Pending new findings or user feedback
