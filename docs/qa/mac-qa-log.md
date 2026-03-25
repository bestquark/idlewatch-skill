# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R85 (installer/CLI polish regression check)

## Status: OPEN — one medium polish regression remains in the refresh path

Core setup/install flow still works, and most of the earlier polish holds up well. The remaining user-facing issue from this pass is that the recommended `install-agent` refresh path is still not reliably idempotent: re-running it after setup/config changes can still fail with a “wait a moment, then run it again” message instead of behaving like a clean refresh.

---

## Priority findings

### M1. `install-agent` refresh path is still flaky; the recommended re-run flow can fail on the second run
**Priority:** Medium  
**Status:** Open

**Why this matters:**
This is still the main “apply my saved changes” path the product points users toward. The wording is much better than the earlier raw `launchctl bootstrap` error, but the user experience is still brittle: I followed the exact recommended flow and the second `install-agent` run failed anyway. From an end-user perspective, that still feels like “I changed settings, then the product told me to run a command, and the command did not work.”

This is polish, not architecture. The path should feel boring, dependable, and non-technical.

**Exact repro:**
1. From a source checkout, use a clean temp home:
   ```bash
   cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
   TMPHOME=$(mktemp -d)
   ```
2. Save config in that temp home:
   ```bash
   HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
     IDLEWATCH_ENROLL_METRICS='agent_activity,token_usage' \
     node bin/idlewatch-agent.js quickstart --no-tui
   ```
3. Install the LaunchAgent once:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
   ```
4. Re-run the exact command, following the CLI’s own “re-run install-agent after config changes” guidance:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
   ```
5. Observe the second run fail instead of acting like a clean refresh:
   ```text
   LaunchAgent install failed.
   IdleWatch stopped the old background agent, but macOS did not finish reloading it in time.
   Please wait a moment, then run: node bin/idlewatch-agent.js install-agent
   Plist written to .../Library/LaunchAgents/com.idlewatch.agent.plist. IdleWatch background install is shared per macOS user, so only one can be loaded at a time.
   ```

**Acceptance criteria:**
- [ ] Re-running `install-agent` immediately after a successful install succeeds reliably in the normal case.
- [ ] The command behaves like a true refresh/update path, not a “maybe try again in a moment” path.
- [ ] `status`, `configure --help`, and setup completion copy remain truthful if they continue telling users to re-run `install-agent` after config changes.
- [ ] Copy stays calm and human if macOS truly misbehaves, but the expected second-run path should not depend on a manual retry.
- [ ] Source checkout, global npm install, `npx`, and packaged-app flows all keep the same low-friction behavior.

---

## Verified in this cycle
- `quickstart --no-tui` still persists device name and metrics into the active `idlewatch.env`.
- Device identity persisted cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- `status` still makes saved-config state, metrics enabled, local log path, log size, last sample age, and LaunchAgent state easy to scan.
- `--test-publish` still behaves as the documented alias for `--once`.
- First-run `install-agent` still succeeds and explains uninstall safety clearly.
- `uninstall-agent` still preserves config and logs as expected.
- npm/global vs `npx` setup command hints are mostly clear and consistent in help/postinstall copy.

## Minor notes (no action yet)
- The setup completion block is mostly clean, but `⚠️ Sample collected (3 metrics) (not published)` immediately followed by `✅ Setup complete — "QA Box" is live!` in local-only mode is a tiny bit visually noisy / emotionally mixed. Not a bug, just worth keeping an eye on if more copy polish happens.
- `status` before first setup defaults to a full metrics list even when no saved config exists yet. This is acceptable, but slightly reads like “already configured defaults” rather than “what will be monitored if you set it up.” Low priority.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
TMPHOME=$(mktemp -d)
HOME="$TMPHOME" node bin/idlewatch-agent.js --help
HOME="$TMPHOME" node bin/idlewatch-agent.js configure --help
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_METRICS='agent_activity,token_usage' \
  node bin/idlewatch-agent.js quickstart --no-tui
cat "$TMPHOME/.idlewatch/idlewatch.env"
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
node scripts/postinstall.mjs
```

## Notes
- The current behavior is clearly better than the earlier raw `launchctl` error path, but it is not yet polished enough to be called a dependable refresh flow.
- `/Users/luismantilla/.openclaw/workspace/idlewatch-cron-polish-plan.md` and `docs/qa/idlewatch-cron-polish-plan.md` still read more like historical QA snapshots than an active plan, so live CLI behavior remains the practical source of truth for this cycle.
