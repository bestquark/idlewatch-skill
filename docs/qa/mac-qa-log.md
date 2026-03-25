# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R81 (installer/CLI polish follow-up)

## Status: CLOSED — copy consistency polish landed

Core setup still works. The remaining source-checkout/local-mode copy inconsistency was fixed in this pass.

---

## Priority findings

### M1. A few follow-up messages still hard-code `idlewatch ...` after source-checkout invocation
**Priority:** Medium
**Status:** Fixed

**Why this matters:**
The main quickstart success block and `status` footer now correctly mirror the current invocation path, which feels much better. But a few adjacent messages still fall back to plain `idlewatch ...`, so the experience still has a tiny "wait, is that command actually installed here?" wobble right after setup. It is small, but it lands at exactly the moment where the product should feel cleanest.

**Exact repro:**
1. From a source checkout, run a local-mode setup flow with a clean temp home:
   ```bash
   cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
   TMPHOME=$(mktemp -d)
   HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
   HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
     node bin/idlewatch-agent.js quickstart --no-tui
   HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
   HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
   ```
2. Observe the main success/status guidance uses the correct repo-script command path.
3. Observe nearby follow-up copy still hard-codes global-binary wording, for example:
   ```text
   Running in local-only mode — telemetry is saved to disk but not published. Run idlewatch configure to add a cloud API key.
   ```
   and
   ```text
   Re-enable:  idlewatch install-agent
   ```
4. Also inspect subcommand help:
   ```bash
   node bin/idlewatch-agent.js configure --help
   node bin/idlewatch-agent.js status --help
   ```
5. Observe help text still says `re-run idlewatch install-agent ...` even when the current invocation path is `node bin/idlewatch-agent.js ...`.

**Acceptance criteria:**
- [x] Source-checkout and `npx` flows use the same inferred command-path style across all user-facing follow-up copy, not just the main success/status blocks.
- [x] At minimum, align local-only warning text, uninstall follow-up text, and subcommand help text.
- [x] Keep the copy short and boring in a good way — no install-mode explanation dump.
- [x] Global installs can continue to show `idlewatch ...`.

---

## Verified areas in this cycle
- `install-agent` in a clean temp HOME still behaves as expected for this host and no longer reports haunted cross-HOME state.
- Quickstart success copy uses the current invocation path in source checkout.
- Local-only warning now uses the current invocation path in source checkout.
- `uninstall-agent` follow-up now uses the current invocation path in source checkout.
- `configure --help` and `status --help` now use the current invocation path in source checkout.
- `status` footer uses the current invocation path in source checkout.
- Device name and metric selections persist to `~/.idlewatch/idlewatch.env`.
- `--test-publish` still behaves as the documented alias for `--once`.
- Telemetry-path regression suite still passes (`node --test test/openclaw-env.test.mjs`).

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
node bin/idlewatch-agent.js configure --help
node bin/idlewatch-agent.js status --help
```

## Notes
- The top-level polish-plan file at `/Users/luismantilla/.openclaw/workspace/idlewatch-cron-polish-plan.md` currently contains old QA-log content rather than a distinct plan. I treated `docs/qa/idlewatch-cron-polish-plan.md` plus live CLI behavior as the source of truth for this pass.
