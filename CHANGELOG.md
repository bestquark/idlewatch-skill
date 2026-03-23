# IdleWatch Installer & CLI Changelog

## [Unreleased]

### Docs
- **Documentation**: Completed Round 71 polish cycle verification for v0.2.0
  - All Priority 1, 2, and 3 items verified green in QA passes R69-R71
  - Ready for production deployment ✅

---

## [v0.2.0] - 2026-03-23

**Focus**: UX polish — setup/reconfigure usability, validation messages, saved config handling, startup/install quality of life

### What Was Implemented in v0.2.0

#### Priority 1: High Severity
- **H1.** Device name persists correctly after reauth/reinstall ✅
- **H2.** Config reload behavior is predictable (documented reload commands available) ✅

#### Priority 2: Medium Severity
- **M1.** Status screen showing device/link/metric state (visible in CLI/UI) ✅
- **M2.** Explicit test publish flow in setup/control (`idlewatch --test-publish`) ✅
- **M3.** Clearer success confirmation after first link/publish (messages include device name/status) ✅
- **M4.** Test publish errors are clear and actionable (formatted messages with API key validation) ✅

#### Priority 3: Low Severity (As-designed behaviors)
- **L1.** Settings/edit flow for changing metrics without re-entering unchanged values ✅
- **L2.** Launch-agent install/uninstall is clear and safe ✅
- **L3.** Local storage location is clear/expected (config path printed at startup) ✅

---

## Previous Versions

### [v0.1.x] - Earlier releases

**Focus**: Core pipeline functionality, basic telemetry path establishment

*Details available in git history.

---

## Upcoming Polish Cycle: Round 72+

**Status**: Pending — awaiting new friction points from QA monitoring or user feedback

**Recommended frequency**: Bi-weekly during active development OR on-demand when friction emerges