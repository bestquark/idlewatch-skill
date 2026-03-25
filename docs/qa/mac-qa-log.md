# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R114 (installer/CLI polish QA — LaunchAgent loaded-state honesty pass)

## Status: OPEN — small polish issue worth fixing

This pass found one remaining LaunchAgent state-honesty issue in the install/reinstall surface.

`install-agent` can print success copy that says IdleWatch is already running in the background even when the immediate follow-up `status` for the same saved config says the LaunchAgent is only installed and not loaded.

That is not an ingest/auth/packaging failure. It is a small setup-trust problem in exactly the place users expect a calm single source of truth:
- `install-agent` says background is running now
- `status` can immediately say it is not loaded yet
- the mismatch is especially easy to hit during reinstall/refresh-style QA where an older `com.idlewatch.agent` label already exists

For product taste, the rule should stay simple: either the current saved config is loaded and running, or the copy should say it was installed/refreshed but is not running yet.

## Priority findings

### M1. `install-agent` success copy can overstate the loaded/running state
**Priority:** Medium  
**Status:** Open

**Why this matters:**
`install-agent` is one of the main trust-building commands in the whole setup flow. If it says the background agent is running, users should not have to sanity-check that claim with contradictory status output right away.

The current behavior is slightly too optimistic in edge-y but realistic refresh/reinstall flows:
- the command reports `IdleWatch is running in the background`
- the next `status` for that same saved config can report `LaunchAgent installed but not loaded`
- users are left to guess whether the install actually applied, whether the wrong plist is live, or whether they should run `install-agent` again

That is exactly the kind of tiny uncertainty a polished installer should avoid.

**Exact repro:**
1. Start from the active repo on disk:
   ```bash
   cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
   ```
2. Create one temp home, save config, and install the agent:
   ```bash
   A=$(mktemp -d)
   HOME="$A" \
     IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
     IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='Home A' \
     IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu' \
     node bin/idlewatch-agent.js quickstart --no-tui

   HOME="$A" node bin/idlewatch-agent.js install-agent
   HOME="$A" node bin/idlewatch-agent.js status
   ```
3. Observe a mismatch is possible already in this state if another `com.idlewatch.agent` label was already present in the user session:
   - install says `LaunchAgent refreshed — IdleWatch is running in the background.`
   - status can still say `Background:   LaunchAgent installed but not loaded`
4. A cleaner deterministic repro is to install again from a second temp home without first unloading the earlier label:
   ```bash
   B=$(mktemp -d)
   HOME="$B" \
     IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
     IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='Home B' \
     IDLEWATCH_ENROLL_MONITOR_TARGETS='memory' \
     node bin/idlewatch-agent.js quickstart --no-tui

   HOME="$B" node bin/idlewatch-agent.js install-agent
   HOME="$B" node bin/idlewatch-agent.js status
   ```
5. Compare the two homes:
   - Home A can still report `installed but not loaded`
   - Home B may report `loaded (running, pid ...)`
   - only one `gui/.../com.idlewatch.agent` label can actually be active at once
6. Inspect launchd if needed:
   ```bash
   launchctl print gui/$(id -u)/com.idlewatch.agent | sed -n '1,80p'
   ```
7. Observe the loaded label/path can point at only one plist, while `install-agent` success copy for another saved config may still sound fully active.

**Acceptance criteria:**
- [ ] `install-agent` success copy only says the background agent is running when the current saved config is actually loaded for that label.
- [ ] Refresh/reinstall flows do not leave users with `install-agent` saying "running" while `status` for that same config says `installed but not loaded`.
- [ ] If launchd can only keep one `com.idlewatch.agent` live at a time, the CLI copy stays explicit about what happened to the current plist/config.
- [ ] Install/reinstall messaging stays short, calm, and non-technical.
- [ ] No auth, ingest, or major packaging-flow redesign is introduced.

## Verified in this cycle
- Fresh-home `status` still reads as a true empty state.
- `quickstart --no-tui` still persists config cleanly with the neutral generated header.
- Reconfigure still preserves `IDLEWATCH_DEVICE_ID` while allowing a display-name change.
- Metric-toggle persistence still behaves predictably.
- Local-only `--test-publish` remains concise.
- One-off `npm exec` / `npx` install-path messaging still fails fast and stays honest.
- Focused installer/CLI regression coverage still passes.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
TMPHOME=$(mktemp -d)

HOME="$TMPHOME" node bin/idlewatch-agent.js status

HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
  node bin/idlewatch-agent.js quickstart --no-tui

HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status

HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='Renamed Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
  node bin/idlewatch-agent.js configure --no-tui

HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status

env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch status
env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch install-agent

A=$(mktemp -d)
B=$(mktemp -d)
HOME="$A" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='Home A' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu' node bin/idlewatch-agent.js quickstart --no-tui
HOME="$A" node bin/idlewatch-agent.js install-agent
HOME="$A" node bin/idlewatch-agent.js status
HOME="$B" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='Home B' IDLEWATCH_ENROLL_MONITOR_TARGETS='memory' node bin/idlewatch-agent.js quickstart --no-tui
HOME="$B" node bin/idlewatch-agent.js install-agent
HOME="$B" node bin/idlewatch-agent.js status
launchctl print gui/$(id -u)/com.idlewatch.agent | sed -n '1,80p'

node --test test/openclaw-env.test.mjs
```

## Notes
- Active repo path on disk still appears to be `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`; the cron payload path `/Users/luismantilla/.openclaw/workspace/idlewatch-skill` was not present during this pass.
- This issue is about install/reinstall state honesty only. Do not redesign auth, ingest, or major packaging flows.
- A minimal fix could be copy-only, or a slightly stricter loaded-state check before claiming "running in the background."

---

**Cycle:** R113 (installer/CLI polish QA — LaunchAgent doc honesty sync)

## Status: CLOSED — shipped in this cycle

This cycle stayed deliberately tiny.

The CLI and runtime behavior already do the right thing after the earlier no-config LaunchAgent polish: `install-agent` installs the plist but leaves it unloaded until setup exists. One doc page still told the older story by saying the LaunchAgent "loads immediately" even when no saved config exists.

That mismatch was small, but it landed in exactly the setup surface users copy from. Tightening it keeps install/reconfigure expectations calm and consistent without touching auth, ingest, packaging mechanics, or the working telemetry path.

## What shipped
- `docs/packaging/macos-launch-agent.md` now distinguishes the two install states plainly:
  - saved config present → install also loads the agent immediately
  - no saved config yet → plist is installed but left unloaded until setup is saved
- Refresh wording now says re-running the install script will load or refresh the background agent with saved config.
- Runtime behavior remains unchanged.

## Verified in this cycle
- The doc now matches the already-shipped no-config `install-agent` behavior.
- Saved-config install behavior still reads as immediate background startup.
- No auth, ingest, telemetry-path, or packaging-flow redesign was introduced.

## Acceptance criteria
- [x] LaunchAgent docs no longer claim a no-config install starts running immediately.
- [x] Saved-config install behavior remains described accurately.
- [x] Copy stays short, calm, and setup-focused.
- [x] Runtime behavior and telemetry path remain unchanged.

## Notes
- Active repo path on disk still appears to be `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`; the cron payload path `/Users/luismantilla/.openclaw/workspace/idlewatch-skill` was not present during this pass.
- This was intentionally a docs-only honesty sync because the installer/CLI behavior itself was already correct.

---

**Cycle:** R112 (installer/CLI polish QA — calmness + persistence verification sweep)

## Status: CLOSED — no new polish issue found

This pass stayed tightly scoped to the remaining product-taste checklist from the polish plan: setup wizard clarity, config persistence/reload behavior, LaunchAgent install/uninstall honesty, local-only test-publish messaging, device identity persistence, metric-toggle persistence, and npm/npx install-path clarity.

No new issue stood out strongly enough to justify implementation.

The targeted surfaces still feel neat and low-friction:
- fresh-home `status` still reads as a true empty state rather than a half-configured device
- `quickstart` / `configure` still keep saved config, metric choices, and device identity behavior predictable
- LaunchAgent install/uninstall still tell a simple installed vs running story
- local-only `--test-publish` remains short and non-alarming
- one-off `npm exec` / `npx` behavior still refuses fragile background installs and explains the durable path plainly

## Verified in this cycle
- Fresh `status` still shows preview labels plus `Setup: not completed yet` before config exists.
- `quickstart --no-tui` still saves a neutral generated config header and calm next-step copy.
- Reconfigure still preserves `IDLEWATCH_DEVICE_ID` while updating the display name.
- Metric-toggle persistence still works through the same reconfigure path.
- Saved-config `install-agent` still starts background collection normally.
- `uninstall-agent` still removes only the background job and keeps config/logs.
- Local-only `--test-publish` remains concise and avoids warning-y noise.
- One-off `npm exec ... idlewatch status` still keeps follow-up copy honest.
- One-off `npm exec ... idlewatch install-agent` still fails fast and explains the durable install path clearly.
- Focused installer/CLI regression coverage still passes.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
TMPHOME=$(mktemp -d)

HOME="$TMPHOME" node bin/idlewatch-agent.js status

HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
  node bin/idlewatch-agent.js quickstart --no-tui

HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish

HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='Renamed Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
  node bin/idlewatch-agent.js configure --no-tui

HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status

env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch status
env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch install-agent

node --test test/openclaw-env.test.mjs
```

## Acceptance criteria
- [x] No new confusing, verbose, repetitive, visually noisy, or overly technical setup issue surfaced in the targeted polish areas.
- [x] Config persistence and reload/apply behavior still match user-facing messaging.
- [x] Device name / device id persistence still behave predictably through reconfigure.
- [x] Metric-toggle persistence still behaves predictably through reconfigure.
- [x] LaunchAgent install/uninstall behavior remains clear and safe.
- [x] One-off `npx` / `npm exec` install-path messaging remains honest.
- [x] No auth, ingest, or major packaging redesign was introduced.

## Notes
- Active repo path on disk still appears to be `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`; the cron payload path `/Users/luismantilla/.openclaw/workspace/idlewatch-skill` was not present during this pass.
- This was a verification-only cycle. No implementation changes were needed.

---

**Cycle:** R111 (installer/CLI polish QA — tiny validation + saved-config resilience pass)

## Status: CLOSED — shipped in this cycle

This pass stayed deliberately small and only touched low-risk polish with direct setup/debug payoff.

### What shipped
- Validation for `IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES` now prints the actual bad value instead of the misleading literal `undefined`.
- Saved-config status payload helpers now tolerate a missing/unreadable `~/.idlewatch/idlewatch.env` instead of assuming it exists.
- Metrics parsing in the saved-config payload helper is now flattened correctly (`['cpu','memory']` instead of a nested array shape).
- Telemetry collection / ingest behavior was left unchanged.

### Why this was worth doing
These are tiny changes, but they remove friction in exactly the moments users get annoyed:
- when a setup/env tweak fails and the validation message should point at the real bad value immediately
- when a UI/helper path asks for saved config before the config file exists yet

No flow redesign, no auth/ingest changes, no packaging work.

## Verified in this cycle
- Invalid `IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES` now echoes the provided value in the validation error.
- Fresh-home `status` still keeps the same honest empty-state copy.
- No telemetry-path behavior changed.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
node --test --test-name-pattern "rejects invalid IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES with the provided value" test/openclaw-env.test.mjs
env HOME="$(mktemp -d)" node bin/idlewatch-agent.js status
```

## Acceptance criteria
- [x] Validation copy is more actionable when `IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES` is wrong.
- [x] Saved-config helper paths no longer assume the env file already exists.
- [x] Metrics parsing stays sensible in saved-config helper payloads.
- [x] No auth, ingest, or packaging redesign was introduced.
- [x] Telemetry path remains unchanged.

---

**Cycle:** R110 (installer/CLI polish QA — verification-only calmness sweep)

## Status: CLOSED — no new polish issue found

This cycle re-ran the narrow installer/CLI polish checklist with product-taste scrutiny and did not find a new issue worth implementation.

The targeted surfaces still read cleanly and low-friction:
- fresh-home `status` still reads as an honest empty state instead of a half-configured one
- `quickstart` / `configure` still keep saved config, metric choices, and device identity behavior predictable
- LaunchAgent install/uninstall still tells a simple installed vs running story
- local-only `--test-publish` remains concise and non-alarming
- one-off `npm exec` / `npx` behavior still refuses fragile background installs and explains the durable path plainly

## Verified in this cycle
- Fresh `status` shows preview labels and `Setup: not completed yet` before config exists.
- `quickstart --no-tui` still saves a neutral generated config header and calm next-step copy.
- Reconfigure still preserves `IDLEWATCH_DEVICE_ID` while updating the display name.
- Metric-toggle persistence still works through the same reconfigure path.
- Saved-config `install-agent` still starts background collection normally.
- `uninstall-agent` still removes only the background job and keeps config/logs.
- Local-only `--test-publish` remains short and stays out of warning-y territory.
- One-off `npm exec ... idlewatch status` still keeps follow-up copy honest.
- One-off `npm exec ... idlewatch install-agent` still fails fast and explains the durable install path clearly.
- Focused installer/CLI regression coverage still passes.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
TMPHOME=$(mktemp -d)

node bin/idlewatch-agent.js --help
HOME="$TMPHOME" node bin/idlewatch-agent.js status

HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
  node bin/idlewatch-agent.js quickstart --no-tui

HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish

HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='Renamed Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
  node bin/idlewatch-agent.js configure --no-tui

HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status

env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch status
env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch install-agent

node --test test/openclaw-env.test.mjs
```

## Acceptance criteria
- [x] No new confusing, verbose, repetitive, or overly technical setup issue surfaced in the targeted polish areas.
- [x] Config persistence and reload/apply behavior still match user-facing messaging.
- [x] Device name / device id persistence still behave predictably through reconfigure.
- [x] Metric-toggle persistence still behaves predictably through reconfigure.
- [x] LaunchAgent install/uninstall behavior remains clear and safe.
- [x] One-off `npx` / `npm exec` install-path messaging remains honest.
- [x] No auth, ingest, or major packaging redesign was introduced.

## Notes
- Active repo path on disk still appears to be `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`; the cron payload path `/Users/luismantilla/.openclaw/workspace/idlewatch-skill` was not present during this pass.
- This was a verification-only cycle. No implementation changes were needed.

---

**Cycle:** R109 (installer/CLI polish QA — no-config install honesty shipped)

## Status: CLOSED — shipped in this cycle

This cycle kept scope deliberately tiny and fixed the one remaining setup/install honesty issue.

`install-agent` without saved config no longer starts background collection immediately. Instead, it installs the LaunchAgent calmly, keeps it unloaded until setup exists, and tells the same story that `status` now tells.

That keeps first-run setup simpler:
- no saved setup means background stays off
- install output says that plainly
- `status` now matches by reporting `LaunchAgent installed but not loaded`

## What shipped
- No-config `install-agent` now writes the LaunchAgent without `RunAtLoad` / `KeepAlive` enabled.
- The no-config path no longer bootstraps a live background agent.
- Success copy now says background collection stays off until setup is saved.
- Added regression coverage to keep `status` and install behavior aligned.
- Saved-config install behavior remains unchanged and still starts/restarts the background agent normally.

## Priority findings

### M1. No-config `install-agent` still starts a live background agent while sounding only "ready"
**Priority:** Medium  
**Status:** Fixed

**Why this mattered:**
For a clean first-run setup flow, users should not have to reconcile all of these at once:
- setup is not completed yet
- background mode is ready
- LaunchAgent is already loaded and running

That was not a pipeline failure. It was a small product-taste issue in the setup moment.

The cleaner rule is now simple:
- if setup is not saved yet, install the LaunchAgent but do not start it
- once setup is saved, re-run `install-agent` and background collection starts normally

**Acceptance criteria:**
- [x] The no-config `install-agent` path does not feel half-enabled or misleading.
- [x] If setup is not saved yet, install success copy does not imply a merely passive/ready state while a live LaunchAgent is already running.
- [x] `status` and install success copy tell the same story about installed vs active background state.
- [x] Saved-config install/uninstall behavior remains unchanged.
- [x] No auth, ingest, or major packaging-flow redesign is introduced.

## Verified in this cycle
- Fresh `status` still reads cleanly as an empty-state preview before setup.
- No-config `install-agent` now leaves background collection unloaded.
- Immediate `status` after that install now reports `LaunchAgent installed but not loaded`.
- Saved-config `install-agent` / `uninstall-agent` behavior remains calm and predictable.
- Reconfigure still preserves saved device identity while updating the display name.
- Metric-toggle persistence still works through reconfigure.
- `--test-publish` remains concise in local-only mode.
- One-off `npm exec` / `npx` paths still refuse fragile background installs and explain the durable path plainly.
- Focused installer/CLI regression coverage still passes.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
node --test test/openclaw-env.test.mjs

TMPHOME=$(mktemp -d)
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
plutil -p "$TMPHOME/Library/LaunchAgents/com.idlewatch.agent.plist"
```

## Notes
- Active repo path on disk remains `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`; the cron payload path `/Users/luismantilla/.openclaw/workspace/idlewatch-skill` was still not present during this pass.
- This cycle stayed intentionally limited to a tiny setup/install honesty fix only.
- The working telemetry path was preserved by leaving saved-config startup behavior unchanged.

---

**Cycle:** R107 (installer/CLI polish QA — no-config LaunchAgent honesty pass)

## Status: OPEN — small polish issue worth fixing

This cycle found one remaining setup/install honesty issue.

`install-agent` is calm about missing config, but it still writes and loads a running LaunchAgent immediately. In practice that means a user can still be in the `Setup: not completed yet` state while `status` simultaneously reports `Background: LaunchAgent loaded (running, pid ...)`.

That combination feels more active than the setup copy suggests:
- the install step sounds like background mode is merely "ready"
- the empty-state status screen still says setup is not completed
- but a real background process is already live

Nothing crashes, and the core telemetry path stays intact. This is a product-taste issue: the pre-setup install path feels a little too half-enabled.

## Priority findings

### M1. `install-agent` without saved config starts background collection immediately
**Priority:** Medium  
**Status:** Open

**Why this matters:**
For a neat setup flow, users should not have to mentally reconcile all three of these at once:
- setup is not completed yet
- background mode is ready
- LaunchAgent is already loaded and running

That is slightly confusing in exactly the moment the product should feel simplest.

A cleaner bar would be one of these:
- `install-agent` installs the LaunchAgent but does not load/start it until config exists, or
- the copy/status make the active background state unmistakably explicit instead of sounding like a passive prereq step

No auth, ingest, or packaging redesign is needed. This is just setup/install honesty polish.

**Exact repro:**
1. Start with a fresh home and source checkout:
   ```bash
   TMPHOME=$(mktemp -d)
   cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
   ```
2. Install background mode before running setup:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
   ```
3. Observe the success copy says setup is not saved yet and background mode is merely "ready":
   - `✅ LaunchAgent installed.`
   - `Background mode is ready, but setup is not saved yet.`
4. Check status immediately:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js status
   ```
5. Observe status still says:
   - `Setup: not completed yet`
   - but also says:
   - `Background: LaunchAgent loaded (running, pid ...)`
6. Inspect the generated plist if needed:
   ```bash
   plutil -p "$TMPHOME/Library/LaunchAgents/com.idlewatch.agent.plist"
   ```
7. Observe the LaunchAgent is configured with `RunAtLoad => true`, so the background process starts right away even before setup is saved.

**Acceptance criteria:**
- [ ] The no-config `install-agent` path does not feel half-enabled or misleading.
- [ ] If setup is not saved yet, users are not told only that background mode is "ready" while a live LaunchAgent is already running.
- [ ] `status` and install success copy tell the same story about whether background mode is merely installed vs actively running.
- [ ] Saved-config install/uninstall behavior remains unchanged.
- [ ] No auth, ingest, or major packaging-flow redesign is introduced.

## Verified in this cycle
- Main help and `run --help` still correctly describe `run` as the foreground collector.
- Fresh `status` still presents an honest empty-state preview before setup.
- `quickstart --no-tui` still saves config cleanly with a neutral generated header.
- Reconfigure still preserves saved device identity while updating the display name.
- Metric-toggle persistence still works through reconfigure.
- `--test-publish` remains concise in local-only mode.
- Saved-config `install-agent` / `uninstall-agent` behavior remains calm and predictable.
- One-off `npm exec` / `npx` paths still refuse fragile background installs and explain the durable path plainly.
- Focused installer/CLI regression coverage still passes.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
node --test test/openclaw-env.test.mjs

TMPHOME=$(mktemp -d)
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
plutil -p "$TMPHOME/Library/LaunchAgents/com.idlewatch.agent.plist"
```

## Notes
- Active repo path on disk remains `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`; the cron payload path `/Users/luismantilla/.openclaw/workspace/idlewatch-skill` was still not present during this pass.
- This cycle was intentionally limited to small setup/install polish only.
- Recommendation scope: copy/behavior honesty only; do not redesign auth, ingest, or major packaging flows.

---

**Cycle:** R106 (installer/CLI polish QA — run/help honesty + no-config install calmness pass)

## Status: CLOSED — shipped in this cycle

This cycle stayed intentionally small and product-taste-driven.

Two tiny setup/install paper cuts were worth fixing:
- help text still described `run` like a background command even though it is the foreground collector
- `install-agent` without saved config sounded a bit more “fully ready” than the actual setup state

Neither issue affected the working telemetry path, but both added avoidable friction in first-run or re-check flows.

## What shipped
- Main help and `run --help` now describe `run` as the foreground collector.
- First-install `install-agent` output is calmer and more honest when no saved config exists yet.
- Source-checkout follow-up commands remain explicit and copyable.
- Existing setup/reconfigure/background behavior remains unchanged.

## Verified in this cycle
- `--help` no longer calls `run` a background collector.
- `run --help` now says it collects in the foreground.
- `install-agent` with no saved config now says background mode is ready while setup is not saved yet.
- Saved-config install behavior, reconfigure behavior, and telemetry flow remain unchanged.
- Focused installer/CLI regression coverage still passes.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
node --test test/openclaw-env.test.mjs
```

## Acceptance criteria
- [x] `run` help text matches actual foreground behavior.
- [x] First-install `install-agent` output stays calm without overstating setup completeness.
- [x] Setup/reconfigure flows remain unchanged aside from wording polish.
- [x] The working telemetry path is preserved.
- [x] No auth, ingest, or packaging redesign was introduced.

## Notes
- Active repo path on disk remains `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`; the cron payload path `/Users/luismantilla/.openclaw/workspace/idlewatch-skill` was still not present during this pass.
- This was intentionally limited to copy/honesty polish only.

---

**Cycle:** R105 (installer/CLI polish QA — verification-only setup calmness sweep)

## Status: CLOSED — no action required

This cycle re-ran the small-polish checklist against the active repo on disk and stayed intentionally narrow.

The core setup surfaces still feel tidy:
- first-run `status` reads as an honest empty state
- `quickstart` still saves config cleanly
- reconfigure still preserves device identity while updating the display name
- metric selection persists cleanly
- reload/apply guidance still matches actual background-agent behavior
- `install-agent` / `uninstall-agent` messaging stays calm and non-alarming
- local-only `--test-publish` remains short
- one-off `npx` usage still refuses fragile background installs and explains the durable path plainly

No new confusing, repetitive, or overly technical UX issue stood out strongly enough to justify implementation.

## What was verified
- `status` on a fresh home still opens with `Setup: not completed yet` and preview-only labels.
- `quickstart --no-tui` still writes `~/.idlewatch/idlewatch.env` with the neutral generated header.
- Re-running `configure --no-tui` with a renamed device still preserves the saved `IDLEWATCH_DEVICE_ID`.
- Metric-toggle persistence still works during the same reconfigure path.
- Saved-config wording still matches reload behavior: foreground runs pick up changes on next start; a running LaunchAgent is refreshed by re-running `install-agent`.
- `install-agent` / `uninstall-agent` keep retention and removal messaging clear and safe.
- Local-only `--test-publish` still stays concise and quiet on stderr.
- `npm exec` / `npx` status hints remain honest about one-off foreground use and durable background-install requirements.
- `npm exec` / `npx` `install-agent` still fails fast instead of writing a LaunchAgent against npm cache.

## Repro / validation
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
TMPHOME=$(mktemp -d)

HOME="$TMPHOME" node bin/idlewatch-agent.js status

HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
  node bin/idlewatch-agent.js quickstart --no-tui

HOME="$TMPHOME" cat "$TMPHOME/.idlewatch/idlewatch.env"
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status

HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='Renamed Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
  node bin/idlewatch-agent.js configure --no-tui

HOME="$TMPHOME" cat "$TMPHOME/.idlewatch/idlewatch.env"
HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status

env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch status
env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch install-agent
```

## Acceptance criteria
- [x] No new confusing, repetitive, or overly technical setup copy surfaced in the targeted polish areas.
- [x] Config persistence and reload/apply behavior still match the user-facing messaging.
- [x] Device name / device id persistence still behave predictably through reconfigure.
- [x] Metric toggle persistence still behaves predictably through reconfigure.
- [x] LaunchAgent install/uninstall behavior remains clear and safe.
- [x] One-off `npx` install-path messaging remains honest.
- [x] No auth, ingest, or major packaging redesign was introduced.

## Notes
- Active repo path on disk remains `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`; the cron payload path `/Users/luismantilla/.openclaw/workspace/idlewatch-skill` was still not present during this pass.
- This was a verification-only QA cycle. No implementation changes were needed.

---

**Cycle:** R104 (installer/CLI polish QA — rename-safe saved identity pass)

## Status: CLOSED — shipped in this cycle

This cycle found one small but worthwhile saved-config polish issue in `configure`.

Renaming a device during reconfigure could also regenerate `IDLEWATCH_DEVICE_ID` from the new display name. Nothing crashed, but it made a cosmetic rename behave more like a new device identity than a settings edit.

That is the wrong feel for a tidy reconfigure flow. If someone just renames the box, the safer default is to keep the saved device identity stable unless they explicitly override it.

This pass keeps setup simple and preserves the working telemetry path:
- `configure` now reuses the saved `IDLEWATCH_DEVICE_ID` by default
- changing `IDLEWATCH_DEVICE_NAME` no longer silently changes the device id
- explicit device-id overrides still work as before
- saved config format and publish/auth behavior stay unchanged

## What shipped
- Reconfigure now prefers the existing saved device id before deriving one from the current device name.
- Renaming a device updates the human-facing name without silently minting a new device identity.
- Added regression coverage for rename-with-stable-id behavior.

## Priority findings

### M1. Renaming a device during reconfigure could silently mint a new device id
**Priority:** Medium  
**Status:** Fixed

**Why this matters:**
For product taste, `configure` should feel like editing settings, not accidentally creating a new identity.

Before this fix, a flow like:
- first setup as `QA Box`
- later reconfigure to `Renamed Box`

could save:
- `IDLEWATCH_DEVICE_NAME=Renamed Box`
- `IDLEWATCH_DEVICE_ID=renamed-box`

That is subtle, but it creates avoidable friction:
- a display-name tweak can look like a brand-new device to downstream consumers
- reconfigure feels less predictable than the rest of the setup flow
- users lose the nice mental model that saved identity stays put unless they intentionally change it

The neater rule is simple: keep the existing device id unless the user explicitly supplies a new one.

**Acceptance criteria:**
- [x] Reconfigure keeps the existing saved `IDLEWATCH_DEVICE_ID` by default.
- [x] Changing `IDLEWATCH_DEVICE_NAME` alone does not silently change device identity.
- [x] Explicit device-id overrides still take precedence.
- [x] No auth, ingest, telemetry-path, or packaging redesign is introduced.

## Verified in this cycle
- Fresh local-only quickstart still writes the expected saved config.
- Reconfigure with a renamed device now updates `IDLEWATCH_DEVICE_NAME` while preserving the saved `IDLEWATCH_DEVICE_ID`.
- Existing metric-selection persistence still works during the same reconfigure path.
- Focused installer/CLI regression coverage still passes.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
node --test test/openclaw-env.test.mjs
```

## Notes
- Active repo path on disk remains `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`; the cron payload path `/Users/luismantilla/.openclaw/workspace/idlewatch-skill` was still not present during this pass.
- This was intentionally kept to a tiny saved-config behavior fix only.
- No auth, ingest, or packaging changes were made.

---

**Cycle:** R103 (installer/CLI polish QA — verification-only polish sweep)

## Status: CLOSED — no action required

This cycle re-ran the current polish checklist without trying to expand scope.

The important setup surfaces still feel tidy and honest:
- fresh-home `status` reads clearly as an empty state
- setup/reconfigure persist config and metric choices cleanly
- device identity still stays stable across reconfigure
- reload/apply guidance remains short and predictable
- LaunchAgent install/uninstall copy is calm and easy to follow
- one-off `npx` runs still refuse fragile background installs and explain the durable path plainly
- `--test-publish` stays concise in local-only mode

No new polish issue stood out strongly enough to justify implementation.

---

## What was verified
- `quickstart --no-tui` saves `~/.idlewatch/idlewatch.env` with a neutral/generated header.
- Re-running `configure --no-tui` updates `IDLEWATCH_MONITOR_TARGETS` in place without changing the persisted device identity.
- Saved-config wording still matches actual reload behavior: foreground runs pick up changes on next start; a running LaunchAgent is refreshed by re-running `install-agent`.
- `status` still uses the right next-step language (`Get started`, `Enable`, `Apply`) for each state.
- `install-agent` / `uninstall-agent` keep config/log retention messaging clear and non-alarming.
- `npm exec` / `npx` status hints remain honest about foreground-only use and durable background-install requirements.
- `npm exec` / `npx` `install-agent` still fails fast instead of writing a LaunchAgent against npm cache.
- Focused installer/CLI regression coverage still passes.

## Repro / validation
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
TMPHOME=$(mktemp -d)

HOME="$TMPHOME" node bin/idlewatch-agent.js status

HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
  node bin/idlewatch-agent.js quickstart --no-tui

HOME="$TMPHOME" cat "$TMPHOME/.idlewatch/idlewatch.env"
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status

HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
  node bin/idlewatch-agent.js configure --no-tui

HOME="$TMPHOME" cat "$TMPHOME/.idlewatch/idlewatch.env"
HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status

env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch status
env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch install-agent

node --test test/openclaw-env.test.mjs
```

## Acceptance criteria
- [x] No new confusing, repetitive, or overly technical setup copy surfaced in the targeted polish areas.
- [x] Config persistence and reload/apply behavior still match the user-facing messaging.
- [x] Device name / device id persistence still behave predictably through reconfigure.
- [x] Metric toggle persistence still behaves predictably through reconfigure.
- [x] LaunchAgent install/uninstall behavior remains clear and safe.
- [x] One-off `npx` install-path messaging remains honest.
- [x] No auth, ingest, or major packaging redesign was introduced.

## Notes
- Active repo path on disk remains `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`; the cron payload path `/Users/luismantilla/.openclaw/workspace/idlewatch-skill` was still not present during this pass.
- This was a verification-only QA cycle. No code changes were needed.

---

**Cycle:** R102 (installer/CLI polish QA — metric-selection validation honesty pass)

## Status: CLOSED — shipped in this cycle

This cycle found one small setup/reconfigure validation paper cut worth fixing.

When metric selection was supplied entirely through env/non-interactive input, a fully invalid list could silently fall back to the default metric set. Nothing crashed, but it made setup feel slippery in exactly the moment users expect their explicit choices to stick.

This pass tightens that behavior without touching auth, ingest, packaging, or the working telemetry path:

- `quickstart` / `configure` now fail fast when the provided metric list contains no valid metrics at all.
- The error is plain and actionable: it tells users to choose from the supported metric names.
- No config file is written on that invalid-input path.
- Partial/valid selections still work as before.

---

## What shipped
- Setup/reconfigure no longer silently replace a fully invalid metric selection with defaults.
- The validation error now says `No valid metrics were selected` and lists supported metric names.
- Invalid non-interactive runs leave `~/.idlewatch/idlewatch.env` untouched.
- Added regression coverage for invalid metric input.
- Kept the existing telemetry pipeline and saved-config format unchanged.

---

## Priority findings

### M1. Setup silently falls back to default metrics when the requested metric list is entirely invalid
**Priority:** Medium  
**Status:** Fixed

**Why this matters:**
For product taste, `configure` should feel dependable: if a user explicitly asks for a specific metric set, IdleWatch should either save that set or clearly say why it cannot.

Before this fix, an all-invalid metric string such as:

- `wat,not-real`

could still complete setup by quietly saving the default metrics instead.

That is subtle, but it creates exactly the wrong feeling:
- the saved config does not reflect what the user asked for
- a typo can look like it "worked"
- reconfigure feels less trustworthy than the rest of the CLI

The neater behavior is simple: when nothing in the requested list is valid, stop early and say so.

**Acceptance criteria:**
- [x] `quickstart` / `configure` fail clearly when the provided metric list contains no valid metrics.
- [x] The validation message names the problem and points to supported metric names.
- [x] No saved config file is written on the fully-invalid path.
- [x] Valid metric selections continue to save normally.
- [x] No auth, ingest, telemetry-path, or packaging redesign is introduced.

---

## Verified in this cycle
- Invalid non-interactive metric input now fails with a clear validation error.
- No `idlewatch.env` file is created when setup input is fully invalid.
- Valid local-only setup and reconfigure flows still complete normally.
- Background/install guidance remains unchanged.
- Existing focused installer/CLI regression suite still passes.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
node --test test/openclaw-env.test.mjs

TMPHOME=$(mktemp -d)
HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='wat,not-real' \
  node bin/idlewatch-agent.js quickstart --no-tui
```

## Notes
- Active repo path on disk remains `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`.
- This was intentionally kept to a tiny setup-validation fix only.
- No auth, ingest, telemetry-path, or packaging changes were made.

---

**Cycle:** R101 (installer/CLI polish QA — status action-label honesty pass)

## Status: CLOSED — shipped in this cycle

This cycle found one small but real setup-language paper cut in `status`.

For a configured device with samples and no installed LaunchAgent, the next-step hint could still read like a resume flow rather than a first enable flow. That is harmless mechanically, but slightly off in the exact place users look for the next command.

This pass tightens that wording:

- `status` now says `Enable:` when background mode has not been installed yet.
- `Re-enable:` is kept for the narrower case where the LaunchAgent plist exists but is currently not loaded.
- Running-agent `Apply:` guidance stays unchanged.

That keeps setup/reconfigure language a little more honest and a little calmer without changing the working telemetry path or adding any new options.

---

## What shipped
- `status` now uses `Enable:` for configured devices whose LaunchAgent is truly not installed.
- `Re-enable:` is now reserved for `installed-not-loaded` LaunchAgent state.
- Added regression coverage so the not-installed path does not drift back to resume-style wording.

---

## Priority findings

### M1. `status` says `Re-enable` even when background mode was never installed
**Priority:** Medium  
**Status:** Fixed

**Why this matters:**
When setup is already complete and samples exist, users often check `idlewatch status` to find the single next background step.

Before this fix, a not-installed LaunchAgent could still produce resume-flavored copy. That subtly suggests IdleWatch is returning to a previously enabled state, even when the user has never turned background mode on.

The cleaner product behavior is simple:
- `Enable:` when background mode has not been installed yet
- `Re-enable:` only when there is something real to re-enable
- `Apply:` only when a running agent exists and config changes need a refresh

That keeps the CLI feeling deliberate instead of stitched together.

**Acceptance criteria:**
- [x] Configured `status` output uses `Enable:` when the LaunchAgent is not installed.
- [x] `Re-enable:` remains available for installed-but-not-loaded state.
- [x] Running-agent `Apply:` guidance remains unchanged.
- [x] No auth, ingest, or packaging redesign is introduced.

---

## Verified in this cycle
- Configured-device `status` still shows concise setup and runtime state.
- Not-installed LaunchAgent path now says `Enable:` instead of `Re-enable:`.
- Running-agent refresh guidance remains `Apply:`.
- Existing focused installer/CLI regression suite still passes.
- Telemetry and saved-config flows remain unchanged.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
node --test test/openclaw-env.test.mjs

TMPHOME=$(mktemp -d)
# prepare saved config + sample log without installing the LaunchAgent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
```

## Notes
- Active repo path on disk remains `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`.
- This was intentionally kept to a tiny wording/validation change only.
- No auth, ingest, telemetry-path, or packaging changes were made.

---

**Cycle:** R100 (installer/CLI polish QA — config-file provenance copy pass)

## Status: CLOSED — shipped in this cycle

Most of the installer/CLI still feels solid: setup persists, metric toggles save cleanly, config reload expectations are clear, LaunchAgent install/uninstall works, `--test-publish` stays short, device identity persists, and the npx/global install split is now honest.

This cycle shipped the last small config-persistence copy fix: saved env files now use a neutral header that stays accurate after both first-run setup and later `configure` edits.

That keeps the file feeling current and trustworthy when users open `~/.idlewatch/idlewatch.env` to confirm what actually stuck.

---

## What shipped
- Saved env files now use the neutral banner `# Generated by idlewatch-agent`.
- The header stays accurate after both `quickstart` and `configure`.
- Metric toggle persistence, device identity persistence, and the existing telemetry flow remain unchanged.

---

## Original finding

This cycle found one remaining config-persistence paper cut: after users change settings through `configure`, the saved env file still starts with the quickstart-only header:

- `# Generated by idlewatch-agent quickstart`

That line is harmless technically, but it is slightly misleading in exactly the place advanced users look when checking whether a later settings change actually stuck. The config did update correctly — only the file banner stayed stuck in the initial setup story.

For product taste, this is worth tightening. When someone edits settings and opens the saved file, the file should feel current and trustworthy, not like a leftover artifact from the first-run wizard.

### What should change
- After `configure`, the saved config header should stop claiming the file was generated by `quickstart`.
- A neutral banner would be enough, e.g. `# Generated by idlewatch-agent`.
- If the product wants to distinguish actions, the wording should still stay accurate after later saves.

---

## Priority findings

### M1. Saved config file still claims it was generated by quickstart even after later configure edits
**Priority:** Medium  
**Status:** Fixed

**Why this matters:**
The runtime behavior is correct:
- metric toggles persist
- device identity persists
- later saves overwrite the right values

But the file banner tells a subtly different story.

After a user changes settings with `configure`, opening `~/.idlewatch/idlewatch.env` still shows:

- `# Generated by idlewatch-agent quickstart`

That is small, but it creates avoidable friction:
- it makes the file look like a one-time bootstrap artifact instead of the current saved config
- it slightly undermines confidence that a later edit really came from the settings flow the user just ran
- it is visually inconsistent with the otherwise careful persistence/reload messaging in the CLI

The neat version is simple: use copy that stays true no matter whether the file came from quickstart or configure.

**Exact repro:**
1. Start with a fresh home and source checkout:
   ```bash
   TMPHOME=$(mktemp -d)
   cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
   ```
2. Run quickstart:
   ```bash
   HOME="$TMPHOME" \
     IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
     IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
     IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
     node bin/idlewatch-agent.js quickstart --no-tui
   ```
3. Re-open settings and change metrics:
   ```bash
   HOME="$TMPHOME" \
     IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
     IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
     IDLEWATCH_ENROLL_MONITOR_TARGETS='agent_activity' \
     node bin/idlewatch-agent.js configure --no-tui
   ```
4. Inspect the saved file:
   ```bash
   cat "$TMPHOME/.idlewatch/idlewatch.env"
   ```
5. Observe the values changed correctly, but the header still says:
   - `# Generated by idlewatch-agent quickstart`

**Acceptance criteria:**
- [x] After `configure`, the saved env file does not incorrectly claim it was generated by `quickstart`.
- [x] The header copy remains accurate whether the latest save came from quickstart or configure.
- [x] Metric toggle persistence behavior remains unchanged.
- [x] Device identity persistence behavior remains unchanged.
- [x] No auth, ingest, or packaging redesign is introduced.

---

## Verified in this cycle
- Fresh-home `status` still presents an honest empty state (`Setup: not completed yet`) with preview labels.
- `quickstart --no-tui` still persists device name and selected monitor targets into `~/.idlewatch/idlewatch.env`.
- Device identity still persists cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- Reconfiguring metrics still updates the saved env file correctly (`cpu,memory` → `agent_activity`).
- `configure` still explains that saved changes apply on next start and points users to refresh a running background agent.
- `status` still distinguishes installed vs not-installed LaunchAgent states.
- `install-agent` / `uninstall-agent` messaging remains concise.
- `--test-publish` remains short and understandable in local-only mode.
- One-off runtime hints still correctly keep `npx idlewatch ...` command forms where appropriate.
- One-off `install-agent` still correctly refuses fragile npm-cache background installs.
- README and external onboarding still clearly distinguish one-off `npx` usage from durable background-install paths.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
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
env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch status
env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch install-agent
node bin/idlewatch-agent.js --help
node bin/idlewatch-agent.js status --help
node bin/idlewatch-agent.js install-agent --help
```

## Notes
- This cycle used `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`, which appears to be the active repo path on disk; the cron payload path `/Users/luismantilla/.openclaw/workspace/idlewatch-skill` was not present.
- The remaining issue is copy polish only: saved config provenance should stay accurate after later settings edits.
- No auth, ingest, or major packaging flow changes are recommended.

---

**Cycle:** R99 (installer/CLI polish QA — source-checkout command copy pass)

## Status: CLOSED — shipped in this cycle

Most of the installer/CLI still feels solid: setup persists, metric toggles save cleanly, config reload expectations are clear, LaunchAgent install/uninstall works, `--test-publish` stays short, device identity persists, and the npx/global install split is now honest.

This cycle shipped the last small copy polish issue in the source-checkout path.

When IdleWatch is run from source (`node bin/idlewatch-agent.js ...`), some background/setup hints embed the full command inside prose like:

- `Background: install node bin/idlewatch-agent.js install-agent to re-enable background collection`

That is technically understandable, but it reads clunkier than the rest of the product and makes the key action slightly harder to scan/copy. The command itself is already long; wrapping it in extra prose makes the line feel more mechanical than helpful.

The neat version is simpler:

- keep the sentence short, then show the command cleanly, or
- use a phrasing that does not produce `install <command> install-agent`

No flow redesign needed — this is just copy polish in a setup surface users actually read.

### What shipped
- Source-checkout `status` now uses clean action labels (`Re-enable:` / `Enable:`) instead of wrapping the full install command inside prose.
- The command itself stays explicit and easy to copy.
- Global-install and one-off `npx` wording remains unchanged.

---

## Priority findings

### M1. Source-checkout background hints become awkward when the full `node ... install-agent` command is embedded inside prose
**Priority:** Medium  
**Status:** Fixed

**Why this matters:**
The global-install and one-off `npx` paths now read cleanly because the command style matches the setup path.

The source-checkout path mostly does too — but a few lines still construct guidance as sentence fragments around the command. That creates phrasing like:

- `install node bin/idlewatch-agent.js install-agent`

Nothing is broken, but it is visually noisy in exactly the moment the user wants a calm next step. It also makes the action slightly less copyable-at-a-glance than it should be.

This is the kind of tiny polish issue that makes a CLI feel either carefully composed or slightly stitched together.

A cleaner bar would be one of these:

- `Background: node bin/idlewatch-agent.js install-agent`
- `To re-enable background collection:` followed by the command on the next line
- `Run node bin/idlewatch-agent.js install-agent to re-enable background collection`

Any of those is easier on the eyes than `install <command> install-agent`.

**Exact repro:**
1. Start with a fresh home and source checkout:
   ```bash
   TMPHOME=$(mktemp -d)
   cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
   ```
2. Run source-checkout quickstart:
   ```bash
   env HOME="$TMPHOME" \
     IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
     IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
     IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
     node bin/idlewatch-agent.js quickstart --no-tui
   ```
3. Install then remove the LaunchAgent:
   ```bash
   env HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
   env HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
   ```
4. Check status:
   ```bash
   env HOME="$TMPHOME" node bin/idlewatch-agent.js status
   ```
5. Observe the final hint reads:
   - `Background: install node bin/idlewatch-agent.js install-agent to re-enable background collection`
6. The same phrasing pattern also appears in configured source-checkout status/help copy where prose wraps the full command instead of presenting it cleanly.

**Acceptance criteria:**
- [x] Source-checkout status/help/setup hints do not produce awkward phrasing like `install node ... install-agent`.
- [x] The next-step command remains explicit and copyable.
- [x] Global installs still keep the clean `idlewatch install-agent` phrasing.
- [x] One-off `npx` guidance remains unchanged and honest about durable install requirements.
- [x] No auth, ingest, or major packaging redesign is introduced.

---

## Verified in this cycle
- Fresh-home `status` still presents an honest empty state (`Setup: not completed yet`) with preview labels.
- `quickstart --no-tui` still persists device name and selected monitor targets into `~/.idlewatch/idlewatch.env`.
- Device identity still persists cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- Reconfiguring metrics still updates the saved env file correctly (`cpu,memory` → `agent_activity`).
- `configure` still explains that saved changes apply on next start and points users to refresh a running background agent.
- `status` still distinguishes installed vs not-installed LaunchAgent states.
- `install-agent` / `uninstall-agent` messaging remains concise.
- `--test-publish` remains short and understandable in local-only mode.
- One-off runtime hints still correctly keep `npx idlewatch ...` command forms where appropriate.
- One-off `install-agent` still correctly refuses fragile npm-cache background installs.
- README and external onboarding still clearly distinguish one-off `npx` usage from durable background-install paths.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
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
env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch status
env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch install-agent
node bin/idlewatch-agent.js --help
node bin/idlewatch-agent.js status --help
node bin/idlewatch-agent.js install-agent --help
```

## Notes
- This cycle used `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`, which appears to be the active repo path on disk; the cron payload path `/Users/luismantilla/.openclaw/workspace/idlewatch-skill` was not present.
- The remaining issue is copy polish only: source-checkout command presentation should be as clean as the global/npx paths.
- No auth, ingest, or major packaging flow changes are recommended.

---

**Cycle:** R98 (installer/CLI polish QA — docs install-path clarity pass)

## Status: CLOSED — shipped in this cycle

The product behavior now does the right thing: one-off `npx` / `npm exec` runs refuse to install a fragile LaunchAgent and point users to a durable install first.

The remaining paper cut is simpler: the written install docs still frame `npx idlewatch quickstart` as a general first-class setup path without clearly saying that background mode is **not** part of that path.

That mismatch is small, but it lands right where trust is built:

- README says `npx idlewatch quickstart`
- onboarding docs say `one-off / no install → npx idlewatch ...`
- background section then shows `idlewatch install-agent`
- only the runtime error explains the durable-install requirement

So the CLI is now honest, but the docs still make users discover the rule one command too late.

---

## What shipped
- README now frames `npx idlewatch quickstart` as the fast one-off / foreground-testing path.
- README background section now says plainly that LaunchAgent/background mode needs a durable install first.
- `docs/onboarding-external.md` now makes the same distinction before the background setup steps.
- Copy stays short and non-technical; no runtime, auth, ingest, or packaging behavior changed.

## Priority findings

### M1. README/onboarding still underspecify that background mode requires a durable install
**Priority:** Medium  
**Status:** Fixed

**Why this matters:**
This is no longer a behavior bug. It is a setup-quality issue.

Right now the docs correctly present `npx` as the fastest no-install path, but they do not clearly separate:

- **one-off foreground testing** → good fit for `npx`
- **persistent background collection** → requires a durable install (`npm install -g idlewatch`, packaged app, or intentional source checkout path)

That leaves an avoidable friction point:

- users can reasonably read the docs as "start with npx, then continue normally"
- the first place they learn otherwise is the `install-agent` refusal message
- the product feels slightly more surprising than it needs to

The neater path is to state the rule before users hit the guardrail.

Minimal examples that would be clearer:

- `npx idlewatch quickstart` → one-off setup / foreground testing
- `npm install -g idlewatch` → required before `idlewatch install-agent`
- packaged app or source checkout docs keep their existing durable-path instructions

**Exact repro:**
1. Open the main install docs:
   ```bash
   cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
   sed -n '1,120p' README.md
   ```
2. Observe the install section says:
   - `npm install -g idlewatch`
   - or `npx idlewatch quickstart`
3. Observe the later background section says:
   - `idlewatch install-agent`
   - but does not plainly say background mode requires a durable install and is not part of the one-off `npx` path.
4. Open the external onboarding doc:
   ```bash
   sed -n '1,120p' docs/onboarding-external.md
   ```
5. Observe it says:
   - `one-off / no install → npx idlewatch ...`
   - but does not clearly carve out `install-agent` / background mode as durable-install-only.
6. Compare with actual runtime behavior:
   ```bash
   TMPHOME=$(mktemp -d)
   env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch install-agent
   ```
7. Observe the CLI correctly refuses and explains that one-off `npx` paths are not durable enough for background mode.

**Acceptance criteria:**
- [x] README install + background sections explicitly distinguish one-off `npx` usage from durable background-install paths.
- [x] `docs/onboarding-external.md` says plainly that LaunchAgent/background mode requires a durable install.
- [x] Copy stays short, calm, and non-technical.
- [x] The fast `npx` path remains visible for foreground testing and quick setup.
- [x] No auth, ingest, or packaging redesign is introduced.

---

## Verified in this cycle
- Fresh-home `status` still presents an honest empty state (`Setup: not completed yet`) with preview labels.
- `quickstart --no-tui` still persists device name and selected monitor targets into `~/.idlewatch/idlewatch.env`.
- Device identity still persists cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- Reconfiguring metrics still updates the saved env file correctly (`cpu,memory` → `agent_activity`).
- `configure` still explains that saved changes apply on next start and points users to `install-agent` to refresh a running background agent.
- `status` still distinguishes installed vs not-installed LaunchAgent states.
- `install-agent` / `uninstall-agent` messaging remains concise.
- `--test-publish` remains short and understandable in local-only mode.
- One-off runtime hints are now honest: `status` says to install IdleWatch globally first before background mode.
- One-off `install-agent` correctly stops early instead of writing a LaunchAgent against npm cache.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
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
env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch status
env HOME="$TMPHOME" npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill idlewatch install-agent
sed -n '1,120p' README.md
sed -n '1,120p' docs/onboarding-external.md
```

## Notes
- This cycle did not find any need to redesign auth, ingest, or major packaging flows.
- The remaining issue is documentation honesty/clarity, not a runtime correctness problem.
- Product taste recommendation: explain the durable-install requirement one step earlier, in the docs users copy from.

---

**Cycle:** R97 (installer/CLI polish QA — one-off LaunchAgent durability fix)

## Status: CLOSED — shipped in this cycle

This cycle shipped the small fix that mattered most: one-off `npx` / `npm exec` runs no longer pretend they are a safe background-install path.

Instead of writing a LaunchAgent against npm's disposable `_npx` cache, `install-agent` now stops early with a plain explanation and points users to the durable path:

- install IdleWatch normally first
- then run `idlewatch install-agent`
- keep one-off `npx` runs for foreground testing

That keeps setup honest, removes a haunted-after-lunch failure mode, and preserves the clean low-friction path for real installs.

---

**Cycle:** R96 (installer/CLI polish QA — one-off LaunchAgent durability pass)

## Status: CLOSED — shipped in this cycle

Most of the installer/CLI still feels nicely restrained. But this pass found one setup-path bug that is too sharp to leave in the “paper-cut” bucket:

when the product is run one-off via `npx` / `npm exec`, it now correctly preserves that form in follow-up hints — including `npx idlewatch install-agent`. The problem is that `install-agent` then writes the macOS LaunchAgent against npm’s transient `_npx` cache path rather than a durable executable path.

That means the product currently recommends a background-install command that can silently become invalid as soon as npm clears or rotates the one-off cache.

From a product-taste perspective, this is exactly the kind of thing that makes setup feel trustworthy for five minutes and haunted after lunch.

---

## Priority findings

### H1. `npx idlewatch install-agent` creates a LaunchAgent that depends on npm's disposable `_npx` cache
**Priority:** High  
**Status:** Open

**Why this matters:**
The new one-off command preservation is directionally right, but `install-agent` should not turn a temporary execution path into a persistent background service.

Right now, a one-off user can be guided into this flow:

- `npx idlewatch quickstart`
- `npx idlewatch install-agent`

and receive a success message saying IdleWatch is now running in the background.

But the generated `com.idlewatch.agent.plist` points `ProgramArguments[1]` at a path like:

- `~/.npm/_npx/<random>/node_modules/.bin/idlewatch`

That path is not a stable install location. It is npm scratch space.

So the experience becomes misleading:

- setup appears successful
- `status` may look fine immediately
- background collection can later fail for reasons the user never explicitly opted into
- the recommended copy makes the fragile path feel first-class when it is really ephemeral

For end users, the neat/simple version is one of these:

- do not recommend `install-agent` from one-off `npx` mode, or
- install the LaunchAgent against a durable path that survives cache cleanup, or
- explicitly require a real install before background mode

What should not happen is “success” copy for a background job wired to temp files.

**Exact repro:**
1. Start with a fresh home:
   ```bash
   TMPHOME=$(mktemp -d)
   cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
   ```
2. Run one-off setup:
   ```bash
   env HOME="$TMPHOME" \
     IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
     IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='NPX Box' \
     IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu' \
     npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill \
     idlewatch quickstart -- --no-tui
   ```
3. Install the background agent the way the product suggests:
   ```bash
   env HOME="$TMPHOME" \
     npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill \
     idlewatch install-agent
   ```
4. Inspect the generated LaunchAgent:
   ```bash
   plutil -p "$TMPHOME/Library/LaunchAgents/com.idlewatch.agent.plist"
   ```
5. Observe `ProgramArguments` contains a transient npm cache path similar to:
   - `/.../.npm/_npx/098ca73bee87ba17/node_modules/.bin/idlewatch`
6. Simulate cache cleanup by moving or removing that `_npx/...` directory, then restart the job:
   ```bash
   launchctl kickstart -k gui/$(id -u)/com.idlewatch.agent
   cat "$TMPHOME/.idlewatch/logs/agent-stderr.log"
   ```
7. Observe background startup fails with `MODULE_NOT_FOUND` because the cached one-off bin path is gone.

**Acceptance criteria:**
- [x] One-off `npx` / `npm exec` usage does not install a LaunchAgent that depends on transient npm cache paths.
- [x] If background mode requires a durable install, the CLI says that plainly and does not present `npx idlewatch install-agent` as a recommended steady-state path.
- [x] Success copy for `install-agent` remains calm and low-friction, but honest about prerequisites.
- [x] Global installs still keep the clean `idlewatch install-agent` path.
- [x] Source-checkout usage can continue using `node bin/idlewatch-agent.js install-agent` if that path is intentional and durable.
- [x] No auth, ingest, or major packaging redesign is introduced.

---

## Verified in this cycle
- Fresh-home `status` still presents an honest empty state (`Setup: not completed yet`) with preview labels.
- `quickstart --no-tui` still persists device name and selected monitor targets into `~/.idlewatch/idlewatch.env`.
- Device identity still persists cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- Reconfiguring metrics still updates the saved env file correctly (`cpu,memory` → `agent_activity`).
- `configure` still explains that saved changes apply on next start and points users to `install-agent` to refresh a running background agent.
- `status` still distinguishes installed vs not-installed LaunchAgent states.
- `install-agent` / `uninstall-agent` messaging remains concise.
- `--test-publish` remains short and understandable in local-only mode.
- One-off live follow-up hints now correctly preserve `npx idlewatch ...` command forms.
- New issue found: one-off `install-agent` currently persists a LaunchAgent against a disposable npm cache path.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
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

env HOME="$TMPHOME" \
  npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill \
  idlewatch status

env HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
  npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill \
  idlewatch quickstart -- --no-tui

env HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='NPX Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu' \
  npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill \
  idlewatch quickstart -- --no-tui

env HOME="$TMPHOME" \
  npm exec --yes --package /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill \
  idlewatch install-agent

plutil -p "$TMPHOME/Library/LaunchAgents/com.idlewatch.agent.plist"
launchctl print gui/$(id -u)/com.idlewatch.agent | sed -n '1,80p'
# then simulate npm cache loss and re-kick the agent to confirm failure
```

## Notes
- This cycle did not find any need to redesign auth, ingest, or major packaging flows.
- The new issue is specifically about durable background-install behavior in one-off `npx` mode.
- Product recommendation: background mode should only be suggested when the executable path is stable enough to deserve user trust.

---

**Cycle:** R95 (installer/CLI polish QA — npx follow-up command clarity pass)

## Status: CLOSED — shipped in this cycle

Most of the installer/CLI still feels tight: setup works, config persists, metric toggles save cleanly, LaunchAgent install/uninstall remains calm, `--test-publish` is short, device identity persists, and the fresh-home `status` empty state remains honest.

This cycle shipped the one missing paper-cut fix in the one-off install path: when IdleWatch is launched via `npx`/`npm exec`, follow-up hints now stay in that same one-off form instead of suddenly assuming a global install.

That keeps the product honest in the exact moment users are most likely to copy-paste the next command.

---

## What shipped
- The CLI command inference helper now treats real `npm exec` / `npx` runs as one-off invocations even when the launched bin looks like a normal PATH shim.
- `status`, `quickstart`, `configure`, `install-agent`, `uninstall-agent`, and nearby help/startup follow-up hints now preserve `npx idlewatch ...` when appropriate.
- Source-checkout runs still use `node bin/idlewatch-agent.js ...`, and normal installed PATH usage still stays clean as `idlewatch ...`.
- Added regression coverage for one-off hint copy across help, status, quickstart/configure, and LaunchAgent flows.

---

## Priority findings

### M1. One-off `npx` runs print follow-up commands as `idlewatch ...` instead of preserving the one-off path
**Priority:** Medium  
**Status:** Fixed

**Why this matters:**
The package already does a nice job in postinstall docs of distinguishing:

- global install: `idlewatch ...`
- one-off use: `npx idlewatch ...`

But the live CLI flow does not stay consistent with that distinction.

When a user runs IdleWatch one-off via `npx`/`npm exec`, successful output currently tells them things like:

- `Get started:  idlewatch quickstart`
- `idlewatch install-agent`
- `idlewatch run`

That is a subtle setup-quality bug:

- it makes the one-off flow feel less trustworthy than the docs
- it can turn the very next copy-paste step into `command not found`
- it quietly nudges users toward a global install even when they intentionally chose not to do that
- it makes the setup wizard feel a little sloppier than it actually is

The product-taste fix is simple: if the current invocation is one-off, the next-step copy should stay one-off too.

Minimal, calm examples:

- `npx idlewatch quickstart`
- `npx idlewatch install-agent`
- `npx idlewatch run`

**Exact repro:**
1. Start from outside the repo with a fresh home:
   ```bash
   TMPHOME=$(mktemp -d)
   cd /tmp
   ```
2. Check fresh status through one-off execution:
   ```bash
   env HOME="$TMPHOME" \
     npm exec --yes --package /Users/luismantilla/.openclaw/workspace/idlewatch-skill \
     idlewatch status
   ```
3. Observe the output ends with:
   - `Get started:  idlewatch quickstart`
   - not `npx idlewatch quickstart`
4. Run one-off quickstart:
   ```bash
   env HOME="$TMPHOME" \
     IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
     IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
     IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
     npm exec --yes --package /Users/luismantilla/.openclaw/workspace/idlewatch-skill \
     idlewatch quickstart -- --no-tui
   ```
5. Observe the success block says:
   - `idlewatch install-agent`
   - `idlewatch run`
   - not `npx idlewatch install-agent` / `npx idlewatch run`

**Acceptance criteria:**
- [x] When invoked via `npx` or `npm exec`, next-step hints preserve a one-off command form instead of assuming a global install.
- [x] `status`, `quickstart`, `configure`, and LaunchAgent follow-up copy all stay consistent.
- [x] Global installs still show the cleaner `idlewatch ...` form.
- [x] Source-checkout runs can keep showing `node bin/idlewatch-agent.js ...` if that path is intentional.
- [x] No auth, ingest, or packaging redesign is introduced.

---

## Verified in this cycle
- Fresh-home `status` still presents an honest empty state (`Setup: not completed yet`) with preview labels.
- `quickstart --no-tui` still persists device name and selected monitor targets into `~/.idlewatch/idlewatch.env`.
- Device identity still persists cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- Reconfiguring metrics still updates the saved env file correctly (`cpu,memory` → `agent_activity`).
- `configure` still explains that saved changes apply on next start and points users to `install-agent` to refresh a running background agent.
- `status` still distinguishes installed vs not-installed LaunchAgent states.
- `install-agent` / `uninstall-agent` behavior remains concise and safe.
- `--test-publish` remains short and understandable in local-only mode.
- Postinstall install-path hints still clearly distinguish global install vs one-off `npx` use.
- New issue found: live runtime follow-up hints do not yet preserve one-off invocation style.

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

env HOME="$TMPHOME" \
  npm exec --yes --package /Users/luismantilla/.openclaw/workspace/idlewatch-skill \
  idlewatch status

env HOME="$TMPHOME" \
  IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
  IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
  npm exec --yes --package /Users/luismantilla/.openclaw/workspace/idlewatch-skill \
  idlewatch quickstart -- --no-tui
```

## Notes
- This cycle did not find any need to redesign auth, ingest, or major packaging flows.
- Remaining issue is strictly install-path copy polish: one-off users should see one-off follow-up commands.
- Previous fixes remain verified: fresh-home `status` stays honest, and local-only success paths stay quiet on stderr.

---

**Cycle:** R94 (installer/CLI polish QA — local-only messaging noise pass)

## Status: CLOSED — shipped in this cycle

A tiny but user-visible local-only messaging issue was cleaned up in this cycle.

Successful local-only setup and verification paths now stay quiet on stderr: `quickstart`, `configure`, and `--test-publish` keep the useful success copy on stdout without also emitting a second warning-style line.

That leaves the flow feeling calmer and less ambiguous, especially for wrappers or logs that treat stderr as something suspicious.

---

## What shipped
- Suppressed the redundant local-only warning during successful one-shot verification paths (`--once` / `--test-publish`).
- Preserved the existing local-only success messaging on stdout.
- Left real errors and genuine warning paths on stderr unchanged.

---

## Original finding

Most of the installer/CLI remains in good shape.

This pass re-checked the setup wizard, config persistence/reload cues, LaunchAgent install/uninstall flow, `--test-publish`, device identity persistence, metric toggle persistence, and npm/npx install-path clarity in a fresh home. Those surfaces still mostly feel clean and low-friction.

The only new issue worth carrying forward is a small but user-visible messaging problem in local-only mode: setup commands already explain local mode clearly in their main success output, but they also emit a second warning to stderr. The result is repetitive, slightly noisier than necessary, and easy to misread as a partial problem even when setup succeeded.

That is classic product-taste polish territory: not broken, just more talkative than the experience needs to be.

---

## Priority findings

### M1. Local-only setup commands repeat themselves with an extra stderr warning
**Priority:** Medium  
**Status:** Fixed

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
- [x] Successful local-only `quickstart` does not emit redundant warning-style stderr copy when the main success output already explains local-only mode.
- [x] Successful local-only `configure` follows the same rule.
- [x] Successful local-only `--test-publish` is similarly calm and non-repetitive.
- [x] Local-only mode still remains obvious to users.
- [x] Real errors still use stderr normally.
- [x] No auth, ingest, or packaging redesign is introduced.

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
