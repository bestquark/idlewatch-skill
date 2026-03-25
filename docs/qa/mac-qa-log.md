# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R89 (installer/CLI polish follow-up)

## Status: CLOSED — state-aware status footer aligned after uninstall

The core pipeline still works and the setup/configure flow feels clean overall. One small polish issue remains: `status` still prints the “re-run install-agent after config changes if it's already running in the background” apply hint even when the LaunchAgent is not installed.

This is not a functional bug, but it does add a tiny bit of avoidable cognitive noise right after `uninstall-agent`. For a minimal utility, the control copy should match the current state exactly.

---

## Priority findings

### M1. `status` shows restart/apply guidance that assumes a running LaunchAgent even after uninstall
**Priority:** Medium  
**Status:** Open

**Why this matters:**
After `uninstall-agent`, the status screen correctly says `Background: LaunchAgent not installed`, but the follow-up `Apply:` hint still says:

- `re-run node bin/idlewatch-agent.js install-agent after config changes if it's already running in the background`

That copy is technically true in the abstract, but it is awkward in the exact state the user is currently in. Right after uninstalling, the calmer and clearer guidance is simply to install the agent again if they want background collection back. The current wording makes the user mentally parse a conditional that no longer applies.

This is tiny, but it is exactly the sort of thing that makes a polished setup utility feel either deliberate or slightly generic.

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
2. Install the LaunchAgent:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
   ```
3. Uninstall it:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
   ```
4. Check status:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js status
   ```
5. Observe the mismatch:
   - `Background: LaunchAgent not installed`
   - `Apply:` still references the special case for when it is already running in the background.

**Acceptance criteria:**
- [x] When no LaunchAgent is installed, `status` does not show apply/restart wording that assumes a running background agent.
- [x] The no-agent state uses simpler next-step guidance, e.g. install the agent to re-enable background collection.
- [x] The loaded/running state can keep the existing “re-run install-agent after config changes” guidance.
- [x] The status footer feels state-aware and visually calm, without adding more lines than necessary.

---

## Previous cycle carried forward

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
- `status` now uses a state-aware footer: loaded/running LaunchAgents keep the refresh wording, while the not-installed state switches to a simple re-enable hint.
- First-run setup still keeps the old minimal "To keep it running" guidance.
- The change is copy-only around setup/status footers; saved config behavior and the telemetry path remain unchanged.
- Added/extended targeted macOS CLI coverage so the installed and not-installed status-footer paths are both asserted.

## Notes
- The issue here was copy consistency, not persistence correctness: config already saved correctly and `status` already communicated the right behavior.
- No auth, ingest, or packaging redesign recommended from this cycle.
- This is exactly the kind of tiny polish that makes the setup flow feel deliberate instead of merely functional.
