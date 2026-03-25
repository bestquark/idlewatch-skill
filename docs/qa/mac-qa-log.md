# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R85 (installer/CLI polish regression check)

## Status: CLOSED — refresh path now behaves like a clean re-run

Core setup/install flow still works, and the remaining polish regression from this pass has been fixed. Re-running `install-agent` after setup/config changes now behaves like a normal refresh instead of punting the user into a manual “wait and try again” loop.

---

## Priority findings

### M1. `install-agent` refresh path is still flaky; the recommended re-run flow can fail on the second run
**Priority:** Medium  
**Status:** Closed

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
- [x] Re-running `install-agent` immediately after a successful install succeeds reliably in the normal case.
- [x] The command behaves like a true refresh/update path, not a “maybe try again in a moment” path.
- [x] `status`, `configure --help`, and setup completion copy remain truthful if they continue telling users to re-run `install-agent` after config changes.
- [x] Copy stays calm and human if macOS truly misbehaves, but the expected second-run path should not depend on a manual retry.
- [x] Source checkout, global npm install, `npx`, and packaged-app flows all keep the same low-friction behavior.

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

## Resolution
- `install-agent` refresh now retries the `launchctl bootstrap` step with a short bounded backoff instead of only one tiny 200ms retry window.
- If macOS reports a transient teardown error but the service is already back, the CLI now treats that as a successful refresh instead of surfacing a false failure.
- Reproduced with the exact temp-home source-checkout flow from this QA note: first install succeeded, immediate second `install-agent` re-run succeeded, `status` still showed the agent loaded, and `uninstall-agent` still cleaned up without removing saved config.

## Notes
- `/Users/luismantilla/.openclaw/workspace/idlewatch-cron-polish-plan.md` and `docs/qa/idlewatch-cron-polish-plan.md` still read more like historical QA snapshots than an active plan, so live CLI behavior remains the practical source of truth for this cycle.
