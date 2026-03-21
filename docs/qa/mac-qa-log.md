# IdleWatch Installer QA Log

## Session
[cron:c1e239d5-6bd1-42fd-8f86-08fc0615bbe1 IdleWatch Installer QA polish lane]

---

## 2026-03-20 — Round 3: Verification + New Findings

### Verification of Round 2 findings

| # | Finding | Status |
|---|---------|--------|
| 1 | `--help` wall of env vars | **Still open** — 70+ lines, 25+ env vars in default help |
| 2 | `status` "no saved config" false negative | **Still open** — no local-data check |
| 3 | `enrollment.js` undeclared vars (`mode`, `cloudApiKey`) | **Still open — confirmed crash** (see updated P0 below) |
| 4 | No CLI subcommand for LaunchAgent install | **Still open** |
| 5 | `create` can't edit/delete existing metrics | **Still open** |
| 6 | Post-quickstart message debug-formatted | **Still open** |
| 7 | npx menubar help text vague | **Still open** |
| 8 | LaunchAgent uninstall no CLI path | **Still open** |
| 9 | `.env.example` stale defaults | **Still open** |
| 10 | `status` doesn't show LaunchAgent state | **Still open** |

### P0 — `enrollment.js` text-mode path crashes with ReferenceError (UPGRADED from P1)

**Location**: `src/enrollment.js` → `runEnrollmentWizard()` lines 372, 377, 382, 392, 400-410, 439-448

**Issue**: `mode` and `cloudApiKey` are used as bare assignments but never declared with `let`. The file is an ES module (`"type": "module"` in package.json), so strict mode is enforced. Line 372 (`mode = modeInput === '2' ? 'local' : 'production'`) **will throw `ReferenceError: mode is not defined`**. Same for `cloudApiKey` at lines 392/403/410.

The function declares `modeOption` (line ~307) and `cloudApiKeyOpt` (line ~308) but never `let mode` or `let cloudApiKey` at function scope.

**Repro**:
```
idlewatch quickstart --no-tui
# → select mode 1 or 2
# → ReferenceError: mode is not defined
```

**Acceptance**:
- Add `let mode = modeOption` and `let cloudApiKey = cloudApiKeyOpt` near the top of `runEnrollmentWizard()`
- Text-mode quickstart completes without errors on both mode 1 and mode 2

### P1 — `--help` is a wall of env vars

**Status**: Still open. No change since Round 2.

**Acceptance**:
- Default `--help` ≤ 30 lines, showing subcommands + quickstart + common env only
- Advanced env vars move to `--help-advanced` or docs

### P1 — `status` says "no saved config" even when device has data

**Status**: Still open. No change since Round 2.

**Acceptance**:
- If local log has recent samples but no env file, show `Config: process env (no saved file)` instead of nudging quickstart

### P2 — No CLI subcommand for LaunchAgent install/uninstall

**Status**: Still open. Shell scripts exist (`scripts/install-macos-launch-agent.sh`, `scripts/uninstall-macos-launch-agent.sh`) but no CLI path.

**Acceptance**: `idlewatch launchagent install` / `idlewatch launchagent uninstall` wrappers, OR clear copy-pasteable commands in success/status output.

### P2 — `create` wizard can't edit/delete existing custom metrics

**Status**: Still open. Always starts fresh.

### P2 — Post-quickstart success message is debug-formatted

**Status**: Still open. `Mode=production device=MyDevice envFile=...` is not user-facing copy.

### P2 — npx menubar help text is vague

**Status**: Still open. "install the package globally first or run the command from the cloned repo" — no concrete command.

### P2 — `src/status.js` has broken template literals and undefined references

**Location**: `src/status.js` — `getApiKeyStatus()`, `getLastPublishResult()`, `getEnabledMetricsCount()`

**Issue (new)**: `status.js` has several bugs:
1. Template literals use `${'${...}'}` double-wrapping (line ~35, ~54) — produces literal `${...}` strings instead of interpolation
2. `getLastPublishResult()` references `config` (line ~63) but it's not in scope — it's only a param of `buildStatusPayload()`
3. Missing `import fs from 'node:fs'` and `import os from 'node:os'` and `import path from 'node:path'`
4. Functions reference `fs.existsSync`, `fs.readFileSync`, `os.hostname()`, `path.join()` but none are imported

**Impact**: Currently `status.js` isn't imported by the main agent (status display is inline in `idlewatch-agent.js`), so this is dead code. But it'll crash immediately if anyone tries to use it.

**Acceptance**: Either delete `status.js` or fix imports + template literals + scoping so it's usable.

### P3 — LaunchAgent uninstall has no CLI path

**Status**: Still open.

### P3 — `.env.example` has misleading defaults

**Status**: Still open. `IDLEWATCH_HOST=my-host` and relative `./logs/` path mislead copy-pasters.

### P3 — `status` doesn't show LaunchAgent state

**Status**: Still open.

### P3 — `.env.example` is very long and mixes user config with CI/packaging vars

**Location**: `.env.example`

**Issue (new)**: The example env file is 60+ lines and includes `IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION`, `IDLEWATCH_ALLOW_UNSIGNED_TAG_RELEASE`, detailed Firebase emulator docs, and build-time codesigning vars. End users copying this file get overwhelmed. CI/packaging vars don't belong in a user-facing example.

**Acceptance**: Split into `.env.example` (user-facing: device name, API key, metrics, log path) and `.env.ci.example` or document CI vars separately.

---

## Priority Summary (updated 2026-03-20 Round 3)

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | **P0** | `enrollment.js` text-mode crashes — undeclared `mode`/`cloudApiKey` in strict ES module | OPEN |
| 2 | P1 | `--help` dumps 25+ advanced env vars | OPEN |
| 3 | P1 | `status` says "no saved config" with active local data | OPEN |
| 4 | P2 | No CLI subcommand for LaunchAgent install/uninstall | OPEN |
| 5 | P2 | `create` wizard can't edit/delete existing custom metrics | OPEN |
| 6 | P2 | Post-quickstart success message is debug-formatted | OPEN |
| 7 | P2 | npx menubar help text is vague / dead-end | OPEN |
| 8 | P2 | `src/status.js` dead code with broken imports/template literals | OPEN |
| 9 | P3 | LaunchAgent uninstall has no CLI path | OPEN |
| 10 | P3 | `.env.example` has misleading defaults | OPEN |
| 11 | P3 | `status` doesn't show LaunchAgent state | OPEN |
| 12 | P3 | `.env.example` mixes user config with CI/packaging vars | OPEN |
