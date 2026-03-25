# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R90 (installer/CLI polish QA follow-up)

## Status: OPEN — one small configure-copy mismatch remains

The core pipeline still works and the setup flow is in good shape. Device identity persists, metric toggles save cleanly, LaunchAgent install/uninstall messaging is calm, `status` is state-aware, and install-path hints are clear.

One small polish issue remains: after `configure`, the success headline still reads like a brand-new first run even when the device was already set up and the background agent still needs a refresh to pick up the saved config.

---

## Priority findings

### M1. `configure` still ends with first-run “Setup complete … is live” copy even for an already-configured device
**Priority:** Medium  
**Status:** Open

**Why this matters:**
The footer copy was already improved and now correctly says:

- `Background agent: already running`
- `Apply changes: re-run node bin/idlewatch-agent.js install-agent to refresh it with the saved config`

That part is good. The remaining mismatch is the headline directly above it:

- `✅ Setup complete — "QA Box" is live!`

On a reconfiguration path, that headline still sounds like first-run onboarding. It is a little too triumphant and a little too final for the actual state:

- the device was already set up
- the user just edited settings
- if a LaunchAgent is already loaded, the saved config is not fully applied to background collection until `install-agent` is re-run

So the footer is precise, but the headline still pulls in the opposite direction. For a minimal utility, that is exactly the kind of tiny copy contradiction people feel as “slightly off” even when they cannot name it.

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
3. Reconfigure metrics:
   ```bash
   HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
     IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
     IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
     node bin/idlewatch-agent.js configure --no-tui
   ```
4. Observe the mixed message in the success block:
   - headline: `✅ Setup complete — "QA Box" is live!`
   - follow-up: `Background agent: already running`
   - apply hint: `re-run ... install-agent to refresh it with the saved config`

**Acceptance criteria:**
- [ ] `configure` / `reconfigure` use a reconfiguration-specific success headline when the device already has saved config.
- [ ] The headline does not imply that background changes are already fully active when `install-agent` still needs to be re-run.
- [ ] First-run `quickstart` can keep the existing simpler “Setup complete” success tone.
- [ ] The success block reads as one coherent state, without the headline and footer subtly disagreeing.

---

## Verified in this cycle
- `quickstart --no-tui` still persists device name and selected monitor targets into `~/.idlewatch/idlewatch.env`.
- Device identity still persists cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- Reconfiguring metrics updates the saved env file correctly (`cpu,memory` → `agent_activity`).
- `status` correctly shows installed vs not-installed LaunchAgent states and uses the calmer not-installed re-enable hint after `uninstall-agent`.
- `install-agent` / `uninstall-agent` behavior remains concise and safe.
- `--test-publish` still behaves as the documented alias for `--once`.
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
HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
node scripts/postinstall.mjs
sed -n '1,120p' README.md
```

## Notes
- No auth, ingest, or packaging redesign recommended from this cycle.
- This is a copy/state-alignment issue only; config persistence and background refresh guidance are already working.
- The remaining work is small and should stay small: just make the success wording feel as deliberate as the rest of the flow.
