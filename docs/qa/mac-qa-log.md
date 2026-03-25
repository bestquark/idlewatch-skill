# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R84 (installer/CLI polish follow-up)

## Status: OPEN — `install-agent` is not cleanly re-runnable even though the CLI tells users to re-run it after config changes

Core setup/install flow still works. This pass found one remaining user-facing polish issue: the CLI repeatedly tells users to re-run `install-agent` after changing config, but a second `install-agent` currently fails with raw `launchctl bootstrap` noise instead of behaving like a calm restart/update path.

---

## Priority findings

### M1. `install-agent` is not idempotent; re-running it after setup/config changes throws raw `launchctl` bootstrap errors
**Priority:** Medium  
**Status:** Open

**Why this matters:**
This is exactly the path the product nudges users toward. `quickstart`, `configure --help`, and `status` all say to re-run `install-agent` after config changes if IdleWatch is already running in the background. When that advice leads straight into `Bootstrap failed: 5: Input/output error`, the product feels brittle and much more technical than it should.

The fix does not need a redesign — just a smoother "already installed / restarting with latest config" behavior and copy that stays human.

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
3. Install the LaunchAgent once:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
   ```
4. Re-run the exact command, following the CLI's own "re-run install-agent after config changes" guidance:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
   ```
5. Observe the second run fail with raw platform noise:
   ```text
   LaunchAgent install failed: Bootstrap failed: 5: Input/output error
   Try re-running the command as root for richer errors.
   Plist written to .../Library/LaunchAgents/com.idlewatch.agent.plist. IdleWatch background install is shared per macOS user, so only one can be loaded at a time.
   Try again: node bin/idlewatch-agent.js install-agent
   ```

**Acceptance criteria:**
- [ ] Re-running `install-agent` when IdleWatch is already installed succeeds instead of failing with raw `launchctl` bootstrap output.
- [ ] The command behaves like a tidy restart/update path: either reloads the existing agent automatically or clearly says it's already installed and refreshed.
- [ ] Copy stays calm and human: no suggestion to run as root for this expected state, no low-level `bootstrap` jargon.
- [ ] `status`, `configure --help`, and setup completion copy remain truthful if they continue telling users to re-run `install-agent` after config changes.
- [ ] Source checkout, global npm install, `npx`, and packaged-app flows all keep the same low-friction behavior.

---

## Verified in this cycle
- Source-checkout command hints remain consistent in quickstart/status/help copy.
- Fresh `status` still makes saved-config state, local log path, and LaunchAgent state easy to scan.
- `quickstart --no-tui` still persists device name and metrics into the active `idlewatch.env`.
- `--test-publish` still behaves as the documented alias for `--once`.
- First-run `install-agent` / `uninstall-agent` still preserve config and logs as expected.
- The remaining friction is specifically the second `install-agent` run.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
TMPHOME=$(mktemp -d)
HOME="$TMPHOME" node bin/idlewatch-agent.js --help
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
  node bin/idlewatch-agent.js quickstart --no-tui
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
node bin/idlewatch-agent.js configure --help
node bin/idlewatch-agent.js status --help
```

## Notes
- `/Users/luismantilla/.openclaw/workspace/idlewatch-cron-polish-plan.md` currently mirrors older QA-log content more than a distinct plan, so I used `docs/qa/idlewatch-cron-polish-plan.md` plus live CLI behavior as the practical source of truth.
- This is docs-only QA logging for now; no product code changes were made in this cycle.
