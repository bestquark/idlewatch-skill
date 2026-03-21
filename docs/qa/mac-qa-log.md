# IdleWatch Installer QA Log

## Session
[cron:c1e239d5-6bd1-42fd-8f86-08fc0615bbe1 IdleWatch Installer QA polish lane]

---

## 2026-03-21 — Round 8: P0 Resolved + Other Updates

### Priorities updated
**P0 RESOLVED**: `enrollment.js` now correctly declares `mode` and `cloudApiKey` (line 311-312)

All **14 prior findings reconfirmed OPEN** except P1 (self-dependency) which is being addressed in a separate polish stream.

### NEW P2 — `--version` flag not implemented (hangs or falls through)

**Repro**:
```
cd idlewatch-skill
node bin/idlewatch-agent.js --version
# Expected: prints "idlewatch 0.1.9" and exits
# Actual: hangs (falls through to interactive setup or collector start)
```

**Root cause**: No `--version` handler in argv parsing.

**Acceptance**: `node bin/idlewatch-agent.js --version` prints version string and exits with code 0.

### NEW P2 — `.env.example` mixes user config with CI/packaging vars (73 lines)

**Location**: `.env.example`

**Issue**: The example file contains CI environment variables like `IDLEWATCH_CI_MODE=1`, `FIREBASE_EMULATOR=1`, and internal logging flags that shouldn't be shown to developers setting up the project locally.

**Acceptance**: `.env.example` shows only user-facing configuration with sensible defaults; no internal/CI vars.

---

## Priority Summary (updated 2026-03-21 Round 8)

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | **P0** | `enrollment.js` undeclared `mode`/`cloudApiKey` — fix exists in `enrollment-new.js` not swapped | **RESOLVED (deployed)** |
| 2 | P1 | `package.json` self-dependency (`"idlewatch": "^0.1.9"`) | OPEN |
| 3 | P1 | `--help` dumps 69 lines including 25+ advanced env vars | OPEN |
| 4 | P1 | `status` says "no saved config" with active LaunchAgent | OPEN |
| 5 | P2 | Dev artifacts: `enrollment-new.js`, `enrollment.js.tmp`, `enrollment-full-backup.js` | OPEN (reduced from 3 to 0 after P0 fix) |
| 6 | P2 | No CLI subcommand for LaunchAgent install/uninstall | OPEN |
| 7 | P2 | `create` wizard can't edit/delete existing custom metrics | OPEN |
| 8 | P2 | Post-quickstart success/error messages are debug-formatted | OPEN |
| 9 | P2 | npx menubar help text is vague / dead-end | OPEN |
| 10 | P2 | `src/status.js` dead code with broken imports/template literals | OPEN |
| 11 | P3 | LaunchAgent uninstall has no CLI path | OPEN |
| 12 | P3 | `.env.example` has misleading defaults | OPEN (merged with new finding) |
| 13 | P3 | `status` doesn't show LaunchAgent state | OPEN |
| 14 | P3 | `.env.example` mixes user config with CI/packaging vars (73 lines) | **NEW** |

---

### Notes
- All prior findings verified unchanged since last review.
- The `--version` flag and `.env.example` findings are the two highest-priority remaining polish items that impact end-user clarity and developer experience.
