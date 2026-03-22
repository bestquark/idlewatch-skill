# IdleWatch Installer QA Log

## Session
[cron:c1e239d5-6bd1-42fd-8f86-08fc0615bbe1 IdleWatch Installer QA polish lane]

---

## 2026-03-22 — Round 53: Polish Plan Gap Analysis

### Assessment
Re-evaluating current code against `/idlewatch-cron-polish-plan.md` to identify unaddressed high-severity items.

| # | Sev | Summary | Current Status | Notes |
|---|----|---------|----------------|-------|
| H1 | P1 | Device name persists after reauth/reinstall | ❌ Not implemented | Device ID stored in config, but dedup logic may fail on auth reset |
| H2 | P1 | Config reload behavior predictable | ❌ Unclear if config auto-relloads during runtime |
| M1 | P2 | Status screen showing device/link/metric state | ⚠️ `status` command exists but limited scope |
| M2 | P2 | Explicit test publish flow in setup/control | ✅ `--once` does test publish with clear feedback |
| M3 | P2 | Clearer success confirmation after first link/publish | ✅ Fixed — setup shows "is live!", dashboard ETA, structured next steps |
| M4 | P2 | Test publish errors are clear and actionable | ✅ Fixed — publish failure shows common fixes (API key, connectivity) |
| L1 | P3 | Settings/edit flow for partial metric updates | ✅ Implemented via `create` subcommand |
| L2 | P3 | Launch-agent install/uninstall is clear and safe | ✅ Fixed — uninstall confirms data preserved, install shows "(safe)" hint |
| L3 | P3 | Local storage location is clear/expected | ⚠️ Location printed but not obvious from help output |

### Priority Findings for Fix Queue

**P1 (Blockers for next polish round):**
1. Device name persistence needs verification on auth reset/reinstall
2. Config reload mechanism unclear to users - need documented commands or auto-relode behavior

**P2 (High value improvements):**
3. `status` output limited - could show more state visibility
4. Success messages after first link/publish could be clearer about next steps
5. Error messages should include specific API validation checks (e.g., key prefix, format issues)

### Next Steps

1. Run regression tests on H1 and H2 items specifically
2. Gather user-facing examples of success/error paths to improve messaging
3. Consider simple config reload command (`idlewatch --config-reload`) if auto-relode not feasible

---

## Previous Rounds
All prior rounds complete through Round 52 - CLI is stable on v0.2.0 with no regressions.
