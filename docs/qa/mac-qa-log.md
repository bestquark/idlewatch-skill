# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R83 (installer/CLI polish follow-up)

## Status: CLOSED — uninstall copy now matches the active config root

Core setup/install flow still works. This pass found one remaining user-facing polish issue: `uninstall-agent` promises config/logs stay in `~/.idlewatch/` even when IdleWatch is intentionally using a different HOME/config root.

---

## Priority findings

### M1. `uninstall-agent` hard-codes `~/.idlewatch/` in success copy even when config/logs live somewhere else
**Priority:** Medium  
**Status:** Fixed

**Why this matters:**
This is small, but it adds friction right at the "safe to remove" moment. The command correctly preserves config and logs, but the success message points to the wrong place in temp-home, CI, redirected-HOME, and packaged test contexts. That makes a safe action feel less trustworthy than it is.

**Exact repro:**
1. From a source checkout, use a clean temp home:
   ```bash
   cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
   TMPHOME=$(mktemp -d)
   ```
2. Save config in that temp home:
   ```bash
   HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
     node bin/idlewatch-agent.js quickstart --no-tui
   ```
3. Install then uninstall the LaunchAgent:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
   HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
   ```
4. Observe the success copy:
   ```text
   ✅ LaunchAgent removed — background collection stopped.
      Your config and logs are still in ~/.idlewatch/
   ```
5. Compare with the real preserved files, which are actually under:
   ```bash
   ls -la "$TMPHOME/.idlewatch"
   ```

**Acceptance criteria:**
- [x] `uninstall-agent` does not claim `~/.idlewatch/` when the active config/log root resolves elsewhere.
- [x] Success copy either prints the resolved path or uses path-agnostic wording like "Your config and logs were kept.".
- [x] Message still reassures users that uninstall is non-destructive and points to the reinstall command.
- [x] Source checkout, global npm install, `npx`, packaged app, and temp-home QA flows all show accurate low-noise wording.

### M2. Plain-text `configure --no-tui` can leak raw Node "unsettled top-level await" warning on EOF/cancel
**Priority:** Medium  
**Status:** Fixed

**Why this matters:**
This is small but ugly. The setup wizard should feel calm and low-friction; instead, an interrupted plain-text flow can end with a scary runtime warning that looks like a crash dump. End users should never have to parse Node internals just because stdin closed.

**Exact repro:**
1. From a source checkout, run local setup in a clean temp home:
   ```bash
   cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
   TMPHOME=$(mktemp -d)
   HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
     node bin/idlewatch-agent.js quickstart --no-tui
   ```
2. Start plain-text reconfigure without supplying answers:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js configure --no-tui
   ```
3. At the first prompt, send EOF (Ctrl-D), or run from a stdin source that closes immediately.
4. Observe a raw warning like:
   ```text
   Warning: Detected unsettled top-level await at file:///.../bin/idlewatch-agent.js:1076
     await new Promise(() => {})
   ```

**Acceptance criteria:**
- [x] EOF/cancel/closed-stdin exits the plain-text setup flow cleanly with a short human message.
- [x] No raw Node runtime warning, stack-ish snippet, or `top-level await` text is shown.
- [x] Exit code and copy distinguish a deliberate cancel from a real setup failure.
- [x] Behavior is consistent for both `quickstart --no-tui` and `configure --no-tui`.

---

## Verified in this cycle
- Source-checkout command hints remain consistent in quickstart/status/help copy.
- Local-only warning uses the current invocation path in source checkout.
- `--test-publish` still behaves as the documented alias for `--once`.
- Device name and metric selections still persist to `~/.idlewatch/idlewatch.env`.
- `status` still shows persisted config plus LaunchAgent state clearly.
- `install-agent` / `uninstall-agent` still preserve config and logs as expected.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
TMPHOME=$(mktemp -d)
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
  node bin/idlewatch-agent.js quickstart --no-tui
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js configure --no-tui
node bin/idlewatch-agent.js configure --help
node bin/idlewatch-agent.js status --help
node --test test/openclaw-env.test.mjs
```

## Fix applied
- Removed the CLI's never-resolving top-level-await guard for subcommand-only flows and replaced it with a resolved `subcommandPromise` gate before collector startup.
- Plain-text setup cancel/EOF now exits with `Setup cancelled. No changes saved.` and status code 0 instead of looking like a runtime failure.
- `uninstall-agent` now prints the resolved active IdleWatch data directory instead of hard-coding `~/.idlewatch/`, so temp-home and redirected-HOME flows stay accurate.

## Notes
- `/Users/luismantilla/.openclaw/workspace/idlewatch-cron-polish-plan.md` currently mirrors older QA-log content more than a distinct plan, so I used `docs/qa/idlewatch-cron-polish-plan.md` plus live CLI behavior as the practical source of truth.
