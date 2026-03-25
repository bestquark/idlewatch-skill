# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R88 (installer/CLI polish follow-up)

## Status: CLOSED — configure/setup copy now matches the running-agent flow

The core flow still works, and this last setup/control-loop mismatch is now fixed: after changing settings while the LaunchAgent is already installed, the setup-complete screen now explicitly says the background agent is already running and tells the user to refresh it.

This keeps the product feeling calm and deliberate: saved config still updates correctly, and now the immediate post-configure success copy matches what `status` already explains.

---

## Priority findings

### M1. `configure` success copy is misleading when the background LaunchAgent is already installed
**Priority:** Medium  
**Status:** Fixed

**Why this matters:**
This is exactly the kind of tiny setup wrinkle people feel more than they describe. The current `configure` flow correctly saves the new config, and `status` correctly says to re-run `install-agent` if the background agent is already running. But the success screen shown immediately after `configure` still uses generic first-run wording:

- `To keep it running:`
- `idlewatch install-agent   Auto-start in background (recommended)`
- `idlewatch run   Run in foreground`

That copy is fine for first setup, but it is a little off once a LaunchAgent is already loaded. In that situation, the product should feel more explicit and less ambiguous:

- background collection is already enabled
- the saved config changed successfully
- the user should refresh the background agent so it picks up the new config

Right now the user has to mentally reconcile the setup-complete screen with the later `status` screen. For a minimal utility, that is unnecessary friction.

**Exact repro:**
1. Start with a fresh home and complete local setup:
   ```bash
   TMPHOME=$(mktemp -d)
   cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
   HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
     IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
     IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
     node bin/idlewatch-agent.js quickstart --no-tui
   ```
2. Install the background agent:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
   ```
3. Change metrics with `configure`:
   ```bash
   HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
     IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
     IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
     node bin/idlewatch-agent.js configure --no-tui
   ```
4. Observe the setup-complete copy:
   - It still says `To keep it running:` and presents `install-agent` like a first-run auto-start action.
5. Compare with `status` immediately after:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js status
   ```
6. Observe the mismatch:
   - `status` correctly reports the LaunchAgent is already loaded.
   - `status` also correctly says to re-run `install-agent` after config changes.
   - The just-finished `configure` flow did not say that clearly.

**Acceptance criteria:**
- [x] After `configure`, if a LaunchAgent is already installed/loaded, the success copy explicitly says the background agent is already running.
- [x] The post-configure copy tells the user to refresh/re-run `install-agent` so the saved config is applied.
- [x] First-run setup copy stays simple for users who have not installed the LaunchAgent yet.
- [x] `quickstart`, `configure`, `status`, and `install-agent` all use consistent language about when config changes take effect.
- [x] The result feels calmer and less ambiguous, without adding extra technical detail.

---

## Verified in this cycle
- `quickstart --no-tui` still persists device name and selected monitor targets into the active `idlewatch.env`.
- Device identity still persists cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- Reconfiguring metrics updates the saved env file correctly.
- `status` still makes saved-config state, enabled metrics, local log path, log size, last sample age, and LaunchAgent state easy to scan.
- `status` still gives the right apply/restart guidance for an already-running LaunchAgent.
- `--test-publish` still behaves as the documented alias for `--once`.
- `install-agent` / `uninstall-agent` behavior remains concise and safe.
- README quickstart framing still keeps local-only and cloud setup equally intentional.
- Postinstall install-path hints still clearly distinguish global install vs one-off `npx` use.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
TMPHOME=$(mktemp -d)
HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
  node bin/idlewatch-agent.js quickstart --no-tui
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
  node bin/idlewatch-agent.js configure --no-tui
HOME="$TMPHOME" node bin/idlewatch-agent.js status
node scripts/postinstall.mjs
sed -n '1,120p' README.md
```

## Resolution
- `configure` / `reconfigure` now detect when the owned LaunchAgent is already loaded and swap the generic first-run footer for a direct refresh hint.
- First-run setup still keeps the old minimal "To keep it running" guidance.
- The change is copy-only around the success footer; saved config behavior and the telemetry path remain unchanged.
- Added a targeted macOS CLI test covering `quickstart` → `install-agent` → `configure` and asserting the new refresh wording.

## Notes
- The issue here was copy consistency, not persistence correctness: config already saved correctly and `status` already communicated the right behavior.
- No auth, ingest, or packaging redesign recommended from this cycle.
- This is exactly the kind of tiny polish that makes the setup flow feel deliberate instead of merely functional.
