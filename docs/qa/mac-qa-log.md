# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R88 (installer/CLI polish follow-up)

## Status: OPEN — one small setup-copy mismatch remains

The core flow still works, but there is one real polish issue left in the setup/control loop: after changing settings while the LaunchAgent is already installed, the setup-complete screen still sounds like a first-run path instead of explicitly telling the user to refresh the background agent.

That is not a functional breakage. It is a small product-friction issue: the saved config updates correctly, `status` explains the refresh correctly, but the immediate post-configure success copy is slightly misleading and less calm than the rest of the product.

---

## Priority findings

### M1. `configure` success copy is misleading when the background LaunchAgent is already installed
**Priority:** Medium  
**Status:** Open

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
- [ ] After `configure`, if a LaunchAgent is already installed/loaded, the success copy explicitly says the background agent is already running.
- [ ] The post-configure copy tells the user to refresh/re-run `install-agent` so the saved config is applied.
- [ ] First-run setup copy stays simple for users who have not installed the LaunchAgent yet.
- [ ] `quickstart`, `configure`, `status`, and `install-agent` all use consistent language about when config changes take effect.
- [ ] The result feels calmer and less ambiguous, without adding extra technical detail.

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

## Notes
- The issue here is copy consistency, not persistence correctness: config saves correctly and `status` already communicates the right behavior.
- No auth, ingest, or packaging redesign recommended from this cycle.
- This is the kind of polish that makes the setup flow feel deliberate rather than merely functional.
