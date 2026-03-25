# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R82 (installer/CLI polish follow-up)

## Status: CLOSED — setup-flow cancel path polished

Core setup/install flow still works. This pass found one remaining UX wart in the plain-text setup path: EOF/cancel can leak a raw Node.js warning into the terminal.

---

## Priority findings

### M1. Plain-text `configure --no-tui` can leak raw Node "unsettled top-level await" warning on EOF/cancel
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

## Notes
- `/Users/luismantilla/.openclaw/workspace/idlewatch-cron-polish-plan.md` currently mirrors older QA-log content more than a distinct plan, so I used `docs/qa/idlewatch-cron-polish-plan.md` plus live CLI behavior as the practical source of truth.
