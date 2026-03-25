# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R91 (installer/CLI polish QA follow-up)

## Status: OPEN — one small verification-message mismatch remains

The core pipeline still works and the setup flow is mostly clean. Device identity persists, metric toggles save correctly, LaunchAgent install/uninstall behavior is calm, status remains state-aware, and install-path hints are easy to follow.

This pass found one small but user-visible polish issue worth fixing: when a device is configured with only `OpenClaw activity`, the setup/test-publish verification line says `0 metrics` even though that metric is the whole point of the configuration.

---

## Priority findings

### M1. Setup and `--test-publish` undercount activity-only configs as `0 metrics`
**Priority:** Medium  
**Status:** Open

**Why this matters:**
This is a tiny trust issue, not a functional break. A user can intentionally choose a minimal config with only `OpenClaw activity`, finish setup successfully, and then immediately see:

- `✅ Sample collected (0 metrics) and saved locally`

That reads like the test did nothing, even though:

- setup succeeded
- the saved config clearly shows `Metrics: OpenClaw activity`
- the JSON sample contains the activity fields / activity source block for that mode

For a setup wizard, the first verification message should make the chosen setup feel valid, not accidentally empty. If someone picks one metric and gets told they collected zero, the product feels slightly unreliable even when the pipeline is working as designed.

**Exact repro:**
1. Start with a fresh home:
   ```bash
   TMPHOME=$(mktemp -d)
   cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
   ```
2. Run local quickstart with only `agent_activity` enabled:
   ```bash
   HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
     IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='Activity Only' \
     IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
     node bin/idlewatch-agent.js quickstart --no-tui
   ```
3. Observe the verification line:
   - `✅ Sample collected (0 metrics) and saved locally`
4. Confirm the saved config/status disagrees with that wording:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js status
   ```
   which shows:
   - `Metrics: OpenClaw activity`
5. Reproduce the same messaging problem with the explicit test flow:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
   ```
   which again reports `0 metrics`.

**Acceptance criteria:**
- [ ] `quickstart`, `--once`, and `--test-publish` count activity-only configurations as a real collected metric in the success summary.
- [ ] A config with only `agent_activity` no longer prints `Sample collected (0 metrics)`.
- [ ] The verification copy reflects the user’s selected telemetry set without implying nothing was collected.
- [ ] The fix stays small and does not redesign sampling, ingest, or status output.

---

## Verified in this cycle
- `quickstart --no-tui` still persists device name and selected monitor targets into `~/.idlewatch/idlewatch.env`.
- Device identity still persists cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- Reconfiguring metrics updates the saved env file correctly (`cpu,memory` → `agent_activity`).
- `configure` success copy still matches reconfiguration state and no longer uses first-run “is live” wording.
- `status` still shows installed vs not-installed LaunchAgent states and keeps the calmer re-enable hint after `uninstall-agent`.
- `install-agent` / `uninstall-agent` behavior remains concise and safe.
- Postinstall install-path hints still clearly distinguish global install vs one-off `npx` use.
- README quickstart framing still keeps local-only and cloud setup equally intentional.

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
node bin/idlewatch-agent.js --help
node bin/idlewatch-agent.js configure --help

TMPHOME=$(mktemp -d)
HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='Activity Only' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
  node bin/idlewatch-agent.js quickstart --no-tui
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js --once --json
HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
```

## Notes
- No auth, ingest, or packaging redesign recommended from this cycle.
- The issue is limited to verification/success summarization, not config persistence.
- Keep the fix product-small: make the confirmation line feel correct for sparse but intentional configs.
