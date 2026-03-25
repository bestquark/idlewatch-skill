# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R94 (installer/CLI polish QA — local-only messaging noise pass)

## Status: OPEN — one small polish fix worth shipping

Most of the installer/CLI remains in good shape.

This pass re-checked the setup wizard, config persistence/reload cues, LaunchAgent install/uninstall flow, `--test-publish`, device identity persistence, metric toggle persistence, and npm/npx install-path clarity in a fresh home. Those surfaces still mostly feel clean and low-friction.

The only new issue worth carrying forward is a small but user-visible messaging problem in local-only mode: setup commands already explain local mode clearly in their main success output, but they also emit a second warning to stderr. The result is repetitive, slightly noisier than necessary, and easy to misread as a partial problem even when setup succeeded.

That is classic product-taste polish territory: not broken, just more talkative than the experience needs to be.

---

## Priority findings

### M1. Local-only setup commands repeat themselves with an extra stderr warning
**Priority:** Medium  
**Status:** Open

**Why this matters:**
For a local-only user, `quickstart`, `configure`, and `--test-publish` already say the important thing in their normal output:

- local-only mode is active
- samples are saved locally
- setup succeeded
- `configure` can be used later to add a cloud key

But those commands also emit an extra stderr line:

- `Running in local-only mode — telemetry is saved to disk but not published. Run ... configure to add a cloud API key.`

That makes the flow feel more verbose than necessary.

On a successful setup path, repeating the same idea in stderr adds friction without adding clarity:

- it makes a clean success command look a little warning-y
- it creates duplicate copy in logs and wrappers that capture stderr separately
- it raises the risk that users read local-only mode as a problem instead of a supported choice

The product already has the right idea. It just needs to say it once, calmly, in the place users are already looking.

A good polish bar here would be:

- no duplicate local-only warning on successful setup/test flows, or
- if stderr is kept for some reason, the main success copy should not repeat the same message again

Minimal is better.

**Exact repro:**
1. Start with a fresh home:
   ```bash
   TMPHOME=$(mktemp -d)
   cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
   ```
2. Run local-only quickstart with stdout/stderr split:
   ```bash
   HOME="$TMPHOME" \
   IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
   IDLEWATCH_ENROLL_MODE=local \
   IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
   IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
   node bin/idlewatch-agent.js quickstart --no-tui \
     >/tmp/iw-quick.out 2>/tmp/iw-quick.err
   ```
3. Observe:
   - `/tmp/iw-quick.out` already explains local-only mode and reports successful setup
   - `/tmp/iw-quick.err` also contains:
     - `Running in local-only mode — telemetry is saved to disk but not published. Run node bin/idlewatch-agent.js configure to add a cloud API key.`
4. Repeat with configure:
   ```bash
   HOME="$TMPHOME" \
   IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
   IDLEWATCH_ENROLL_MODE=local \
   IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
   IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
   node bin/idlewatch-agent.js configure --no-tui \
     >/tmp/iw-config.out 2>/tmp/iw-config.err
   ```
5. Observe the same duplicate stderr warning despite successful output.

**Acceptance criteria:**
- [ ] Successful local-only `quickstart` does not emit redundant warning-style stderr copy when the main success output already explains local-only mode.
- [ ] Successful local-only `configure` follows the same rule.
- [ ] Successful local-only `--test-publish` is similarly calm and non-repetitive.
- [ ] Local-only mode still remains obvious to users.
- [ ] Real errors still use stderr normally.
- [ ] No auth, ingest, or packaging redesign is introduced.

---

## Verified in this cycle
- Fresh-home `status` still presents an honest empty state (`Setup: not completed yet`) with preview labels.
- `quickstart --no-tui` still persists device name and selected monitor targets into `~/.idlewatch/idlewatch.env`.
- Device identity still persists cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- Reconfiguring metrics still updates the saved env file correctly (`cpu,memory` → `agent_activity`).
- `configure` still explains that saved changes apply on next start and points users to `install-agent` to refresh a running background agent.
- `status` still distinguishes installed vs not-installed LaunchAgent states.
- `install-agent` / `uninstall-agent` behavior remains concise and safe.
- `--test-publish` still stays short and understandable in local-only mode aside from the duplicate stderr warning.
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
HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
node scripts/postinstall.mjs
node bin/idlewatch-agent.js --help
node bin/idlewatch-agent.js configure --help

HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
  node bin/idlewatch-agent.js quickstart --no-tui \
    >/tmp/iw-quick.out 2>/tmp/iw-quick.err
cat /tmp/iw-quick.out
cat /tmp/iw-quick.err

HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
  node bin/idlewatch-agent.js configure --no-tui \
    >/tmp/iw-config.out 2>/tmp/iw-config.err
cat /tmp/iw-config.out
cat /tmp/iw-config.err
```

## Notes
- This cycle did not find any need to redesign auth, ingest, or packaging flows.
- The remaining issue is strictly copy/noise polish: local-only success paths should feel quieter and more intentional.
- Previous fix remains verified: fresh `idlewatch status` no longer looks half-configured before setup.

---

# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R93 (installer/CLI polish QA — first-run status honesty pass)

## Status: CLOSED — shipped in this cycle

The installer/CLI still feels mostly clean: quickstart saves config correctly, metric toggles persist, LaunchAgent install/uninstall messaging stays calm, `--test-publish` is concise, device identity persists, and npm/npx setup hints are easy to follow.

This pass found one remaining product-taste issue in the first place many users will look after install: `idlewatch status` on a completely fresh home.

Right now, the empty-state status screen prints a believable device name, a full default metric set, and `local-only` publish mode even when no config has ever been saved. Technically that is derived from defaults, but to an end user it reads more like "already configured" than "not set up yet."

That is not a backend problem. It is just a small honesty issue in the setup surface, and it is worth tightening because first-run trust is built out of exactly these tiny details.

---

## Priority findings

### M1. Fresh `status` screen looks partially configured before setup has happened
**Priority:** Medium  
**Status:** Fixed

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
- [x] On a fresh install with no saved config, `status` reads clearly as an unconfigured/empty state.
- [x] The screen does not imply that a device has already been meaningfully set up when `~/.idlewatch/idlewatch.env` does not exist.
- [x] If defaults are shown, they are explicitly labeled as defaults or preview values.
- [x] The output stays brief, calm, and non-technical.
- [x] Existing configured-device `status` output remains as-is or equivalently clear.
- [x] No auth, ingest, or major packaging flow redesign is introduced.

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
- Shipped: fresh `idlewatch status` now opens with a simple empty-state treatment (`Setup: not completed yet`) and labels default values as preview values until config is saved.
- Configured-device status remains unchanged in tone and content aside from the fresh-home honesty fix.
- No auth, ingest, or major packaging redesign was introduced.
