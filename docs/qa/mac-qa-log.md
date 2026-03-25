# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R80 (installer/CLI polish follow-up)

## Status: OPEN — two small-but-real polish issues remain

Core setup still works. This pass found two UX issues that are easy to miss in code review but noticeable in real setup/testing flows.

---

## Priority findings

### M1. LaunchAgent status/install logic leaks across HOMEs and can report the wrong background state
**Priority:** Medium
**Status:** Open

**Why this matters:**
The CLI treats `com.idlewatch.agent` as a single global truth and checks `launchctl print gui/$UID/com.idlewatch.agent` without tying that result back to the plist path or current config home. In practice, a clean temp HOME can show `LaunchAgent loaded` even when this install has no plist/config there, and `install-agent` can fail because some other IdleWatch agent with the same label is already loaded. That makes installer QA and multi-install testing feel confusing and a little haunted.

**Exact repro:**
1. Ensure an IdleWatch LaunchAgent is already installed in your normal home.
2. From a source checkout, run with a clean temp HOME:
   ```bash
   cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
   TMPHOME=$(mktemp -d)
   HOME="$TMPHOME" node bin/idlewatch-agent.js status
   ```
3. Observe status can report:
   ```text
   Background:   LaunchAgent loaded (running, pid ...)
   ```
   even though `HOME="$TMPHOME"` has no saved config and no temp-home plist installed.
4. In the same temp HOME, run:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
   ```
5. Observe install can fail with a label/bootstrap conflict instead of feeling like an isolated clean install test.

**Acceptance criteria:**
- [ ] `status` only reports background state for the install/config it actually owns.
- [ ] `install-agent` behaves predictably during clean-home/source-checkout QA instead of colliding with another IdleWatch install under the same user.
- [ ] If full isolation is intentionally unsupported, the CLI should say that plainly and calmly.
- [ ] Messaging stays simple; no launchctl jargon dump.

---

### M2. Quickstart/status still assume a global `idlewatch` binary in source and `npx` flows
**Priority:** Medium
**Status:** Open

**Why this matters:**
`install-agent` got nicer about matching the current invocation path, but other success/status surfaces still hard-code `idlewatch ...`. In source-checkout or `npx` usage, that leaves users with a subtle “wait, do I actually have that command?” moment right after setup succeeds. The product should feel low-friction exactly there.

**Exact repro:**
1. From a source checkout, run quickstart in non-interactive local mode:
   ```bash
   cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
   TMPHOME=$(mktemp -d)
   HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
     node bin/idlewatch-agent.js quickstart --no-tui
   ```
2. Observe the success block ends with:
   ```text
   To keep it running:
     idlewatch install-agent   Auto-start in background (recommended)
     idlewatch run             Run in foreground
   ```
3. Then run:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js status
   ```
4. Observe the footer still says:
   ```text
   Change:   idlewatch configure
   Apply:    restart IdleWatch after config changes
   ```
   even though the user entered via `node bin/idlewatch-agent.js ...`, not a guaranteed global `idlewatch` binary.

**Acceptance criteria:**
- [ ] Quickstart success copy uses the same command path style as the current invocation (`idlewatch`, `npx idlewatch`, repo script path, or bundled app path).
- [ ] `status` follow-up hints do the same.
- [ ] Keep the copy short and quiet — no install-mode lecture.
- [ ] Global installs can continue to show `idlewatch ...`.

---

## Verified areas in this cycle
- `install-agent --help` now correctly says saved config is optional on first install.
- Source-checkout `install-agent` follow-up copy now derives command paths better than before.
- Local-mode quickstart still saves config and runs a first verification sample.
- Device name and metric selections persist to `~/.idlewatch/idlewatch.env`.
- `--test-publish` still behaves as the documented alias for `--once`.

## Suggested next move
Small UX-only cleanup pass:
1. Reuse the existing command-path inference helper everywhere user-facing next-step commands are printed.
2. Tighten LaunchAgent state detection so status/install messages describe the current install, not any agent with the shared label.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
TMPHOME=$(mktemp -d)
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
  node bin/idlewatch-agent.js quickstart --no-tui
HOME="$TMPHOME" node bin/idlewatch-agent.js status
```
