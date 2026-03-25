# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R92 (installer/CLI polish QA — setup honesty pass)

## Status: CLOSED — setup wording polished

The core installer/CLI flow is in good shape. Config persistence works, metric toggles save cleanly, LaunchAgent install/uninstall behavior stays calm, `--test-publish` wording is now aligned for sparse configs, device identity persists correctly, and install-path hints remain clear.

This pass found one small but important product-taste issue in the first-run setup confirmation: a local-only quickstart says the device `is live` immediately after collecting a one-time sample, even when background collection has not been installed yet.

That is not a pipeline failure, but it is a small trust wobble in the exact moment the product should feel simplest and most honest.

---

## Priority findings

### M1. Fresh quickstart said the device `is live` before background collection was actually enabled
**Priority:** Medium  
**Status:** Fixed in this cycle ✅

**Why this matters:**
For end users, words like `live` imply ongoing collection is already active. In the current local quickstart flow, the product:

- saves config
- collects one verification sample
- then tells the user:
  - `✅ Setup complete — "QA Box" is live!`
- while also saying the next step is:
  - `node bin/idlewatch-agent.js install-agent   Auto-start in background (recommended)`

That combination is a little slippery. If background collection is not installed yet, the device is not really "live" in the everyday sense — it is configured and verified, but not continuously running.

This is exactly the kind of tiny wording mismatch that makes setup feel more technical and less trustworthy than it needs to. A cleaner framing would acknowledge reality:

- setup is complete
- telemetry was verified
- background collection is optional but not yet enabled

The product already has the right behavior; it just deserves more precise copy.

**Exact repro:**
1. Start with a fresh home:
   ```bash
   TMPHOME=$(mktemp -d)
   cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
   ```
2. Run local quickstart without installing the LaunchAgent:
   ```bash
   HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
     IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
     IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
     node bin/idlewatch-agent.js quickstart --no-tui
   ```
3. Observe the success copy:
   - `✅ Setup complete — "QA Box" is live!`
4. Confirm background collection is still not enabled:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js status
   ```
5. Observe:
   - `Background:   LaunchAgent not installed`

**Acceptance criteria:**
- [x] First-run `quickstart` success copy does not imply continuous/background collection is already active when no LaunchAgent is installed.
- [x] The confirmation language clearly distinguishes between:
  - config saved
  - sample verified
  - background collection not yet enabled
- [x] The updated copy stays short, calm, and non-technical.
- [x] `configure` copy remains distinct from first-run setup copy.
- [x] No auth, ingest, or packaging flow redesign is introduced.

---

## Verified in this cycle
- `quickstart --no-tui` still persists device name and selected monitor targets into `~/.idlewatch/idlewatch.env`.
- Device identity still persists cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- Reconfiguring metrics updates the saved env file correctly (`cpu,memory` → `agent_activity`).
- Activity-only configs now report a real collected metric count in verification output.
- `status` still shows installed vs not-installed LaunchAgent states and keeps the calmer re-enable hint after `uninstall-agent`.
- `install-agent` / `uninstall-agent` behavior remains concise and safe.
- Postinstall install-path hints still clearly distinguish global install vs one-off `npx` use.
- `configure --help` still states that saved changes apply on next start and that reinstalling the agent refreshes the background process.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
TMPHOME=$(mktemp -d)
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
  node bin/idlewatch-agent.js quickstart --no-tui
HOME="$TMPHOME" cat "$TMPHOME/.idlewatch/idlewatch.env"
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
  node bin/idlewatch-agent.js configure --no-tui
HOME="$TMPHOME" cat "$TMPHOME/.idlewatch/idlewatch.env"
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
node scripts/postinstall.mjs
node bin/idlewatch-agent.js --help
node bin/idlewatch-agent.js configure --help
```

## Notes
- No auth, ingest, or major packaging redesign recommended from this cycle.
- Fixed: first-run setup now says setup is complete, keeps the verification line, and explicitly notes that background collection is not enabled yet when no LaunchAgent is installed.
- `configure` success copy remains separate from first-run setup copy.
- Product direction still looks right: minimal, low-friction setup with explicit background install when the user wants continuous collection.
