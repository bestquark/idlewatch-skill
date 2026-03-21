# IdleWatch Installer QA Log

## Session
[cron:c1e239d5-6bd1-42fd-8f86-08fc0615bbe1 IdleWatch Installer QA polish lane]

---

## 2026-03-20 — Round 4: Verification + New Findings

### Verification of Round 3 findings

| # | Finding | Status |
|---|---------|--------|
| 1 | **P0** `enrollment.js` undeclared `mode`/`cloudApiKey` | **Still open — confirmed crash** in both interactive and non-interactive paths |
| 2 | P1 `--help` wall of env vars | **Still open** — 69 lines, 25+ env vars in default help |
| 3 | P1 `status` "no saved config" false negative | **Still open** |
| 4 | P2 No CLI subcommand for LaunchAgent install/uninstall | **Still open** |
| 5 | P2 `create` can't edit/delete existing metrics | **Still open** |
| 6 | P2 Post-quickstart success message debug-formatted | **Still open** |
| 7 | P2 npx menubar help text vague | **Still open** |
| 8 | P2 `src/status.js` broken dead code | **Still open** |
| 9 | P3 LaunchAgent uninstall no CLI path | **Still open** |
| 10 | P3 `.env.example` misleading defaults | **Still open** |
| 11 | P3 `status` doesn't show LaunchAgent state | **Still open** |
| 12 | P3 `.env.example` mixes user config with CI/packaging vars | **Still open** |

### P0 — `enrollment.js` text-mode path crashes — ALL paths (CONFIRMED WORSE)

**Location**: `src/enrollment.js` → `runEnrollmentWizard()` lines 372, 377, 382, 392, 400–410, 439–448

**Issue**: `mode` and `cloudApiKey` are used as bare assignments but never declared with `let`/`const`. Since the file is `"type": "module"` (strict mode), any path reaching line 377 throws `ReferenceError: mode is not defined`.

**Critical**: This crashes even the **non-interactive** path (`--non-interactive` or `IDLEWATCH_ENROLL_NON_INTERACTIVE=1`), not just the text-mode TUI fallback. The TUI path exits early and avoids it, but every non-TUI enrollment path is broken.

**Repro** (non-interactive):
```
cd idlewatch-skill
IDLEWATCH_ENROLL_NON_INTERACTIVE=1 node -e "import('./src/enrollment.js').then(m => m.runEnrollmentWizard({ nonInteractive: true }))"
# → ReferenceError: mode is not defined
```

**Repro** (interactive text fallback):
```
idlewatch quickstart --no-tui
# → select mode 1 or 2
# → ReferenceError: mode is not defined
```

**Root cause**: `modeOption` is declared at line 311 but the code uses bare `mode` starting at line 372. Same pattern with `cloudApiKeyOpt` (line 312) vs bare `cloudApiKey` (line 382+).

**Fix**: Add `let mode = modeOption` and `let cloudApiKey = cloudApiKeyOpt` near line 315.

**Acceptance**:
- `runEnrollmentWizard({ nonInteractive: true })` completes without ReferenceError
- `idlewatch quickstart --no-tui` completes without ReferenceError
- Both `mode=1` (production) and `mode=2` (local) paths work

### NEW P1 — `package.json` self-dependency causes npm install loop

**Location**: `package.json` → `dependencies`

**Issue**: The package declares `"idlewatch": "^0.1.9"` as a dependency on itself. The package name is `"idlewatch"`. This is a circular self-dependency. On a clean `npm install`, npm may try to fetch/install itself from the registry, wasting time and potentially failing if the package isn't published yet or the version doesn't match.

**Repro**:
```
cat package.json | grep -A2 '"dependencies"'
# → "idlewatch": "^0.1.9"  (self-referencing)
```

**Acceptance**: Remove the self-dependency line from `dependencies`. If `firebase-admin` is the only real dependency, `dependencies` should be `{ "firebase-admin": "^12.7.0" }`.

### P1 — `--help` is a wall of env vars (STILL OPEN)

**Details**: 69 lines. The "Advanced env tuning" and "Advanced Firebase / emulator mode" sections (35+ lines) overwhelm first-time users. Only ~30 lines are relevant for quickstart/daily use.

**Acceptance**:
- Default `--help` ≤ 35 lines: subcommands + quickstart steps + "Common env" only
- Advanced env vars move to `--help-advanced` or a separate `idlewatch env` subcommand

### P1 — `status` says "no saved config" even when device has data (STILL OPEN)

**Acceptance**: If local log has recent samples but no env file, show `Config: process env (no saved file)` instead of nudging quickstart.

### P2 — No CLI subcommand for LaunchAgent install/uninstall (STILL OPEN)

Shell scripts exist but no CLI path. Users have to know about `npm run install:macos-launch-agent`.

**Acceptance**: `idlewatch launchagent install` / `idlewatch launchagent uninstall` wrappers, OR clear copy-pasteable commands in success/status output.

### P2 — `create` wizard can't edit/delete existing custom metrics (STILL OPEN)

Always starts fresh, no way to edit or remove.

### P2 — Post-quickstart success message is debug-formatted (STILL OPEN)

`✅ Setup complete. Mode=${result.mode} device=${result.deviceName} envFile=${result.outputEnvFile}` reads like a debug log.

**Acceptance**: User-facing copy like:
```
✅ Setup complete!
   Device: My Mac mini (cloud mode)
   Config: ~/.idlewatch/idlewatch.env
   Next: run `idlewatch run` to start monitoring
```

### P2 — npx menubar help text is vague / dead-end (STILL OPEN)

"If you used npx, install the package globally first or run the command from the cloned repo." — no concrete command given.

**Acceptance**: Show `npm install -g idlewatch && idlewatch menubar --launch` explicitly.

### P2 — `src/status.js` dead code with broken imports/template literals (STILL OPEN)

- Missing `import fs`, `import os`, `import path`
- Template literals use `${'${...}'}` double-wrapping (produces literal `${...}`)
- `getLastPublishResult()` references `config` which isn't in scope
- Currently dead code (not imported anywhere), but would crash if used

**Acceptance**: Either delete `status.js` or fix all issues and wire it into the `status` subcommand.

### P3 findings (STILL OPEN, no change)

- LaunchAgent uninstall no CLI path
- `.env.example` misleading defaults (`IDLEWATCH_HOST=my-host`, relative `./logs/`)
- `status` doesn't show LaunchAgent state
- `.env.example` mixes user config with CI/packaging vars (73 lines)

---

## Priority Summary (updated 2026-03-20 Round 4)

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | **P0** | `enrollment.js` — undeclared `mode`/`cloudApiKey` crashes ALL non-TUI enrollment | OPEN |
| 2 | **P1** | `package.json` self-dependency (`"idlewatch": "^0.1.9"` depends on itself) | NEW |
| 3 | P1 | `--help` dumps 25+ advanced env vars (69 lines) | OPEN |
| 4 | P1 | `status` says "no saved config" with active local data | OPEN |
| 5 | P2 | No CLI subcommand for LaunchAgent install/uninstall | OPEN |
| 6 | P2 | `create` wizard can't edit/delete existing custom metrics | OPEN |
| 7 | P2 | Post-quickstart success message is debug-formatted | OPEN |
| 8 | P2 | npx menubar help text is vague / dead-end | OPEN |
| 9 | P2 | `src/status.js` dead code with broken imports/template literals | OPEN |
| 10 | P3 | LaunchAgent uninstall has no CLI path | OPEN |
| 11 | P3 | `.env.example` has misleading defaults | OPEN |
| 12 | P3 | `status` doesn't show LaunchAgent state | OPEN |
| 13 | P3 | `.env.example` mixes user config with CI/packaging vars (73 lines) | OPEN |
