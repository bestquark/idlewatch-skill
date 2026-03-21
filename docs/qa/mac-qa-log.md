# IdleWatch Installer QA Log

## Session
[cron:c1e239d5-6bd1-42fd-8f86-08fc0615bbe1 IdleWatch Installer QA polish lane]

---

## 2026-03-21 — Round 6: Reconfirmation + New Findings

### All prior findings reconfirmed OPEN

P0 crash reproduced: `src/enrollment.js` line 372 assigns to undeclared `mode`, line 382 references `cloudApiKey` (declared as `cloudApiKeyOpt` at line 312). Fix in `enrollment-new.js` (lines 311-312: `let mode`, `let cloudApiKey`) is still not swapped in.

### NEW P2 — `enrollment-full-backup.js` dev artifact in project root

**Location**: `/enrollment-full-backup.js` (project root)

**Issue**: Third leftover dev file alongside `src/enrollment-new.js` and `src/enrollment.js.tmp`. Sits in package root. Not in `"files"` array so won't ship via npm, but clutters the repo.

**Acceptance**: Delete after merging fix into `enrollment.js`.

### P1 — `--help` env var dump (reconfirmed, measured)

69 lines total. 25+ advanced env vars (probe timeouts, stale thresholds, Firebase emulator settings) shown to every user. The first 18 lines are useful; lines 19-69 are internals.

**Acceptance**: Show only the "Common env" block by default. Move advanced/Firebase sections behind `--help-env` or `--help-advanced`.

### P1 — `status` "no saved config" false negative (reconfirmed, root cause clarified)

`~/.idlewatch/idlewatch.env` doesn't exist, so `(no saved config)` is technically correct. But the device is actively running via LaunchAgent (`com.idlewatch.agent` is loaded) with config from env vars baked into the plist. This makes "no saved config" misleading — user sees a working device and thinks something is broken.

**Acceptance**: If LaunchAgent is loaded or env vars provide config, show `Config: (env vars / LaunchAgent)` instead of `(no saved config)`.

### P2 — `src/status.js` dead code (reconfirmed, detailed)

- Missing `import fs/os/path` — would crash on any call
- `${'${...}'}` double-wrapped template literals produce literal strings
- `getLastPublishResult()` references out-of-scope `config`
- Not imported by any file
- 90 lines of dead code that would ship in npm package

**Acceptance**: Delete file (inline status logic already lives in `bin/idlewatch-agent.js` lines 889+).

---

## Priority Summary (updated 2026-03-21 Round 6)

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | **P0** | `enrollment.js` undeclared `mode`/`cloudApiKey` — fix in `enrollment-new.js` not swapped | OPEN |
| 2 | P1 | `package.json` self-dependency (`"idlewatch": "^0.1.9"`) | OPEN |
| 3 | P1 | `--help` dumps 69 lines including 25+ advanced env vars | OPEN |
| 4 | P1 | `status` says "no saved config" with active LaunchAgent | OPEN |
| 5 | P2 | Dev artifacts: `enrollment-new.js`, `enrollment.js.tmp`, `enrollment-full-backup.js` | OPEN (expanded) |
| 6 | P2 | No CLI subcommand for LaunchAgent install/uninstall | OPEN |
| 7 | P2 | `create` wizard can't edit/delete existing custom metrics | OPEN |
| 8 | P2 | Post-quickstart success/error messages are debug-formatted | OPEN |
| 9 | P2 | npx menubar help text is vague / dead-end | OPEN |
| 10 | P2 | `src/status.js` dead code with broken imports/template literals | OPEN |
| 11 | P3 | LaunchAgent uninstall has no CLI path | OPEN |
| 12 | P3 | `.env.example` has misleading defaults | OPEN |
| 13 | P3 | `status` doesn't show LaunchAgent state | OPEN |
| 14 | P3 | `.env.example` mixes user config with CI/packaging vars (73 lines) | OPEN |

---

## 2026-03-20 — Round 5: Verification + New Findings

### Verification of prior findings

| # | Finding | Status |
|---|---------|--------|
| 1 | **P0** `enrollment.js` undeclared `mode`/`cloudApiKey` | **OPEN — fix exists in `enrollment-new.js` but not swapped in** |
| 2 | P1 `package.json` self-dependency | OPEN |
| 3 | P1 `--help` wall of env vars (69 lines) | OPEN |
| 4 | P1 `status` "no saved config" false negative | OPEN |
| 5 | P2 No CLI subcommand for LaunchAgent install/uninstall | OPEN |
| 6 | P2 `create` can't edit/delete existing metrics | OPEN |
| 7 | P2 Post-quickstart success message debug-formatted | OPEN |
| 8 | P2 npx menubar help text vague | OPEN |
| 9 | P2 `src/status.js` dead code with broken imports/template literals | OPEN |
| 10 | P3 LaunchAgent uninstall no CLI path | OPEN |
| 11 | P3 `.env.example` misleading defaults | OPEN |
| 12 | P3 `status` doesn't show LaunchAgent state | OPEN |
| 13 | P3 `.env.example` mixes user config with CI/packaging vars | OPEN |

---

### P0 — `enrollment.js` undeclared `mode`/`cloudApiKey` — FIX EXISTS BUT NOT DEPLOYED

**Update**: `src/enrollment-new.js` (463 lines) contains the fix — declares `let mode` at line 311 and `let cloudApiKey` properly. However, the live import in `bin/idlewatch-agent.js` still points to `src/enrollment.js` (the broken version). The fix is sitting in a sibling file that nothing imports.

**Also**: `src/enrollment.js.tmp` is a 1-line placeholder (`// ENROLLMENT.JS - Full file`). Both `enrollment-new.js` and `enrollment.js.tmp` are leftover dev artifacts.

**Repro** (confirmed crash still live):
```
cd idlewatch-skill
IDLEWATCH_ENROLL_NON_INTERACTIVE=1 node -e "import('./src/enrollment.js').then(m => m.runEnrollmentWizard({ nonInteractive: true, cloudApiKey: 'iwk_test1234567890abcdef', deviceName: 'test' }))"
# → ReferenceError: mode is not defined
```

**Fix**: Replace `src/enrollment.js` with `src/enrollment-new.js`, delete both `enrollment-new.js` and `enrollment.js.tmp`.

**Acceptance**:
- `bin/idlewatch-agent.js` imports from `src/enrollment.js` which contains the fixed code
- No `enrollment-new.js` or `enrollment.js.tmp` in `src/`
- Non-interactive enrollment completes without ReferenceError

### NEW P2 — Dev artifact files in `src/` shipped in package

**Location**: `src/enrollment-new.js`, `src/enrollment.js.tmp`

**Issue**: Two leftover dev files are in the source tree. `enrollment-new.js` contains the fix for the P0 bug but is never imported. `enrollment.js.tmp` is a 1-line placeholder. Both would ship in an npm publish (since `"files"` includes `"src"`).

**Acceptance**: Delete both files after merging the fix into `enrollment.js`.

### P2 — Post-quickstart success/error messages are debug-formatted (STILL OPEN)

**Location**: `bin/idlewatch-agent.js` lines 588, 608

Success: `✅ Setup complete. Mode=${result.mode} device=${result.deviceName} envFile=${result.outputEnvFile}`
Error: `⚠️ Setup is not finished yet. Mode=${result.mode} device=${result.deviceName} envFile=${result.outputEnvFile}`

Both read like interpolated debug logs, not user-facing copy.

**Acceptance** (success):
```
✅ Setup complete!
   Device: My Mac mini (cloud mode)
   Config: ~/.idlewatch/idlewatch.env
   Next: run `idlewatch run` to start monitoring
```

**Acceptance** (error):
```
⚠️ Setup saved, but the first telemetry sample didn't publish.
   Device: My Mac mini
   Config: ~/.idlewatch/idlewatch.env
   Retry: idlewatch --once
```

### P2 — `src/status.js` dead code (STILL OPEN, CONFIRMED BROKEN)

Line 22: `${'${process.env...}'}` double-wrapped template literal produces literal `${...}` strings.
Missing `import fs`, `import os`, `import path` — would crash on first call.
`getLastPublishResult()` references `config` not in scope.
Not imported anywhere.

**Acceptance**: Delete or fix and wire into the `status` subcommand.

---

## Priority Summary (updated 2026-03-20 Round 5)

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | **P0** | `enrollment.js` undeclared `mode`/`cloudApiKey` — fix exists in `enrollment-new.js` but not swapped | OPEN |
| 2 | P1 | `package.json` self-dependency (`"idlewatch": "^0.1.9"`) | OPEN |
| 3 | P1 | `--help` dumps 69 lines including 25+ advanced env vars | OPEN |
| 4 | P1 | `status` says "no saved config" with active local data | OPEN |
| 5 | P2 | Dev artifact files (`enrollment-new.js`, `enrollment.js.tmp`) in source tree | NEW |
| 6 | P2 | No CLI subcommand for LaunchAgent install/uninstall | OPEN |
| 7 | P2 | `create` wizard can't edit/delete existing custom metrics | OPEN |
| 8 | P2 | Post-quickstart success/error messages are debug-formatted | OPEN |
| 9 | P2 | npx menubar help text is vague / dead-end | OPEN |
| 10 | P2 | `src/status.js` dead code with broken imports/template literals | OPEN |
| 11 | P3 | LaunchAgent uninstall has no CLI path | OPEN |
| 12 | P3 | `.env.example` has misleading defaults | OPEN |
| 13 | P3 | `status` doesn't show LaunchAgent state | OPEN |
| 14 | P3 | `.env.example` mixes user config with CI/packaging vars (73 lines) | OPEN |
