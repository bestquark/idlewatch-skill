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
| 4 | P2 | Post-quickstart messages are debug-formatted | ✅ CLOSED — see Round 11 |
| 5 | P2 | npx menubar help text is vague | ✅ CLOSED — see Round 11 |
| 6 | P2 | `status` LaunchAgent state | ✅ CLOSED |
| 7 | P3 | `.env.example` mixes user/CI vars | ✅ CLOSED |
| 8 | P3 | Wizard ASCII box too wide | ✅ CLOSED |
| 9 | P2 | Subcommand `--help` falls through to generic help | ✅ CLOSED |
| 10 | P2 | `--once` dumps raw JSON before error | ✅ CLOSED |
| 11 | P3 | `.env.example` references Firebase instead of cloud API key | ✅ CLOSED |
| 12 | P3 | `--help-env` scannability | ✅ CLOSED |

---

## 2026-03-21 — Round 11: Deep Verification + New Findings

### Verified closures

- **#4 Post-quickstart messages**: Post-quickstart now shows a clean `✅ Setup complete!` block with device name, mode, config path, temperature helper status, and a clear next-step (`idlewatch run`). Error path also clean with specific retry commands. **CLOSED.**
- **#5 menubar help**: `idlewatch menubar --help` now shows purpose, usage, and `--launch` flag. **CLOSED.**
- **#7 `.env.example`**: Now leads with `IDLEWATCH_CLOUD_API_KEY`, Firebase vars clearly demoted under "Developer / self-hosted only" section. **CLOSED.**
- **#9 subcommand --help**: All subcommands (`quickstart`, `configure`, `status`, `run`, `create`, `dashboard`, `menubar`) have their own concise `--help` output. **CLOSED.**
- **#10 `--once` JSON dump**: `--once` now shows `summarizeSetupVerification()` output (one-liner summary). Raw JSON only with `--json`. **CLOSED.**
- **#12 `--help-env`**: Shows "Most users only need the Common section below." at top. Three clear sections. **CLOSED.**

### NEW findings

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 13 | P2 | `--once` / `--dry-run` first line is a noisy debug banner | NEW |
| 14 | P3 | `menubar` silently reinstalls without confirmation | NEW |
| 15 | P3 | `--once --json` error path mixes JSON + plaintext to different streams | NEW |

### #13 — `--once` / `--dry-run` first line is a noisy debug banner

**Repro**:
```
idlewatch --once
idlewatch --dry-run
```

**Observed**: First line is always:
```
idlewatch once host=Leptons-Mini device=test deviceId=test intervalMs=10000 publish=cloud localLog=/Users/luismantilla/.idlewatch/logs/test-metrics.ndjson env=/Users/luismantilla/.idlewatch/idlewatch.env
```
This is a debug-style key=value dump (7 parameters). For a user running a quick test, this is noise before the useful output (the summary line or error).

**Acceptance**:
1. `--once` prints a short status line: `Collecting sample for "test" (cloud mode)…` then the result
2. The full key=value debug banner moves behind `--verbose` or is removed entirely
3. `--dry-run` similarly: `Dry-run for "test"…` then the sample summary

### #14 — `menubar` silently reinstalls without confirmation

**Repro**:
```
idlewatch menubar   # first time: installs
idlewatch menubar   # second time: silently reinstalls/overwrites
```

**Observed**: Running `menubar` when the app already exists at `~/Applications/IdleWatch.app` silently overwrites it. No "already installed, reinstall?" prompt, no "up to date" message.

**Acceptance**: If app already exists, print `IdleWatch menu bar app already installed at ~/Applications/IdleWatch.app` and skip unless `--force` is passed. Or at minimum, print `Reinstalling…` so the user knows what happened.

### #15 — `--once --json` error mixes JSON stdout + plaintext stderr

**Repro**:
```
idlewatch --once --json 2>&1
```
(with invalid API key)

**Observed**: stdout gets the full JSON blob, stderr gets the plaintext error. This is technically correct (stdout/stderr separation), but when piped together the output is confusing — a massive JSON line followed by a human error message.

**Minor**: This is standard Unix convention. Marking P3 for awareness only; no change strictly needed. Could improve by adding an `"error"` field to the JSON output on failure instead of relying on stderr.

**Acceptance**: Optional — if `--json` is set, errors could also be JSON: `{"error": "invalid_api_key", "message": "..."}` to stderr. Low priority.

---

## Priority Summary (Round 11, 2026-03-21)

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | P1 | `--help` wall of text | ✅ CLOSED |
| 2 | P2 | No LaunchAgent install/uninstall subcommands | OPEN |
| 3 | P2 | `create` can't edit/delete existing custom metrics | OPEN |
| 4 | P2 | Post-quickstart messages debug-formatted | ✅ CLOSED |
| 5 | P2 | menubar help text vague | ✅ CLOSED |
| 6 | P2 | `status` LaunchAgent state | ✅ CLOSED |
| 7 | P3 | `.env.example` mixes user/CI vars | ✅ CLOSED |
| 8 | P3 | Wizard ASCII box too wide | ✅ CLOSED |
| 9 | P2 | Subcommand `--help` falls through | ✅ CLOSED |
| 10 | P2 | `--once` dumps raw JSON | ✅ CLOSED |
| 11 | P3 | `.env.example` Firebase refs | ✅ CLOSED |
| 12 | P3 | `--help-env` scannability | ✅ CLOSED |
| 13 | P2 | `--once`/`--dry-run` debug banner as first line | NEW |
| 14 | P3 | `menubar` silently reinstalls | NEW |
| 15 | P3 | `--once --json` error stream mixing | NEW |

### Top recommendations for next implementer cycle
1. **#13** — Clean up the `--once`/`--dry-run` first-line debug banner (most visible test-publish surface).
2. **#2** — CLI subcommands for LaunchAgent install/uninstall.
3. **#3** — `create` wizard should support editing/deleting existing custom metrics.
4. **#14** — `menubar` should detect existing install before overwriting.
