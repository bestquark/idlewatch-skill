# IdleWatch Installer QA Log

## Session
[cron:c1e239d5-6bd1-42fd-8f86-08fc0615bbe1 IdleWatch Installer QA polish lane]

---

## 2026-03-21 — Round 9: Status Reconciliation

### Resolved since Round 8
- **P2 `--version` flag**: Now works (`idlewatch 0.1.9`, exits cleanly). **CLOSED.**
- **P1 Self-dependency**: `package.json` no longer lists `"idlewatch"` in dependencies. **CLOSED.**
- **P2 Dev artifacts**: `enrollment-new.js`, `enrollment.js.tmp`, `enrollment-full-backup.js` all deleted. **CLOSED.**
- **P2 `src/status.js` dead code**: File removed entirely. **CLOSED.**

### Still open, verified unchanged

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | **P1** | `--help` dumps 69 lines incl. 30 env vars (Advanced env, Firebase internals) | OPEN |
| 2 | P2 | No CLI subcommand for LaunchAgent install/uninstall (`idlewatch install-agent` / `uninstall-agent`) | OPEN |
| 3 | P2 | `create` wizard can't edit/delete existing custom metrics | OPEN |
| 4 | P2 | Post-quickstart success/error messages are debug-formatted (raw JSON, no summary) | OPEN |
| 5 | P2 | npx menubar help text is vague / dead-end | OPEN |
| 6 | P3 | `.env.example` mixes user config with CI/packaging vars | OPEN |
| 7 | P3 | `status` doesn't show LaunchAgent state (running/stopped/not installed) | OPEN |

### NEW P1 — `--help` mixes user-facing and internal env vars in a single wall of text

**Repro**:
```
node bin/idlewatch-agent.js --help
```

**Observed**: 69 lines printed. 30 environment variables listed, including advanced internals (`IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES_HARD_CAP`, `IDLEWATCH_USAGE_REFRESH_REPROBES`) and Firebase emulator vars. No visual separation between "things a user needs" and "things a developer tunes."

**Why it matters**: A new user running `idlewatch --help` is overwhelmed. The useful info (subcommands + quickstart steps) is buried. This is the single most visible first-impression surface.

**Acceptance**:
1. `--help` prints ≤25 lines: subcommands, quickstart steps, and ≤5 common env vars
2. Advanced/internal env vars move to `--help-env` or `--help-advanced` (or just the README)
3. No Firebase/emulator vars in default help output

### NEW P2 — `status` should show LaunchAgent state

**Repro**:
```
node bin/idlewatch-agent.js status
```

**Observed**: Output shows device config, publish mode, metrics, last sample age — but nothing about whether the LaunchAgent is installed/loaded/running. User has no single place to check "is IdleWatch actually running in the background?"

**Acceptance**: `status` output includes a line like:
```
  Background:   LaunchAgent loaded (running)
```
or `not installed` / `stopped` as appropriate. Use `launchctl print gui/<uid>/com.idlewatch.agent` to detect state.

### NEW P3 — Wizard "Choose setup mode" box is wider than necessary

**Repro**: Run `idlewatch quickstart` in a terminal.

**Observed**: The ASCII box is 49 chars wide with generous padding, and the two mode options use nested indentation that makes it look like a form rather than a quick choice. Minor visual noise.

**Acceptance**: Box width ≤40 chars or removed entirely. Mode prompt can be a simple inline question: `Setup mode — 1) Cloud (recommended) 2) Local-only [1]: `

---

## Priority Summary (Round 9, 2026-03-21)

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | **P1** | `--help` is 69 lines with 30 env vars — overwhelming for new users | ✅ CLOSED — trimmed to 26 lines, env vars moved to `--help-env` |
| 2 | P2 | No CLI subcommand for LaunchAgent install/uninstall | OPEN |
| 3 | P2 | `create` wizard can't edit/delete existing custom metrics | OPEN |
| 4 | P2 | Post-quickstart success/error messages are debug-formatted | OPEN |
| 5 | P2 | npx menubar help text is vague / dead-end | OPEN |
| 6 | P2 | `status` doesn't show LaunchAgent state | ✅ CLOSED — status now shows LaunchAgent loaded/idle/not installed |
| 7 | P3 | `.env.example` mixes user config with CI vars | OPEN |
| 8 | P3 | Wizard ASCII box is visually noisy for a 2-option prompt | ✅ CLOSED — replaced with minimal inline prompt |

---

## 2026-03-21 — Round 10: Verification + New Findings

### Verified closures from Round 9
- **`--help`**: Now 26 lines, clean subcommand list + 3-step quickstart. `--help-env` properly separates Common / Tuning / Firebase sections. **Confirmed CLOSED.**
- **`status` LaunchAgent state**: Shows `LaunchAgent not installed` / `loaded (running, pid X)` / `loaded (idle)` / `installed but not loaded`. **Confirmed CLOSED.**
- **Wizard ASCII box**: Replaced with inline prompt. **Confirmed CLOSED.**
- **`--version`**: Returns `idlewatch 0.1.9`, exits cleanly. **Confirmed CLOSED.**

### NEW findings

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 9 | P2 | Subcommand `--help` falls through to generic help (no per-command help) | NEW |
| 10 | P2 | `--once` prints full raw JSON blob before error message — user sees wall of JSON | NEW |
| 11 | P3 | `.env.example` still references Firebase/Firestore vars — should reference cloud API key instead | NEW |
| 12 | P3 | `--help-env` lists 30 env vars with no indication which ones matter — `Common` section is the only useful one for most users | NEW |

### #9 — Subcommand `--help` falls through to generic help

**Repro**:
```
idlewatch menubar --help
idlewatch create --help
```

**Observed**: Both print the top-level help (same as `idlewatch --help`). No subcommand-specific help.

**Why it matters**: `menubar` has options (`--launch`) and `create` has a specific workflow. Users expect `<cmd> --help` to explain the subcommand.

**Acceptance**: Each subcommand with options/workflow prints its own 3-5 line help when called with `--help`.

### #10 — `--once` prints full JSON blob before error

**Repro**:
```
idlewatch --once
```
(with an invalid or expired API key)

**Observed**: Entire telemetry JSON blob (~100+ fields, single line) is dumped to stdout, followed by the error message. The useful part (`Cloud API key was rejected...`) is buried after a wall of JSON.

**Why it matters**: `--once` is the natural "test publish" action. The output should be human-readable: a summary line + pass/fail, not raw JSON.

**Acceptance**:
1. `--once` prints a concise summary (device, metrics count, publish result) — not raw JSON
2. On error: error message is the prominent output, not buried after JSON
3. Raw JSON available via `--once --json` or `--dry-run` for debugging

### #11 — `.env.example` references Firebase instead of cloud API key

**Repro**: Read `.env.example`

**Observed**: File includes `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_FILE`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIRESTORE_EMULATOR_HOST` — but the actual setup flow uses `IDLEWATCH_CLOUD_API_KEY`. A user copying this example would configure Firebase vars that aren't used in the cloud publish path.

**Acceptance**: `.env.example` leads with `IDLEWATCH_CLOUD_API_KEY` and drops or clearly marks Firebase vars as "developer/self-hosted only".

### #12 — `--help-env` could group better for scannability

**Repro**: `idlewatch --help-env`

**Observed**: 37 lines, three sections (Common / Tuning / Firebase). The "Tuning" section has 18 vars that almost no user will ever touch. Minor: the section headers have no visual weight — easy to miss.

**Acceptance**: Minor — add a note like `(most users only need the Common section)` at the top, or bold/underline section headers.

---

## Priority Summary (Round 10, 2026-03-21)

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | P1 | `--help` wall of text | ✅ CLOSED |
| 2 | P2 | No LaunchAgent install/uninstall subcommands | OPEN |
| 3 | P2 | `create` can't edit/delete existing custom metrics | OPEN |
| 4 | P2 | Post-quickstart messages are debug-formatted | OPEN |
| 5 | P2 | npx menubar help text is vague | OPEN |
| 6 | P2 | `status` LaunchAgent state | ✅ CLOSED |
| 7 | P3 | `.env.example` mixes user/CI vars | OPEN — see also #11 |
| 8 | P3 | Wizard ASCII box too wide | ✅ CLOSED |
| 9 | P2 | Subcommand `--help` falls through to generic help | NEW |
| 10 | P2 | `--once` dumps raw JSON before error | NEW |
| 11 | P3 | `.env.example` references Firebase instead of cloud API key | NEW |
| 12 | P3 | `--help-env` scannability | NEW |

### Top recommendations for next implementer cycle
1. **#10** — `--once` output: suppress raw JSON, show summary + pass/fail. Highest user-facing impact for test-publish flow.
2. **#9** — Per-subcommand `--help`: small effort, big polish signal.
3. **#11** — `.env.example` cleanup: lead with `IDLEWATCH_CLOUD_API_KEY`, demote Firebase vars.
