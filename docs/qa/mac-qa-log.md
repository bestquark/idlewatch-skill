# IdleWatch Installer QA Log

**Repo:** `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`  
**Last updated:** Wednesday, March 25th, 2026 — 11:36 AM (America/Toronto)  
**Status:** CLOSED - tiny npx/background polish shipped

---

## Cycle R82 Status: CLOSED

This pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install path clarity.

### Outcome
- No new user-facing polish regressions found in the targeted R82 spot-checks.
- Existing R80/R81 polish fixes still read cleanly in first-run, install-before-setup, and post-setup flows.
- The current copy keeps the right product shape: simple first-run guidance, honest next-start/re-enable language, and a clear split between `npx` trial usage and durable background installs.

### R82 spot-check coverage
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- Local-only `quickstart --no-tui` in a clean HOME
- Post-setup `status`
- `configure --no-tui` device rename + metric change persistence
- `install-agent` messaging from an `npx`-like invocation
- `--test-publish` alias behavior
- `uninstall-agent` messaging

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

#### [x] L0 — `npx` setup/reconfigure no longer suggests `npx idlewatch install-agent` for background refresh
**Why it matters:** `npx` is fine for trial setup and foreground checks, but the LaunchAgent belongs to a durable install. When a user reconfigures from `npx` after background mode was already installed, recommending `npx idlewatch install-agent` is subtly wrong and adds friction.

**Observed before fix**
- In `quickstart` / `configure` completion paths with an already-installed background agent, next-step copy was derived from the current invocation.
- In an `npx` run, that could produce background refresh guidance like `npx idlewatch install-agent`, even though the product docs explicitly position durable installs as the right path for LaunchAgent management.

**Acceptance criteria**
- If setup/reconfigure is running via `npx` and background follow-up is needed, completion copy should point to `idlewatch install-agent`.
- Keep foreground `npx` guidance intact.
- Make it explicit, in one short line, that the `npx` run updated/saved config only.

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
- [x] `npx` quickstart/configure now points background refresh/start follow-ups to `idlewatch install-agent` instead of implying `npx idlewatch install-agent` is the right durable path.
- [x] `npx` setup/reconfigure completion now adds a short note when it only updated the saved config and the existing background install still needs the normal durable refresh command.
- [x] Quickstart/configure completion now distinguishes “not enabled yet” from “already installed, re-run install-agent to refresh/start with saved config”.
- [x] First-run `status` now leads with a calmer default metric preview and moves OpenClaw extras into a secondary line.
- [x] Post-setup `status` with no samples now keeps the background next step honest: first-time enable vs re-enable vs already enabled.

## Verified good in this pass
- Device identity persistence after reconfigure still looks correct: renaming the device preserves the original device ID and log path while updating the visible device name.
- Metric toggle persistence works: changing selected metrics is reflected in saved config and next `status` output.
- Config persistence / next-start behavior remains coherent.
- Install-before-setup flow now has the right mental model: setup completion acknowledges an already-installed LaunchAgent and tells the user to re-run `install-agent` to refresh/start it.
- [x] Launch-agent uninstall messaging is clear, safe, preserves config/logs, and now keeps `npx` follow-up guidance honest by pointing re-enable copy to `idlewatch install-agent`.
- [x] `launchctl` bootstrap/bootout failures now surface spawn-level error text instead of collapsing to `unknown error`, improving tiny install/reload reliability without touching telemetry behavior.
- `--once` / `--test-publish` behavior is understandable and the alias works.
- README guidance on `npm install -g` vs `npx` is directionally good and does not suggest fragile one-off installs for background mode.

## Notes
- The cron prompt pointed at `~/.openclaw/workspace/idlewatch-skill`, but the active repo/docs for this pass were actually under `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree also contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- No auth, ingest, or packaging redesign is recommended from this cycle.
