# IdleWatch Installer QA Log

## Session
[cron:c1e239d5-6bd1-42fd-8f86-08fc0615bbe1 IdleWatch Installer QA polish lane]

---

## 2026-03-22 — Round 54: Full Polish Audit Against Plan

### Test Environment
- macOS arm64, Node v25.6.1, idlewatch v0.2.0
- Existing config at `~/.idlewatch/idlewatch.env` (cloud mode, device "test")
- 15 MB local log, LaunchAgent not installed

### Regression: 41 test failures

Unit tests show 41 failures vs 6 passes. Most failures appear to be assertion drift in enrollment/quickstart tests (expected output patterns don't match current output format) and OpenClaw probe tests. Not blocking user-facing flows but test suite needs attention.

**Repro:** `node --test --test-concurrency=1 'test/*.test.mjs'`

---

### Findings (prioritized)

#### P1 — Blocking / First-Run Impact

| # | Issue | Repro | Acceptance Criteria |
|---|-------|-------|---------------------|
| P1-1 | **Test suite 41/47 failures** — enrollment tests assert old output patterns; validate-dry-run-schema fails when OpenClaw usage is off. Tests don't catch real regressions if they're all red. | `npm run test:unit` | ≤5 known-skip failures; all enrollment and dry-run tests green |
| P1-2 | **`npx idlewatch quickstart` path unclear for first-time users** — README says `npm install -g idlewatch` then `idlewatch quickstart`, but npx quickstart would launch TUI which may fail on npx's temp install (no bundled TUI binary for all platforms). No guidance on what happens. | `npx idlewatch quickstart` on fresh machine | README documents npx behavior clearly; `--no-tui` recommended for npx; or TUI gracefully falls back |

#### P2 — High Value Polish

| # | Issue | Repro | Acceptance Criteria |
|---|-------|-------|---------------------|
| P2-1 | ✅ **Device name "test" — no obvious way to rename** — `status` now shows rename hint when device name is a placeholder. | `idlewatch status` → shows "test", includes rename hint | `status` output includes `Rename: idlewatch configure` when device name looks like a placeholder |
| P2-2 | ✅ **Status output now shows friendly metric labels** — CPU, Memory, GPU, Temperature, OpenClaw activity/tokens/runtime instead of internal target names. | `idlewatch status` | Metrics line uses friendly labels |
| P2-3 | **`--help` doesn't mention `--help-env`** — the env var reference is hidden. Main help says "Show this help" but doesn't hint that `--help-env` exists for advanced config. | `idlewatch --help` | Add one line: `--help-env   Show all environment variables` (already present, confirmed ✅) |
| P2-4 | ✅ **Dry-run "157% context used" now shows overflow label** — displays "100%+ context used (157% overflow)" for values >100%. | `idlewatch --dry-run` | Values >100% shown as "100%+ (overflow)" |
| P2-5 | **Config reload: no documented way to reload config without restart** — if user edits `~/.idlewatch/idlewatch.env` while agent is running, changes don't take effect. No `reload` command exists. | Edit env file while `idlewatch run` is active | Either: (a) document that restart is required, or (b) add SIGHUP reload, or (c) re-read env file each cycle |

#### P3 — Minor Polish

| # | Issue | Repro | Acceptance Criteria |
|---|-------|-------|---------------------|
| P3-1 | **`--help-env` lists too many env vars** — 30+ vars including Firebase emulator, probe internals, stale thresholds. Overwhelming for 99% of users. | `idlewatch --help-env` | Split into "Common" (already done ✓) but "Tuning" and "Probe internals" sections should say "(advanced — rarely needed)" more prominently |
| P3-2 | **Postinstall only installs menubar app** — `npm install -g idlewatch` silently tries to install the menubar app. No quickstart prompt or hint. User may not know they need to run `quickstart` next. | `npm install -g idlewatch` | Postinstall prints: "Run `idlewatch quickstart` to set up this device." |
| P3-3 | ✅ **`idlewatch` with no args in non-TTY now prints help** instead of silently doing nothing. | `echo "" \| idlewatch` | Print help when stdin is not TTY and no subcommand given |
| P3-4 | ✅ **Uninstall-agent now says "Re-enable"** instead of "Reinstall". | `idlewatch uninstall-agent` | Changed "Reinstall" to "Re-enable" |

#### P3 — Confirmed Working (from polish plan)

| # | Item | Status |
|---|------|--------|
| ✅ | Test publish via `--once` with clear feedback | Working — shows "Sample collected and published" |
| ✅ | Setup success message shows device name, mode, config path, next steps | Working — clean structured output |
| ✅ | Setup failure message shows common fixes | Working — API key check, connectivity hint |
| ✅ | Launch-agent install shows "(safe)" removal hint | Working |
| ✅ | Launch-agent uninstall confirms data preserved | Working |
| ✅ | Device name persists from existing config on reconfigure | Working — `existingConfig.deviceName` reused |
| ✅ | Metric toggle persists across reconfigure | Working — targets re-read from env file |
| ✅ | Config auto-loaded from `~/.idlewatch/idlewatch.env` on startup | Working |
| ✅ | Per-subcommand `--help` works | Working for all subcommands |
| ✅ | `idlewatch configure` pre-fills existing values | Working |

---

### Summary

The user-facing CLI is solid for happy-path flows. Main risks:
1. **Test suite is almost entirely broken** — makes it hard to catch regressions (P1-1)
2. **npx first-run path untested/undocumented** (P1-2)
3. **Status output uses internal jargon** for metrics (P2-2)
4. **Config reload story is missing** (P2-5)

Everything from the polish plan's "suggested first polish tickets" is either done or partially done:
- ✅ #1 (test publish via `--once`)
- ⚠️ #2 (status screen exists but limited — see P2-1, P2-2)
- N/A #3 (web dashboard — out of scope for installer QA)
- ✅ #4 (success confirmation after first link)
- ⚠️ #5 (README exists but npx path unclear — see P1-2)
- ✅ #6 (settings/edit via `configure`)

---

## Previous Rounds
All prior rounds complete through Round 53 — CLI is stable on v0.2.0 with no regressions in user-facing behavior.
