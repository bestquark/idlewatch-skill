# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R93 (installer/CLI polish QA — first-run status honesty pass)

## Status: OPEN — one small setup-state polish issue

The installer/CLI still feels mostly clean: quickstart saves config correctly, metric toggles persist, LaunchAgent install/uninstall messaging stays calm, `--test-publish` is concise, device identity persists, and npm/npx setup hints are easy to follow.

This pass found one remaining product-taste issue in the first place many users will look after install: `idlewatch status` on a completely fresh home.

Right now, the empty-state status screen prints a believable device name, a full default metric set, and `local-only` publish mode even when no config has ever been saved. Technically that is derived from defaults, but to an end user it reads more like "already configured" than "not set up yet."

That is not a backend problem. It is just a small honesty issue in the setup surface, and it is worth tightening because first-run trust is built out of exactly these tiny details.

---

## Priority findings

### M1. Fresh `status` screen looks partially configured before setup has happened
**Priority:** Medium  
**Status:** Open

**Why this matters:**
On a totally fresh install, users often check `status` before running setup. The current output shows:

- a concrete device name (`Leptons-Mini` in this environment)
- a concrete publish mode (`local-only`)
- a long enabled-metrics list (`CPU, Memory, GPU, Temperature, ...`)
- plus `Config: (no saved config)`

That mix sends two different messages at once.

The last line says "not configured," but most of the screen says "already configured." For a new user, that can raise needless questions:

- Did IdleWatch already pick settings for me?
- Is it already collecting?
- Are these defaults actually live?
- Do I need setup at all?

The product should feel calmer than that. A first-run status screen should read unmistakably as an empty state, not as a half-configured system.

A cleaner direction would be to keep the useful facts while making the setup state explicit, for example by preferring language like:

- setup not completed yet
- config not saved yet
- default values shown for preview only

or by suppressing some fields entirely until config exists.

No redesign needed — just a crisper empty-state presentation.

**Exact repro:**
1. Start with a fresh home:
   ```bash
   TMPHOME=$(mktemp -d)
   cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
   ```
2. Run status before quickstart/configure:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js status
   ```
3. Observe output similar to:
   - `Device:       Leptons-Mini`
   - `Publish mode: local-only`
   - `Metrics:      CPU, Memory, GPU, Temperature, OpenClaw activity, OpenClaw tokens, OpenClaw runtime`
   - `Config:       (no saved config)`
   - `Background:   LaunchAgent not installed`

**Acceptance criteria:**
- [ ] On a fresh install with no saved config, `status` reads clearly as an unconfigured/empty state.
- [ ] The screen does not imply that a device has already been meaningfully set up when `~/.idlewatch/idlewatch.env` does not exist.
- [ ] If defaults are shown, they are explicitly labeled as defaults or preview values.
- [ ] The output stays brief, calm, and non-technical.
- [ ] Existing configured-device `status` output remains as-is or equivalently clear.
- [ ] No auth, ingest, or major packaging flow redesign is introduced.

---

## Verified in this cycle
- `quickstart --no-tui` still persists device name and selected monitor targets into `~/.idlewatch/idlewatch.env`.
- Device identity still persists cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- Reconfiguring metrics updates the saved env file correctly (`cpu,memory` → `agent_activity`).
- `configure` still explains that saved changes apply on next start, and points users to `install-agent` to refresh a running background agent.
- `status` still distinguishes installed vs not-installed LaunchAgent states.
- `install-agent` / `uninstall-agent` behavior remains concise and safe.
- `--test-publish` stays short and understandable in local-only mode.
- Postinstall install-path hints still clearly distinguish global install vs one-off `npx` use.

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
- Main UX nit left: first-run `status` should feel unmistakably like an empty state, not a preconfigured device.
- Everything else in the requested polish lane looks solid.
