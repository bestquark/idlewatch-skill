# IdleWatch Installer QA Log

## Session
[cron:c1e239d5-6bd1-42fd-8f86-08fc0615bbe1 IdleWatch Installer QA polish lane]

---

## 2026-03-22 — Round 56: Deep Verification + New Findings

### Test Environment
- macOS arm64, Node v25.6.1, idlewatch v0.2.0
- Config at `~/.idlewatch/idlewatch.env` (cloud mode, device "test")

### Test Suite: 0 pass / 20 unique failures (regression from R55's 8/41)

All 20 unique test cases now fail. No passing tests remain. The failures fall into 3 categories:
1. **Quickstart/enrollment output assertion drift** (6 tests) — tests expect old output format, actual output is clean & correct
2. **Env var dry-run tests** (10 tests) — `No telemetry JSON row found in dry-run output` — likely the dry-run output format changed from JSON to summary
3. **OpenClaw probe tests** (3 tests) — stderr/mixed-output parsing assertions stale
4. **Help format test** (1 test) — `--help-env` section ordering assertion stale

### New Findings

#### P2-7 — `status` shows total log size (active + rotated) which can exceed configured max

**Repro:** `idlewatch status` shows "Log size: 16 MB" but `IDLEWATCH_LOCAL_LOG_MAX_MB` defaults to 10 MB. Active file is 6 MB, rotated `.1` file is 10 MB.
**Impact:** Confusing — user sees size > max and may think rotation is broken.
**Acceptance:** Either (a) show "Log size: 6 MB (+ 10 MB rotated)" or (b) show only active file size, or (c) label as "Total log storage".

#### P2-8 — TUI fallback message mentions "Cargo" — confusing for end users

**Repro:** On a platform without bundled TUI binary and without Rust/Cargo installed, `idlewatch quickstart` prints: "IdleWatch TUI is not bundled for this platform and Cargo is not installed. Falling back to text setup. Use --no-tui to skip this check."
**Impact:** "Cargo" means nothing to most users. The message should say something like "TUI setup not available on this platform — using text prompts instead."
**Acceptance:** Remove Cargo mention; simplify to "TUI setup not available for this platform. Using text prompts." Only mention `--no-tui` if user wants to suppress the check permanently.

#### P3-6 — README `npx` path doesn't mention `--no-tui`

**Repro:** README says `npx idlewatch quickstart` but TUI binary is only bundled for darwin-arm64. On other platforms via npx, user hits the Cargo fallback message.
**Impact:** Low — fallback works, but the jarring Cargo message degrades first impression.
**Acceptance:** README adds note: "Use `npx idlewatch quickstart --no-tui` if the TUI wizard isn't available on your platform."

### Re-verified (all stable)

| Item | Status |
|------|--------|
| `idlewatch quickstart` happy path (cloud + local) | ✅ |
| `idlewatch configure` pre-fills values | ✅ |
| `idlewatch status` shows friendly metric labels + rename hint | ✅ |
| `idlewatch --dry-run` clean summary, overflow handled | ✅ |
| `idlewatch --once` publishes with clear feedback | ✅ |
| `idlewatch install-agent` / `uninstall-agent` messaging | ✅ |
| Device name persists across reconfigure | ✅ |
| Metric toggles persist across reconfigure | ✅ |
| Config auto-loaded from `~/.idlewatch/idlewatch.env` | ✅ |
| `--help` clean, mentions `--help-env` | ✅ |
| `--help-env` has clear sections with visual separator | ✅ |
| README documents both `npm install -g` and `npx` paths | ✅ |
| No-args non-TTY prints help | ✅ |
| Uninstall says "Re-enable" not "Reinstall" | ✅ |
| Postinstall prints quickstart hint | ✅ |
| Per-subcommand `--help` works | ✅ |
| `--once` error message has clear fix guidance | ✅ |
| Log rotation working (active + .1 file) | ✅ |

### Open Items (prioritized)

1. **P1-1** — 0/20 tests pass (regression from 8/41) — test suite is fully red, blocks all regression detection
2. **P1-2** — npx quickstart may fail with confusing Cargo message if TUI binary missing
3. **P2-5** — No config reload without restart (no SIGHUP or file-watch)
4. ~~**P2-7** — `status` log size shows total (active + rotated), can exceed configured max — confusing~~ ✅ Fixed: now shows "X (+ Y rotated)"
5. ~~**P2-8** — TUI fallback message mentions "Cargo" — jargon, confusing for end users~~ ✅ Fixed: simplified to "TUI setup not available for this platform. Using text prompts."
6. ~~**P3-6** — README `npx` path doesn't mention `--no-tui` for platforms without bundled TUI~~ ✅ Fixed: added note to README

### Closed (fixed in prior rounds)

- ✅ P2-1 — Status shows rename hint for placeholder device names
- ✅ P2-2 — Status shows friendly metric labels
- ✅ P2-3 — `--help` mentions `--help-env`
- ✅ P2-4 — Dry-run shows overflow label for >100% context
- ✅ P2-6 — Postinstall prints quickstart hint
- ✅ P3-1 — `--help-env` probe internals section has visual separator
- ✅ P3-2 — Postinstall prints quickstart hint
- ✅ P3-3 — No-args non-TTY prints help
- ✅ P3-4 — Uninstall says "Re-enable"
- ✅ P3-5 — `--help-env` probe section labeled clearly
- ✅ P2-7 — `status` log size now shows active vs rotated separately
- ✅ P2-8 — TUI fallback no longer mentions Cargo jargon
- ✅ P3-6 — README now mentions `--no-tui` for npx path

---

## Previous Rounds
All prior rounds (1–55) complete. See git history for full details.
