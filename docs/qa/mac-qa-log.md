# IdleWatch Installer QA Log

**Repo:** `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`  
**Last updated:** Wednesday, March 25th, 2026 — 10:35 AM (America/Toronto)  
**Status:** OPEN - small polish follow-up

---

## Cycle R79 Status: OPEN

Scope for this pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install path clarity.

## Findings

### Priority 2 (Medium)

#### [M1] Quickstart completion is too generic when a LaunchAgent was preinstalled before setup
**Why it matters:** The "install agent first, configure second" flow basically works, but the success copy still makes the user infer the final step. That adds friction in what should feel like a neat, intentional setup path.

**Repro**
1. Use a clean HOME.
2. Run `env HOME="$TMPHOME" PATH="$PATH" node bin/idlewatch-agent.js install-agent`.
3. Run `env HOME="$TMPHOME" PATH="$PATH" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`.
4. Read the quickstart completion message.
5. Optionally run `env HOME="$TMPHOME" PATH="$PATH" node bin/idlewatch-agent.js status` to confirm the actual state.

**Observed**
- `install-agent` correctly installs a plist but keeps background collection off until config exists.
- `quickstart --no-tui` succeeds and saves config.
- Completion copy still says:
  - `Background collection is not enabled yet.`
  - `For background mode: node bin/idlewatch-agent.js install-agent`
- `status` immediately after shows the more precise truth:
  - `Background: LaunchAgent installed but not loaded`
  - `Re-enable: node bin/idlewatch-agent.js install-agent`

**Acceptance criteria**
- If a LaunchAgent plist already exists but is not loaded because setup was not saved yet, quickstart completion should say that explicitly.
- Preferred shape: `Background agent is already installed. Re-run idlewatch install-agent to start it with the saved config.`
- Distinguish clearly between:
  - first-time background enable
  - already-installed-but-needs-refresh
- Keep the copy short and non-technical.

---

### Priority 3 (Low)

#### [L1] First-run `status` preview is still a bit too technical and visually busy
**Why it matters:** `status` is often the first reassurance screen. On an unconfigured machine, the current preview front-loads advanced OpenClaw-specific metrics before the user has chosen anything, which makes the product feel busier than necessary.

**Repro**
1. Use a clean HOME.
2. Run `env HOME="$TMPHOME" PATH="$PATH" node bin/idlewatch-agent.js status`.

**Observed**
- Before setup, `status` prints:
  - `Metrics preview: CPU, Memory, GPU, Temperature, OpenClaw activity, OpenClaw tokens, OpenClaw runtime`
- This is functional, but noisier and more technical than needed for first contact.

**Acceptance criteria**
- Keep pre-setup `status` useful, but reduce cognitive load.
- Prefer a simpler first-run preview, for example:
  - a shorter label like `Default metrics`, or
  - only the basic defaults on the main line, with advanced/OpenClaw metrics moved to a secondary hint.
- Do not remove useful detail from configured/status-after-setup flows.

---

## Verified good in this pass
- Device identity persistence after rename/reconfigure looks correct.
- Config persistence and "applies on next start" behavior look coherent overall.
- Launch-agent uninstall messaging remains clear and safe.
- `--once` / `--test-publish` messaging is broadly understandable.
- npm/npx durable-install guidance is directionally good and avoids suggesting fragile cached installs for background mode.

## Notes
- The active repo and docs for this pass are under `~/.openclaw/workspace.bak/idlewatch-skill`.
- No auth, ingest, or packaging redesign is recommended from this cycle.
