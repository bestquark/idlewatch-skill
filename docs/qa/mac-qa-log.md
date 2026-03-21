# IdleWatch Installer QA Log

## Session
[cron:c1e239d5-6bd1-42fd-8f86-08fc0615bbe1 IdleWatch Installer QA polish lane]

---

## 2026-03-20 — Round 2: Deep Polish Pass

### P1 — `--help` is a wall of env vars

**Location**: `bin/idlewatch-agent.js` → `printHelp()`

**Issue**: The help output dumps 25+ env vars (including "Advanced env tuning" and "Advanced Firebase / emulator mode") directly into `--help`. This is overwhelming for first-time users who just want to know how to get started. The quickstart section is good but drowns in tuning knobs. End users should never see `IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS` in a help screen.

**Repro**: `idlewatch --help`

**Acceptance**:
- `--help` shows only the subcommands, quickstart steps, and *common* env vars (API key, ingest URL, log path, openclaw usage mode)
- Advanced/tuning env vars move to `--help-advanced` or just README
- Keep it under ~30 lines for the default help

---

### P1 — `status` says "no saved config" even when device has data

**Location**: `bin/idlewatch-agent.js` → `statusRequested` block

**Issue**: Running `idlewatch status` shows `Config: (no saved config)` and suggests `Run idlewatch quickstart to set up this device.` even though the device has 258 KB of logged samples and clearly works. This happens because `~/.idlewatch/idlewatch.env` doesn't exist (user ran with env vars or process env). The status screen should distinguish "never set up" from "running without a persisted config file."

**Repro**:
1. Delete `~/.idlewatch/idlewatch.env` (or never run quickstart)
2. Run `idlewatch --once` (succeeds, writes local log)
3. Run `idlewatch status` → shows "no saved config" + "Run idlewatch quickstart"

**Acceptance**:
- If local log exists with recent samples, status should say something like `Config: process env (no saved file)` instead of implying setup hasn't happened
- The nudge to run quickstart should only appear if there's genuinely no data and no config

---

### P1 — `enrollment.js` has undeclared variables (`mode`, `cloudApiKey`)

**Location**: `src/enrollment.js` lines ~190-220

**Issue**: In the interactive text-mode path (non-TUI), the code assigns to `mode` and reads `cloudApiKey` as bare names, but these aren't declared with `let` at function scope — `mode` is written as `mode = modeInput === '2' ? 'local' : 'production'` but the only prior declaration is `const modeOption = ...`. Similarly `cloudApiKey` is used but only `cloudApiKeyOpt` is declared. This would throw a ReferenceError on the text-mode fallback path (non-TUI) in strict mode.

**Repro**:
1. `idlewatch quickstart --no-tui` (forces text-mode path)
2. Likely throws at the mode assignment

**Acceptance**:
- Declare `let mode = modeOption` and `let cloudApiKey = cloudApiKeyOpt` at the top of `runEnrollmentWizard`
- Verify text-mode quickstart completes without errors

---

### P2 — LaunchAgent install has no CLI subcommand

**Location**: `bin/idlewatch-agent.js`, `scripts/install-macos-launch-agent.sh`

**Issue**: After quickstart succeeds, the final message says `On macOS, enable login startup at ~/Library/LaunchAgents/com.idlewatch.plist` but there's no `idlewatch launchagent install` subcommand. The user has to know about `npm run install:macos-launch-agent` or find the shell script. This is a dead end for npx users.

**Repro**:
1. `idlewatch quickstart --no-tui` → complete setup
2. See macOS LaunchAgent suggestion
3. No obvious next step

**Acceptance**:
- Add `idlewatch launchagent` (or `idlewatch agent install`) subcommand that wraps `install-macos-launch-agent.sh`
- OR change the success message to show the exact command: `idlewatch menubar --launch` (if that covers it) or `npm run install:macos-launch-agent`

---

### P2 — `idlewatch create` doesn't show existing metrics on re-run

**Location**: `bin/idlewatch-agent.js` → `runCustomMetricWizard()`

**Issue**: When re-running `idlewatch create`, it shows `Existing metrics: <list>` but then immediately prompts for a brand new metric from scratch. There's no way to edit/delete an existing one. The wizard always starts fresh.

**Repro**:
1. `idlewatch create` → create "my_metric"
2. `idlewatch create` again → shows "Existing metrics: my_metric" then asks for a new Name from scratch

**Acceptance**:
- If existing metrics exist, offer a choice: "Add new metric" or "Edit existing" or "Delete"
- Or at minimum, if the user enters the same key, confirm they want to overwrite

---

### P2 — Post-quickstart success message is dense and technical

**Location**: `bin/idlewatch-agent.js` → quickstart success block (~line 280-295)

**Issue**: After a successful quickstart, the CLI prints:
```
✅ Setup complete. Mode=production device=MyDevice envFile=~/.idlewatch/idlewatch.env
Initial telemetry sample sent successfully.
To keep this device online continuously, run: idlewatch run
On macOS, enable login startup at ~/Library/LaunchAgents/com.idlewatch.plist
```
The `Mode=production device=MyDevice envFile=...` format is debug-style, not user-facing. "Mode=production" means nothing to an end user. The LaunchAgent line is a dead end (see P2 above).

**Acceptance**:
- Simplify to something like:
  ```
  ✅ Setup complete — MyDevice is online.
  First sample sent successfully.
  
  Next: run `idlewatch run` to keep collecting, or install the menu bar app with `idlewatch menubar`.
  ```
- Drop internal key=value debug format from user-facing output

---

### P2 — `npm/npx install path` help text is vague

**Location**: `bin/idlewatch-agent.js` → `printHelp()` → "Menu bar" section

**Issue**: Help says `If you used npx, install the package globally first or run the command from the cloned repo.` This doesn't give a concrete command and "cloned repo" makes no sense for end users who installed via npm.

**Repro**: `idlewatch --help` → read "Menu bar" section

**Acceptance**:
- Replace with: `npx users: run npm install -g idlewatch first, then idlewatch menubar --launch`
- Or detect npx at runtime and print a targeted hint

---

### P3 — Uninstall LaunchAgent has no CLI subcommand either

**Location**: `scripts/uninstall-macos-launch-agent.sh`

**Issue**: There's a clean uninstall script but no way to reach it from the CLI. Users who installed via `npm run install:macos-launch-agent` have no obvious way to undo it.

**Acceptance**:
- `idlewatch launchagent uninstall` or document the command in `idlewatch status` output when a LaunchAgent is detected as loaded

---

### P3 — `.env.example` has stale defaults

**Location**: `.env.example`

**Issue**: `.env.example` sets `IDLEWATCH_HOST=my-host` and `IDLEWATCH_LOCAL_LOG_PATH=./logs/idlewatch-metrics.ndjson` (relative path). The actual defaults are hostname-based and under `~/.idlewatch/logs/`. This could mislead someone copying the example.

**Acceptance**:
- Comment out `IDLEWATCH_HOST` and `IDLEWATCH_LOCAL_LOG_PATH` (they have good auto-defaults)
- Or update to `~/.idlewatch/logs/<hostname>-metrics.ndjson`

---

### P3 — `idlewatch status` doesn't detect running LaunchAgent

**Location**: `bin/idlewatch-agent.js` → status block

**Issue**: Status screen shows device, metrics, log, config — but never mentions whether the LaunchAgent is loaded/running. Users can't tell if background collection is active without manually checking `launchctl`.

**Acceptance**:
- Add a `LaunchAgent:` line that checks `launchctl print gui/$(id -u)/com.idlewatch.agent` and shows `running` / `not loaded` / `not installed`

---

## 2026-03-20 — Day 1: Initial Polish Pass

### ~~P1 — LaunchAgent install path clarity~~ → merged into P2 above

### P2 — env file persistence during quickstart ✅ FIXED

**Note**: Code now calls `writeSecureFile(outputEnvFile, ...)` during the wizard before the test publish. Confirmed in `enrollment.js`.

### P2 — metric toggle persistence (create flow)

**Location**: `src/custom-telemetry.js` / `bin/idlewatch-agent.js`

**Issue**: `idlewatch create` saves to JSON but doesn't update `~/.idlewatch/idlewatch.env`. Not a functional bug (custom metrics load from their own JSON file), but confusing because other config lives in the env file.

**Status**: Low priority — custom metrics use a separate JSON store by design. Could mention this in `idlewatch create` output.

### P3 — OpenClaw usage stale threshold clarity

**Status**: Docs-only. Low priority.

### P2 — npx install path clarity → merged into P2 above

---

## Priority Summary

| # | Severity | Summary |
|---|----------|---------|
| 1 | P1 | `--help` dumps 25+ advanced env vars — overwhelming for users |
| 2 | P1 | `status` says "no saved config" even with active local data |
| 3 | P1 | `enrollment.js` text-mode path has undeclared variable bug |
| 4 | P2 | No CLI subcommand for LaunchAgent install/uninstall |
| 5 | P2 | `create` wizard can't edit/delete existing custom metrics |
| 6 | P2 | Post-quickstart success message is debug-formatted |
| 7 | P2 | npx menubar help text is vague / dead-end |
| 8 | P3 | LaunchAgent uninstall has no CLI path |
| 9 | P3 | `.env.example` has misleading defaults |
| 10 | P3 | `status` doesn't show LaunchAgent state |
