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
| 15 | P3 | `--once --json` error stream mixing | ✅ CLOSED — progress to stderr with #19 fix |

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
| 13 | P2 | `--once`/`--dry-run` debug banner as first line | ✅ CLOSED — replaced with concise status line |
| 14 | P3 | `menubar` silently reinstalls | ✅ CLOSED — detects existing install, requires --force |
| 15 | P3 | `--once --json` error stream mixing | ✅ CLOSED — progress to stderr with #19 fix |

### Top recommendations for next implementer cycle
1. **#13** — Clean up the `--once`/`--dry-run` first-line debug banner (most visible test-publish surface).
2. **#2** — CLI subcommands for LaunchAgent install/uninstall.
3. **#3** — `create` wizard should support editing/deleting existing custom metrics.
4. **#14** — `menubar` should detect existing install before overwriting.

---

## 2026-03-21 — Round 12: Verification + New Findings

### Verified closures
- **#13 debug banner**: `--once` now prints `Collecting sample for "test" (cloud mode)…` — clean one-liner. `--dry-run` prints `Dry-run for "test" (cloud mode)…`. **Confirmed CLOSED.**
- **#14 menubar reinstall**: `menubar --help` shows `--force` flag. **Confirmed CLOSED.**
- **`.env.example`**: Leads with `IDLEWATCH_CLOUD_API_KEY`, Firebase vars under "Developer / self-hosted only". **Confirmed CLOSED.**
- **`--help-env`**: "Most users only need the Common section below." at top. Three clear sections. **Confirmed CLOSED.**

### Remaining open from prior rounds
- **#2** P2 — No CLI subcommand for LaunchAgent install/uninstall. OPEN.
- **#3** P2 — `create` wizard can't edit/delete existing custom metrics. OPEN.
- **#15** P3 — `--once --json` error mixes JSON stdout + plaintext stderr. OPEN (low priority).

### NEW findings

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 16 | **P1** | Unknown subcommand silently starts collector loop instead of showing error | NEW |
| 17 | P2 | `--once` second line is still a debug-style `Initial sample ready (mode=... metrics=... localLog=...)` banner | NEW |
| 18 | P3 | `--dry-run` shows only that 2nd debug line + nothing else — no sample summary | NEW |

### #16 — **P1** Unknown subcommand silently starts collector loop

**Repro**:
```
idlewatch blah
idlewatch notacommand
```

**Observed**: No error message. The CLI silently falls through to the default `run` behavior and starts the collector loop (publishing samples every 10s). The user has no idea they typed a wrong command — it just starts collecting.

**Why it matters**: This is a safety and UX problem. A typo like `idlewatch staus` silently starts a background collector. The user expects an error. Every CLI in the world prints "unknown command" for unrecognized input.

**Acceptance**:
1. Unknown subcommands print: `Unknown command "blah". Run idlewatch --help for available commands.`
2. Exit code 1
3. Never fall through to the collector loop on unrecognized input

### #17 — `--once` second line is still debug-formatted

**Repro**:
```
idlewatch --once
```

**Observed**: Output is:
```
Collecting sample for "test" (cloud mode)…
Initial sample ready (mode=cloud metrics=cpu,memory,gpu,openclaw localLog=/Users/luismantilla/.idlewatch/logs/test-metrics.ndjson)
Cloud API key was rejected (invalid_api_key). This device was disconnected. Run idlewatch quickstart with a new API key.
```

The second line (`Initial sample ready (mode=cloud metrics=... localLog=...)`) is a debug-style key=value dump. A user testing publish doesn't need to see the localLog path or the mode they already know about.

**Acceptance**: `--once` output should be:
```
Collecting sample for "test" (cloud mode)…
✅ Sample collected (7 metrics)
❌ Cloud publish failed: API key was rejected. Run idlewatch quickstart with a new key.
```
Or on success:
```
Collecting sample for "test" (cloud mode)…
✅ Sample collected and published (7 metrics)
```

### #18 — `--dry-run` shows only debug line, no useful summary

**Repro**:
```
idlewatch --dry-run
```

**Observed**:
```
Dry-run for "test" (cloud mode)…
Initial sample ready (mode=cloud metrics=cpu,memory,gpu,openclaw localLog=/Users/luismantilla/.idlewatch/logs/test-metrics.ndjson)
```

No actual sample summary is shown. The user wanted to preview what would be collected — but sees only that a sample was "ready" with no values. The useful output requires `--dry-run --json` which dumps an unreadable 4500-char JSON blob.

**Acceptance**: `--dry-run` should print a concise human-readable summary:
```
Dry-run for "test" (cloud mode)…
  CPU: 27%  Memory: 71%  GPU: 10%  Temp: nominal
  OpenClaw: gpt-5.4, 4% context used, 110k tok/min
  7 metrics collected — nothing published (dry run)
```

---

## Priority Summary (Round 12, 2026-03-21)

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
| 13 | P2 | `--once`/`--dry-run` debug banner | ✅ CLOSED |
| 14 | P3 | `menubar` silently reinstalls | ✅ CLOSED |
| 15 | P3 | `--once --json` error stream mixing | ✅ CLOSED — progress to stderr with #19 fix |
| 16 | **P1** | Unknown subcommand starts collector loop silently | ✅ CLOSED — prints error + exit 1 |
| 17 | P2 | `--once` second line still debug-formatted | ✅ CLOSED — concise "✅ Sample collected (N metrics)" |
| 18 | P3 | `--dry-run` shows no useful sample summary | ✅ CLOSED — shows metric count + "nothing published (dry run)" |

### Top recommendations for next implementer cycle
1. **#16 (P1)** — Unknown subcommands must error, not silently start collector.
2. **#17 (P2)** — Clean up `--once` output to show concise collect/publish result.
3. **#2 (P2)** — Add `install-agent` / `uninstall-agent` subcommands.
4. **#18 (P3)** — `--dry-run` should show a human-readable sample summary.

---

## 2026-03-21 — Round 13: Verification + New Findings

### Verified closures from Round 12
- **#16 unknown subcommand**: `idlewatch notacommand` → `Unknown command "notacommand". Run idlewatch --help for available commands.` Exit 1. **Confirmed CLOSED.**
- **#17 `--once` output**: Clean `✅ Sample collected (4 metrics)` + `❌ Cloud publish failed: API key rejected...`. **Confirmed CLOSED.**
- **#18 `--dry-run`**: Shows `✅ Sample collected (4 metrics) — nothing published (dry run)`. **Confirmed CLOSED.**
- **#14 menubar reinstall**: `IdleWatch menu bar app already installed at ~/Applications/IdleWatch.app. Use idlewatch menubar --force to reinstall.` **Confirmed CLOSED.**
- **All subcommand `--help`**: quickstart, configure, status, run, create, dashboard, menubar all have concise per-command help. **Confirmed CLOSED.**
- **`--help`**: 26 lines, clean layout. **Confirmed CLOSED.**
- **`status`**: Shows LaunchAgent state, device config, log size, last sample age. **Confirmed CLOSED.**
- **`.env.example`**: Leads with cloud API key, Firebase demoted. **Confirmed CLOSED.**
- **`--help-env`**: "Most users only need the Common section below." header. **Confirmed CLOSED.**

### NEW findings

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 19 | P2 | `--once --json` writes human-readable line to stdout, breaking JSON pipe | NEW |
| 20 | P2 | `--dry-run` shows metric count but no values — missed acceptance from #18 | NEW |
| 21 | P3 | `status` shows redundant Device + Device ID when they're identical | NEW |

### #19 — `--once --json` sends progress line to stdout, breaking JSON parsing

**Repro**:
```
idlewatch --once --json 2>/dev/null | jq .
```

**Observed**: stdout contains 2 lines:
```
Collecting sample for "test" (cloud mode)…
{"host":"Leptons-Mini", ...}
```
The first line is not JSON. `jq` and any JSON parser will choke. The `--json` flag implies machine-readable stdout.

**Acceptance**:
1. When `--json` is set, stdout contains only valid JSON (one line)
2. Human-readable progress/status lines go to stderr
3. `idlewatch --once --json 2>/dev/null | jq .` parses cleanly

### #20 — `--dry-run` shows count but no metric values

**Repro**:
```
idlewatch --dry-run
```

**Observed**:
```
Dry-run for "test" (cloud mode)…
✅ Sample collected (4 metrics) — nothing published (dry run)
```

This is better than Round 12 (debug banner is gone), but the whole point of `--dry-run` is to preview what would be published. The user sees "4 metrics" but not what those metrics are. Round 12 acceptance criteria called for a summary like:
```
  CPU: 27%  Memory: 71%  GPU: 10%  Temp: nominal
```

**Acceptance**: `--dry-run` prints a 2-4 line summary of collected values:
```
Dry-run for "test" (cloud mode)…
  CPU: 15%  Memory: 71%  GPU: 10%  Temp: nominal
  OpenClaw: gpt-5.4, 4% context, 48k tok/min
✅ 4 metrics collected — nothing published (dry run)
```

### #21 — `status` shows redundant Device / Device ID

**Repro**:
```
idlewatch status
```

**Observed**:
```
  Device:       test
  Device ID:    test
```
When device name and ID are identical (which is the common case), this is visual noise.

**Acceptance**: If device name equals device ID, show only `Device: test`. Show both only when they differ.

---

## Priority Summary (Round 13, 2026-03-21)

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
| 13 | P2 | `--once`/`--dry-run` debug banner | ✅ CLOSED |
| 14 | P3 | `menubar` silently reinstalls | ✅ CLOSED |
| 15 | P3 | `--once --json` error stream mixing | ✅ CLOSED — progress to stderr with #19 fix |
| 16 | P1 | Unknown subcommand starts collector loop | ✅ CLOSED |
| 17 | P2 | `--once` second line debug-formatted | ✅ CLOSED |
| 18 | P3 | `--dry-run` shows no useful sample summary | ✅ CLOSED (count only — values in #20) |
| 19 | **P2** | `--once --json` progress line on stdout breaks JSON pipe | ✅ CLOSED — progress to stderr, stdout pure JSON |
| 20 | P2 | `--dry-run` shows count but no metric values | ✅ CLOSED — shows CPU/Memory/GPU/Temp/OpenClaw values |
| 21 | P3 | `status` shows redundant Device/Device ID | ✅ CLOSED — hidden when ID matches normalized name |

### Top recommendations for next implementer cycle
1. **#19 (P2)** — `--json` must send only JSON to stdout; progress to stderr.
2. **#20 (P2)** — `--dry-run` should show actual metric values, not just count.
3. **#2 (P2)** — Add `install-agent` / `uninstall-agent` subcommands.
4. **#3 (P2)** — `create` wizard should support editing/deleting existing custom metrics.
5. **#21 (P3)** — Deduplicate Device/Device ID in `status` when identical.

---

## 2026-03-21 — Round 14: Deep Verification + New Findings

### Verified closures from Round 13
- **#16 unknown subcommand**: `idlewatch blah` → error + exit 1. **Confirmed CLOSED.**
- **#17 `--once` output**: Clean `✅ Sample collected (4 metrics)` line. **Confirmed CLOSED.**
- **#18 `--dry-run`**: Shows metric values (CPU/Memory/GPU/Temp/OpenClaw). **Confirmed CLOSED.**
- **#19 `--once --json` stdout**: `2>/dev/null | jq .` parses cleanly. **Confirmed CLOSED.**
- **#20 `--dry-run` values**: Shows actual percentages and OpenClaw stats. **Confirmed CLOSED.**
- **#21 `status` dedup**: Shows only `Device: test` (no redundant Device ID). **Confirmed CLOSED.**
- **#14 menubar reinstall**: Detects existing install, requires `--force`. **Confirmed CLOSED.**

### Regression check on #19 — `--once --json` progress line STILL on stdout when stderr is mixed in

**Repro**:
```
idlewatch --once --json 2>&1 | head -1
```

**Observed**: First line is `Collecting sample for "test" (cloud mode)…` — this is the human progress line. When stderr is redirected away (`2>/dev/null`), stdout is pure JSON. But the progress line goes to **stdout**, not stderr.

```
idlewatch --once --json 2>/dev/null | head -1
# → {"host":"Leptons-Mini",...}   ← correct, pure JSON

idlewatch --once --json 1>/dev/null 2>&1
# → (empty)                      ← progress line was on stdout, not stderr
```

**Verdict**: #19 was marked closed but the progress line is on stdout, not stderr. It works for `2>/dev/null | jq` because the progress line comes first and jq reads the last complete JSON object. But `--json` should mean stdout is *only* JSON. Re-opening as **#22**.

### NEW findings

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 22 | **P2** | `--once --json` progress line emitted to stdout, not stderr | NEW |
| 23 | P3 | `--dry-run` displays `Temp: 0°C` when sensor returns 0 — should show `nominal` or hide | NEW |
| 24 | P3 | `--once` error exit message could include the device name for multi-device clarity | NEW |

### #22 — `--once --json` progress line goes to stdout

**Repro**:
```
idlewatch --once --json 2>&1 | head -1
```

**Observed**: `Collecting sample for "test" (cloud mode)…` on stdout. The JSON blob follows on line 2. A strict JSON consumer reading all of stdout gets invalid input.

**Why it matters**: `--json` is explicitly for machine consumption. Any non-JSON on stdout breaks parsers. The fact that `2>/dev/null | jq` works is coincidental (jq reads the last valid JSON line).

**Acceptance**:
1. When `--json` is set, `Collecting sample...` line goes to stderr
2. stdout contains exactly one JSON object (or nothing on pre-collection failure)
3. `idlewatch --once --json | jq .` works without stderr redirect

### #23 — `Temp: 0°C` displayed when sensor returns zero

**Repro**:
```
idlewatch --dry-run
```

**Observed**: `Temp: 0°C` — `osx-cpu-temp` returns `0.0°C` on this machine (Apple Silicon, no exposed CPU temp via this tool). Displaying `0°C` is misleading — it implies the CPU is at freezing temperature.

**Acceptance**: When `deviceTempC` is 0 and `thermalState` is `nominal`, display `Temp: nominal` instead of `Temp: 0°C`. Reserve numeric display for when a real non-zero reading exists.

### #24 — Error message doesn't include device name

**Repro**:
```
idlewatch --once
```

**Observed**: `❌ Cloud publish failed: API key rejected (invalid_api_key). Run idlewatch quickstart with a new key.`

Minor: On a multi-device setup, knowing *which* device failed is useful. The collect line says `"test"` but the error line doesn't.

**Acceptance**: Optional — error line could be: `❌ Cloud publish failed for "test": API key rejected...` Low priority.

### Remaining open items from prior rounds

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 2 | P2 | No LaunchAgent install/uninstall subcommands | OPEN |
| 3 | P2 | `create` can't edit/delete existing custom metrics | OPEN |

---

## Priority Summary (Round 14, 2026-03-21)

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
| 13 | P2 | `--once`/`--dry-run` debug banner | ✅ CLOSED |
| 14 | P3 | `menubar` silently reinstalls | ✅ CLOSED |
| 15 | P3 | `--once --json` error stream mixing | ✅ CLOSED |
| 16 | P1 | Unknown subcommand starts collector loop | ✅ CLOSED |
| 17 | P2 | `--once` second line debug-formatted | ✅ CLOSED |
| 18 | P3 | `--dry-run` no sample summary | ✅ CLOSED |
| 19 | P2 | `--once --json` progress on stdout | ✅ CLOSED (superseded by #22) |
| 20 | P2 | `--dry-run` no metric values | ✅ CLOSED |
| 21 | P3 | `status` redundant Device/Device ID | ✅ CLOSED |
| 22 | **P2** | `--once --json` progress line on stdout, not stderr | ✅ CLOSED — already fixed, verified pure JSON on stdout |
| 23 | P3 | `Temp: 0°C` when sensor returns zero — misleading | ✅ CLOSED — shows `Temp: nominal` when 0°C |
| 24 | P3 | Error message missing device name for multi-device | ✅ CLOSED — error includes device name |

### Top recommendations for next implementer cycle
1. **#22 (P2)** — `--json` progress line must go to stderr, not stdout.
2. **#2 (P2)** — Add `install-agent` / `uninstall-agent` subcommands.
3. **#3 (P2)** — `create` wizard should support editing/deleting existing custom metrics.
4. **#23 (P3)** — Display `Temp: nominal` instead of `Temp: 0°C` when sensor returns zero.
5. **#24 (P3)** — Include device name in error messages.

---

## 2026-03-21 — Round 15: Full Re-verification + New Findings

### Verified all prior closures — confirmed solid
All items #1–#24 marked CLOSED remain correctly fixed:
- `--help`: 26 lines, clean. `--version`: exits 0. Unknown subcommand: error + exit 1.
- `--once`: concise output, device name in errors, `--json` pure JSON on stdout.
- `--dry-run`: shows CPU/Memory/GPU/Temp/OpenClaw values, `Temp: nominal` when 0°C.
- `status`: LaunchAgent state, deduplicates Device/Device ID.
- All subcommand `--help`: concise. `menubar`: detects existing install.
- `.env.example` and `--help-env`: clean, well-organized.

### Remaining open from prior rounds

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 2 | P2 | No CLI subcommand for LaunchAgent install/uninstall | OPEN |
| 3 | P2 | `create` can't edit/delete existing custom metrics | OPEN |

### NEW findings

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 25 | P2 | README validation section is 30 dense CI bullet points — overwhelms user-facing docs | NEW |
| 26 | P3 | `--once` stdout shows ✅ even when publish failed (error on stderr only) | NEW |

### #25 — README validation section overwhelms user-facing docs

**Repro**: Read `README.md` lines 117–142.

**Observed**: 30-item bullet list of `npm run validate:*` scripts (packaged-openclaw-robustness, cache-recovery-e2e, probe-noise, release-gates, etc.) with dense descriptions. This is ~25% of the README and entirely CI/developer-facing. A user scrolling past "Quickstart" hits a wall of internal tooling.

**Why it matters**: README is the first thing users see on npm/GitHub. The validation wall makes the project look over-engineered.

**Acceptance**:
1. Move validation scripts to `docs/VALIDATION.md` or `CONTRIBUTING.md`
2. README keeps one line: `See docs/VALIDATION.md for CI and release-gate scripts.`
3. User-visible README sections: Install, Quickstart, CLI, Config, Troubleshooting

### #26 — `--once` stdout shows ✅ when publish actually failed

**Repro**:
```bash
idlewatch --once 2>/dev/null
```

**Observed**: stdout shows `✅ Sample collected (4 metrics)` — the ✅ is misleading because the publish failed (error went to stderr only). Most interactive users see both streams, so impact is low. But stdout alone suggests success.

**Acceptance (minor)**: When publish fails, stdout summary should indicate failure or the error should also appear on stdout.

---

## Priority Summary (Round 15, 2026-03-21)

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | P1 | `--help` wall of text | ✅ CLOSED |
| 2 | P2 | No LaunchAgent install/uninstall subcommands | OPEN |
| 3 | P2 | `create` can't edit/delete existing custom metrics | OPEN |
| 4–24 | — | All prior items | ✅ CLOSED |
| 25 | **P2** | README validation section overwhelms user docs (30 CI bullets) | ✅ CLOSED — moved to docs/VALIDATION.md, README trimmed 350→253 lines |
| 26 | P3 | `--once` stdout shows ✅ even on publish failure | ✅ CLOSED — shows ⚠️ (not published) when publish fails |

### Top recommendations for next implementer cycle
1. **#2 (P2)** — Add `install-agent` / `uninstall-agent` CLI subcommands.
2. **#3 (P2)** — `create` wizard: support editing/deleting existing custom metrics.

---

## 2026-03-21 — Round 16: Full Verification + New Findings

### Re-verified all prior closures — all hold
All 26 items previously closed remain correctly fixed. Spot-checked:
- `--help`: 26 lines, clean. `--version`: `idlewatch 0.1.9`, exit 0.
- Unknown subcommand: error + exit 1. All subcommand `--help`: concise and accurate.
- `--once`: `⚠️ Sample collected (4 metrics) (not published)` + `❌` error with device name.
- `--once --json 2>/dev/null | jq .`: pure JSON, parses clean (1 line on stdout).
- `--dry-run`: Shows CPU/Memory/GPU/Temp/OpenClaw values, `Temp: nominal` when 0°C.
- `status`: LaunchAgent state shown, Device/Device ID deduplicated.
- `menubar --help`: shows `--force` and `--launch`. `.env.example`: clean, Firebase demoted.
- `--help-env`: "Most users only need the Common section" header, three sections.
- README: 253 lines, validation scripts moved to docs/VALIDATION.md.

### Remaining open from prior rounds

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 2 | P2 | No CLI subcommand for LaunchAgent install/uninstall | OPEN |
| 3 | P2 | `create` can't edit/delete existing custom metrics | OPEN |

### NEW findings

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 27 | **P2** | README lines 120–250 are 130 lines of internal probe/parser/alerting docs — overwhelms users | NEW |
| 28 | P3 | `configure --help` says "Existing values are pre-filled" but doesn't mention which settings can be changed | NEW |

### #27 — README "OpenClaw usage ingestion" section is 130 lines of internal implementation docs

**Repro**: Read `README.md` lines 120–250.

**Observed**: 130 lines covering probe sweep order, output buffer caps, cache paths, stale-threshold reprobes, timestamp alias normalization, session selection logic, source metadata field inventory (30+ `source.*` fields), alerting thresholds, and parser hardening notes. This is internal/operator documentation, not user-facing.

A user installing IdleWatch via `npm install -g idlewatch` doesn't need to know about `IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES_HARD_CAP`, `source.usageRefreshReprobes`, or timestamp alias normalization. This section is ~50% of the README.

**Why it matters**: README is the storefront. Users scanning for "how do I use this?" hit a wall of internal probe architecture. Makes the project look over-engineered for what should be a simple telemetry collector.

**Acceptance**:
1. README "OpenClaw usage" section is ≤15 lines: what it does, how to enable/disable, link to details
2. Move full probe/parser/alerting docs to `docs/OPENCLAW-INTEGRATION.md` or similar
3. README stays ≤150 lines total: Install, Quickstart, CLI, Config, Troubleshooting

### #28 — `configure --help` could list changeable settings

**Repro**:
```
idlewatch configure --help
```

**Observed**:
```
Re-opens the setup wizard to change API key, device name, or metrics.
Existing values are pre-filled so you only change what you need.
```

Minor: It says what can be changed (API key, device name, metrics) but doesn't mention mode (cloud/local). The wizard does allow changing mode. Not a bug, just incomplete help text.

**Acceptance**: Add "mode" to the list: `...to change mode, API key, device name, or metrics.`

---

## Priority Summary (Round 16, 2026-03-21)

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | P1 | `--help` wall of text | ✅ CLOSED |
| 2 | P2 | No LaunchAgent install/uninstall subcommands | OPEN |
| 3 | P2 | `create` can't edit/delete existing custom metrics | OPEN |
| 4–26 | — | All prior items | ✅ CLOSED |
| 27 | **P2** | README has 130 lines of internal probe/parser docs — should be in separate doc | ✅ CLOSED — moved to docs/OPENCLAW-INTEGRATION.md, README 253→128 lines |
| 28 | P3 | `configure --help` doesn't mention mode as changeable setting | ✅ CLOSED — now lists mode |

### Top recommendations for next implementer cycle
1. **#27 (P2)** — Move OpenClaw probe/parser/alerting internals out of README into `docs/OPENCLAW-INTEGRATION.md`. Keep README ≤150 lines.
2. **#2 (P2)** — Add `install-agent` / `uninstall-agent` CLI subcommands.
3. **#3 (P2)** — `create` wizard: support editing/deleting existing custom metrics.
4. **#28 (P3)** — Add "mode" to `configure --help` description.

---

## 2026-03-21 — Round 17: Full Verification + New Findings

### Verified all prior closures — all hold
Spot-checked all 28 items marked CLOSED. Everything is solid:
- `--help`: 26 lines. `--version`: `idlewatch 0.1.9`, exit 0. Unknown subcommand: error + exit 1.
- `--once`: `⚠️` on publish fail, `❌` error with device name. `--json`: pure JSON stdout (1 line, parses with `jq`).
- `--dry-run`: metric values shown, `Temp: nominal` when 0°C. Exit 0.
- `status`: LaunchAgent state, Device/ID dedup. `configure --help`: lists mode.
- `menubar`: detects existing install, `--force`/`--launch` flags.
- `.env.example`: cloud key first, Firebase demoted. `--help-env`: clear sections.
- README: 128 lines, validation + OpenClaw internals moved to docs/.

### Remaining open from prior rounds

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 2 | P2 | No CLI subcommand for LaunchAgent install/uninstall | OPEN |
| 3 | P2 | `create` can't edit/delete existing custom metrics | OPEN |

### NEW findings

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 29 | **P2** | `--once --dry-run` together produce contradictory output | NEW |
| 30 | P2 | README "Advanced Firebase wiring" is 37 lines of self-hosted docs in user-facing README | NEW |

### #29 — `--once --dry-run` together produce contradictory output

**Repro**:
```
idlewatch --once --dry-run
```

**Observed**:
```
Dry-run for "test" (cloud mode)…
  CPU: 26%  Memory: 71%  GPU: 0%  Temp: nominal
  OpenClaw: gpt-5.4, 5% context used, 30,756 tok/min
✅ Sample collected (4 metrics) — nothing published (dry run)
❌ Cloud publish failed for "test": check API key and connectivity.
```
Exit code 1. The output says "nothing published (dry run)" — correct for dry-run — but then shows a publish failure error. These contradict each other. The `--dry-run` flag should suppress any publish attempt entirely, making `--once` irrelevant.

**Why it matters**: Confusing for users who aren't sure which flag to use. `--dry-run` should mean "don't publish, just show me what you'd collect." Adding `--once` on top shouldn't change that behavior.

**Acceptance**:
1. `--dry-run` suppresses publish regardless of `--once`
2. No `❌` error when `--dry-run` is set — publish was never attempted
3. Exit code 0 when `--dry-run` succeeds (sample collected OK)
4. OR: print `--once and --dry-run are mutually exclusive` and exit 1

### #30 — README "Advanced Firebase wiring" section should move to docs/

**Repro**: Read README.md lines 83–120.

**Observed**: 37 lines covering Firebase manual wiring (env vars, raw JSON, base64, emulator mode, least-privilege guidance, require-writes flag). This is self-hosted/developer documentation. The vast majority of users use cloud mode with an API key — they'll never touch Firebase.

The README went from 253→128 lines after Rounds 25 and 27, but the Firebase section survived and is now ~30% of the remaining README. It breaks the clean flow: Install → Quickstart → CLI → done.

**Acceptance**:
1. Move "Advanced Firebase wiring" to `docs/FIREBASE.md`
2. README keeps 1-2 lines: `For self-hosted Firebase ingest, see [docs/FIREBASE.md](docs/FIREBASE.md).`
3. README stays ≤100 lines: Install, Quickstart, CLI, Config, links to advanced docs

---

## Priority Summary (Round 17, 2026-03-21)

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | P1 | `--help` wall of text | ✅ CLOSED |
| 2 | P2 | No LaunchAgent install/uninstall subcommands | OPEN |
| 3 | P2 | `create` can't edit/delete existing custom metrics | OPEN |
| 4–28 | — | All prior items | ✅ CLOSED |
| 29 | **P2** | `--once --dry-run` contradictory output (dry-run + publish error) | ✅ CLOSED — DRY_RUN guards all publish error paths, exit 0 |
| 30 | P2 | README Firebase section (37 lines) should move to docs/ | ✅ CLOSED — moved to docs/FIREBASE.md, README 128→98 lines |

### Top recommendations for next implementer cycle
1. **#29 (P2)** — `--dry-run` must suppress publish entirely; `--once --dry-run` should not attempt or report publish failure.
2. **#30 (P2)** — Move Firebase wiring docs to `docs/FIREBASE.md`, shrink README to ≤100 lines.
3. **#2 (P2)** — Add `install-agent` / `uninstall-agent` CLI subcommands.
4. **#3 (P2)** — `create` wizard: support editing/deleting existing custom metrics.

---

## 2026-03-21 — Round 18: Full Verification + New Findings

### Verified all prior closures — all hold
All 30 items previously closed remain correctly fixed. Full re-check:
- `--help`: 26 lines, clean layout. `--version`: `idlewatch 0.1.9`, exit 0. Unknown subcommand: error + exit 1.
- `--once`: `⚠️ Sample collected (4 metrics) (not published)` + `❌` error with device name. Exit 1.
- `--once --json 2>/dev/null | jq .`: pure JSON, parses cleanly.
- `--dry-run`: metric values shown (CPU/Memory/GPU/Temp/OpenClaw), `Temp: nominal` when 0°C. Exit 0.
- `--once --dry-run`: clean dry-run, no publish error, exit 0. **Confirmed #29 fix holds.**
- `status`: LaunchAgent state shown, Device/Device ID deduplicated.
- All subcommand `--help`: quickstart, configure, status, run, create, dashboard, menubar — all concise and accurate.
- `configure --help`: lists mode as changeable setting.
- `menubar --help`: shows `--force` and `--launch`.
- `.env.example`: cloud API key first, Firebase demoted under "Developer / self-hosted only".
- `--help-env`: "Most users only need the Common section" header, 3 clear sections.
- README: 98 lines. Validation + OpenClaw internals + Firebase all moved to docs/.

### Remaining open from prior rounds

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 2 | P2 | No CLI subcommand for LaunchAgent install/uninstall | OPEN |
| 3 | P2 | `create` can't edit/delete existing custom metrics | OPEN |

### NEW findings

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 31 | P2 | `reconfigure` is a hidden alias — `--help` doesn't list it, `reconfigure --help` shows generic help | NEW |
| 32 | P3 | README "GPU support matrix" section (15 lines) is implementation detail, not user-facing | NEW |
| 33 | P3 | README "Reliability improvements" section (8 lines) is implementation detail | NEW |

### #31 — `reconfigure` is a hidden undocumented alias

**Repro**:
```
idlewatch reconfigure --help
```

**Observed**: `reconfigure` is accepted (in KNOWN_SUBCOMMANDS) and launches the configure wizard, but:
1. `--help` doesn't list it as a command
2. `reconfigure --help` shows the generic top-level help instead of the configure-specific help
3. There's no indication to users that `reconfigure` exists

**Why it matters**: Either it should be properly documented (listed in `--help`, with its own `--help` text), or it should be removed/consolidated. Having a hidden alias that behaves slightly differently from `configure` (different help output) is confusing for anyone who discovers it.

**Acceptance**: Pick one:
- A) Remove `reconfigure` from KNOWN_SUBCOMMANDS — let it error like any unknown command
- B) Make `reconfigure --help` show the same help as `configure --help`, and add a note in configure's help: `(alias: reconfigure)`

### #32 — README "macOS GPU support matrix" is implementation detail

**Repro**: Read README.md lines 52–65.

**Observed**: 15 lines covering AGX/IOGPU ioreg, powermetrics, top parser fallback chains, gpuSource/gpuConfidence field semantics. This is internal telemetry architecture — a user setting up IdleWatch doesn't need to know about AGX probe paths or confidence levels.

**Acceptance**:
1. Move to `docs/OPENCLAW-INTEGRATION.md` or a new `docs/GPU-PROBING.md`
2. README keeps 1 line: `GPU metrics are collected automatically on macOS (Apple Silicon and Intel).`

### #33 — README "Reliability improvements" is implementation detail

**Repro**: Read README.md lines 39–50.

**Observed**: 8 lines covering NDJSON durability, retry-once, non-overlapping scheduler, non-blocking CPU sampling, Darwin GPU fallback chain, memory pressure enrichment. These are good engineering features but not user-facing setup info.

**Acceptance**:
1. Move to docs (CONTRIBUTING.md or similar)
2. README keeps 0-1 lines — or fold into a "Features" bullet list if desired

---

## Priority Summary (Round 18, 2026-03-21)

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | P1 | `--help` wall of text | ✅ CLOSED |
| 2 | P2 | No LaunchAgent install/uninstall subcommands | OPEN |
| 3 | P2 | `create` can't edit/delete existing custom metrics | OPEN |
| 4–30 | — | All prior items | ✅ CLOSED |
| 31 | P2 | `reconfigure` hidden alias — undocumented, wrong help output | NEW |
| 32 | P3 | README GPU support matrix is implementation detail (15 lines) | NEW |
| 33 | P3 | README Reliability improvements is implementation detail (8 lines) | NEW |

### Top recommendations for next implementer cycle
1. **#31 (P2)** — Either remove `reconfigure` alias or make it behave identically to `configure` (including `--help`).
2. **#2 (P2)** — Add `install-agent` / `uninstall-agent` CLI subcommands.
3. **#3 (P2)** — `create` wizard: support editing/deleting existing custom metrics.
4. **#32 + #33 (P3)** — Move GPU matrix + Reliability sections out of README into docs/. Target README ≤70 lines.
