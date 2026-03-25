# IdleWatch Installer QA Log

**Repo:** `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`  
**Last updated:** Wednesday, March 25th, 2026 — 10:45 AM (America/Toronto)  
**Status:** CLOSED - small polish fixes shipped

---

## Cycle R80 Status: CLOSED

This pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install path clarity.

## Prioritized findings

### Priority 2 (Medium)

#### [x] M1 — Setup completion gives the right mental model when a LaunchAgent was installed before setup
**Why it matters:** This is a sensible cautious-user path: install background mode first, then finish setup. The mechanics work, but the completion copy still implies background mode is simply off instead of acknowledging that the agent is already installed and just needs a refresh.

**Repro**
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. `FAKEBIN=$(mktemp -d)`
4. Create a fake `launchctl` that lets `install-agent` succeed but keeps the agent in a not-loaded state:
   ```bash
   cat > "$FAKEBIN/launchctl" <<'EOF'
   #!/usr/bin/env bash
   set -euo pipefail
   cmd="${1:-}"
   if [[ "$cmd" == "print" ]]; then
     exit 1
   fi
   if [[ "$cmd" == "bootstrap" || "$cmd" == "enable" || "$cmd" == "bootout" ]]; then
     exit 0
   fi
   exit 0
   EOF
   chmod +x "$FAKEBIN/launchctl"
   ```
5. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent`
6. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
7. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`

**Observed**
- `install-agent` correctly says setup is not saved yet and leaves collection off.
- `quickstart --no-tui` succeeds and saves config.
- Completion still says:
  - `Background collection is not enabled yet.`
  - `node bin/idlewatch-agent.js install-agent   Auto-start in background (recommended)`
- But `status` immediately after is more precise:
  - `Background:   LaunchAgent installed but not loaded`
  - `Re-enable:  node bin/idlewatch-agent.js install-agent`

**Acceptance criteria**
- If a LaunchAgent plist already exists but is not loaded because setup/config was saved later, completion copy should say that explicitly.
- Preferred shape: `Background agent is already installed. Re-run idlewatch install-agent to start it with the saved config.`
- Distinguish clearly between:
  - first-time background enable
  - already-installed-but-needs-refresh
- Keep the copy short, calm, and non-technical.

---

### Priority 3 (Low)

#### [x] L1 — First-run `status` is lighter and calmer
**Why it matters:** The first `status` screen should reassure. Before setup exists, it currently leads with a long advanced metrics list that feels more internal than welcoming.

**Repro**
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. `HOME="$TMPHOME" node bin/idlewatch-agent.js status`

**Observed**
- Before setup, `status` prints:
  - `Metrics preview: CPU, Memory, GPU, Temperature, OpenClaw activity, OpenClaw tokens, OpenClaw runtime`
- Functional, but noisier than needed for first contact.

**Acceptance criteria**
- Keep first-run `status` useful, but reduce cognitive load.
- Prefer one of these lighter shapes:
  - `Default metrics: CPU, Memory, GPU, Temperature`
  - keep OpenClaw-specific metrics in a smaller secondary hint instead of the main headline line
- Do not simplify configured/status-after-setup output; only soften the pre-setup preview.

---

## Shipped in this pass
- [x] Quickstart/configure completion now distinguishes “not enabled yet” from “already installed, re-run install-agent to refresh/start with saved config”.
- [x] First-run `status` now leads with a calmer default metric preview and moves OpenClaw extras into a secondary line.

## Verified good in this pass
- Device identity persistence after reconfigure still looks correct.
- Metric toggle persistence works: changing selected metrics is reflected in saved config and next `status` output.
- Config persistence / next-start behavior remains coherent.
- Launch-agent uninstall messaging is clear, safe, and preserves config/logs.
- `--once` / `--test-publish` behavior is understandable and the alias works.
- README guidance on `npm install -g` vs `npx` is directionally good and does not suggest fragile one-off installs for background mode.

## Notes
- The cron prompt pointed at `~/.openclaw/workspace/idlewatch-skill`, but the active repo/docs for this pass were actually under `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree also contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- No auth, ingest, or packaging redesign is recommended from this cycle.
