# IdleWatch Installer QA Log

**Repo:** `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`  
**Last updated:** Wednesday, March 25th, 2026 — 10:45 AM (America/Toronto)  
**Status:** OPEN - 2 small polish issues still worth fixing

---

## Cycle R79 Status: OPEN

This pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install path clarity.

## Prioritized findings

### Priority 2 (Medium)

#### [M1] Setup completion still gives the wrong mental model when a LaunchAgent was already installed before setup
**Why it matters:** This is the exact "install background mode first, then finish setup" path a careful user is likely to take. The plumbing works, but the completion copy still sounds like background mode is simply off, instead of acknowledging that the agent is already installed and just needs a refresh.

**Repro**
1. Use a clean HOME.
2. Run `env HOME="$TMPHOME" PATH="$PATH" node bin/idlewatch-agent.js install-agent`.
3. Run `env HOME="$TMPHOME" PATH="$PATH" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`.
4. Read the setup completion message.
5. Run `env HOME="$TMPHOME" PATH="$PATH" node bin/idlewatch-agent.js status`.

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

#### [L1] First-run `status` is still visually busier than it needs to be
**Why it matters:** The first `status` screen should reassure. Right now, before setup exists, it leads with a long advanced metrics list that feels more internal than welcoming.

**Repro**
1. Use a clean HOME.
2. Run `env HOME="$TMPHOME" PATH="$PATH" node bin/idlewatch-agent.js status`.

**Observed**
- Before setup, `status` prints:
  - `Metrics preview: CPU, Memory, GPU, Temperature, OpenClaw activity, OpenClaw tokens, OpenClaw runtime`
- Functional, but a little noisy for first contact.

**Acceptance criteria**
- Keep first-run `status` useful, but reduce cognitive load.
- Prefer one of these lighter shapes:
  - `Default metrics: CPU, Memory, GPU, Temperature`
  - keep OpenClaw-specific metrics in a smaller secondary hint instead of the main headline line
- Do not simplify configured/status-after-setup output; only soften the pre-setup preview.

---

## Verified good in this pass
- Device identity persistence after reconfigure still looks correct.
- Metric toggle persistence works: changing selected metrics is reflected in saved config and next `status` output.
- Config persistence / next-start behavior remains coherent.
- Launch-agent uninstall messaging is clear, safe, and preserves config/logs.
- `--once` / `--test-publish` behavior is understandable and the alias works.
- README guidance on `npm install -g` vs `npx` is directionally good and does not suggest fragile one-off installs for background mode.

## Notes
- The cron prompt pointed at `~/.openclaw/workspace/idlewatch-skill`, but the active repo/docs for this pass were actually under `~/.openclaw/workspace.bak/idlewatch-skill`.
- No auth, ingest, or packaging redesign is recommended from this cycle.
