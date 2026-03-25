# IdleWatch Installer QA Log

**Repo:** `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`  
**Last updated:** Wednesday, March 25th, 2026 — 12:30 PM (America/Toronto)  
**Status:** CLOSED - no new polish issues worth opening in this targeted pass

---

## Cycle R93 Status: CLOSED

This pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install path clarity.

### Outcome
- No new user-facing polish regressions found in the requested QA lane.
- The current CLI still feels calm in the key seams that tend to get fussy: first-run status, install-before-setup, saved-config refresh language, uninstall retention messaging, and `npx` vs durable-install guidance.
- Targeted onboarding validation and the full unit suite both passed again.

### R93 spot-check coverage
- `install-agent --help`
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status` with LaunchAgent installed but not loaded
- `uninstall-agent` messaging
- `configure --no-tui` device rename + metric toggle persistence
- `--test-publish` help discoverability
- `npm run validate:onboarding --silent`
- `npm run test:unit --silent` (144/144 passing)

### Prioritized findings
- None. No confusing, verbose, repetitive, visually noisy, or unnecessarily technical user-facing issues were worth opening from this cycle.

### Acceptance notes
- First-run `status` stays calm: default metrics are primary, OpenClaw extras remain secondary.
- Setup completion still distinguishes first-time background enable from already-installed-but-needs-refresh.
- Config persistence/reload guidance remains predictable: save config first, then re-run `install-agent` when background mode needs the saved config applied.
- Device rename still preserves the original device ID and log file path while updating the visible device name.
- Metric selection changes still persist cleanly into saved config and the next `status` output.
- `npx` guidance still keeps foreground trial usage on `npx` and background mode on the durable global install path.
- `--test-publish` alias remains present and discoverable.
- LaunchAgent uninstall messaging remains clear and confirms config/log retention.

### Exact repro commands used
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. `FAKEBIN=$(mktemp -d)`
4. Create fake `launchctl` shim that leaves the agent not loaded while allowing install/uninstall commands to succeed:
   ```bash
   cat > "$FAKEBIN/launchctl" <<'EOF'
   #!/usr/bin/env bash
   set -euo pipefail
   cmd="${1:-}"
   if [[ "$cmd" == "print" ]]; then
     exit 1
   fi
   if [[ "$cmd" == "bootstrap" || "$cmd" == "enable" || "$cmd" == "bootout" || "$cmd" == "disable" || "$cmd" == "kickstart" ]]; then
     exit 0
   fi
   exit 0
   EOF
   chmod +x "$FAKEBIN/launchctl"
   ```
5. `node bin/idlewatch-agent.js install-agent --help`
6. `HOME="$TMPHOME" node bin/idlewatch-agent.js status`
7. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent`
8. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
9. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
10. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent`
11. `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+4p'`
12. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='Renamed QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
13. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
14. `npm run validate:onboarding --silent`
15. `npm run test:unit --silent`

### Notes
- The cron payload still pointed at `~/.openclaw/workspace/idlewatch-skill`, but the actual active repo for this pass was `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- No auth, ingest, or packaging redesign is recommended from this cycle.

---

## Cycle R92 Status: CLOSED

This pass stayed intentionally narrow: keep setup/install guidance calm and durable-install oriented without changing behavior, telemetry, or packaging.

### Outcome
- Shipped one tiny, low-risk copy polish improvement.
- Tightened `install-agent --help`, the no-config install follow-up, and the README background section so they all use the same shorter mental model:
  - install once
  - enable background mode when ready
- Added regression coverage for the calmer `install-agent --help` wording.
- Telemetry behavior, LaunchAgent behavior, auth/ingest, and packaging were left untouched.

### R92 spot-check coverage
- `install-agent --help`
- No-config `install-agent` follow-up copy
- README durable-install wording
- Targeted unit regression for `install-agent --help`

### Prioritized findings

#### [x] L8 — Durable-install guidance now reads like the rest of the product
**Why it matters:** The product already had the right low-friction setup model, but `install-agent --help` and README still spent a little too much time explaining themselves. This is tiny, but it sits right on the setup/background seam where cleaner wording matters most.

**What shipped**
- `install-agent --help` now says you can install first, save config later, and re-run `install-agent` when ready.
- The no-config install success message now says background mode stays off until setup is saved.
- README background setup now uses the same two-step durable-install phrasing already used in the CLI.

### Acceptance notes
- Background mode still points to the durable global install path, never `npx idlewatch install-agent`.
- Foreground one-off usage remains unchanged.
- LaunchAgent behavior and the working telemetry path remain unchanged.

---

## Cycle R91 Status: CLOSED

This pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install path clarity.

### Outcome
- No new end-user polish regressions found in the requested QA lane.
- The current CLI still feels intentionally minimal in the seams that often get noisy: first-run status, install-before-setup, saved-config refresh wording, uninstall retention messaging, and `npx` vs durable-install guidance.
- Targeted onboarding validation and the full unit suite both passed again.

### R91 spot-check coverage
- `install-agent --help`
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status` with LaunchAgent installed but not loaded
- `uninstall-agent` messaging
- `--test-publish` help discoverability
- `npm run validate:onboarding --silent`
- `npm run test:unit --silent` (144/144 passing)

### Prioritized findings
- None. No confusing, verbose, repetitive, visually noisy, or unnecessarily technical user-facing issues were worth opening from this cycle.

### Acceptance notes
- First-run `status` stays calm: default metrics are primary, OpenClaw extras remain secondary.
- Setup completion still distinguishes first-time background enable from already-installed-but-needs-refresh.
- Config persistence/reload guidance remains predictable: save config first, then re-run `install-agent` when background mode needs the saved config applied.
- `npx` guidance still keeps foreground trial usage on `npx` and background mode on the durable global install path.
- `--test-publish` alias remains present and discoverable.
- LaunchAgent uninstall messaging remains clear and confirms config/log retention.

### Exact repro commands used
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. `FAKEBIN=$(mktemp -d)`
4. Create fake `launchctl` shim that leaves the agent not loaded while allowing install/uninstall commands to succeed:
   ```bash
   cat > "$FAKEBIN/launchctl" <<'EOF'
   #!/usr/bin/env bash
   set -euo pipefail
   cmd="${1:-}"
   if [[ "$cmd" == "print" ]]; then
     exit 1
   fi
   if [[ "$cmd" == "bootstrap" || "$cmd" == "enable" || "$cmd" == "bootout" || "$cmd" == "disable" || "$cmd" == "kickstart" ]]; then
     exit 0
   fi
   exit 0
   EOF
   chmod +x "$FAKEBIN/launchctl"
   ```
5. `node bin/idlewatch-agent.js install-agent --help`
6. `HOME="$TMPHOME" node bin/idlewatch-agent.js status`
7. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent`
8. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
9. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
10. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent`
11. `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+3p'`
12. `npm run validate:onboarding --silent`
13. `npm run test:unit --silent`

### Notes
- The cron payload still pointed at `~/.openclaw/workspace/idlewatch-skill`, but the actual active repo for this pass was `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- No auth, ingest, or packaging redesign is recommended from this cycle.

---

## Cycle R90 Status: CLOSED

This pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install path clarity.

### Outcome
- No new end-user polish regressions found in the requested QA lane.
- The current CLI still feels calm and low-friction in the main seams that tend to get messy: install-before-setup, saved-config refresh language, `npx` vs durable-install guidance, first-run status, and uninstall messaging.
- Targeted onboarding validation and the full unit suite both passed.

### R90 spot-check coverage
- `install-agent --help`
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status` with LaunchAgent installed but not loaded
- `uninstall-agent` messaging
- `--test-publish` help discoverability
- `npm run validate:onboarding --silent`
- `npm run test:unit --silent` (144/144 passing)

### Prioritized findings
- None. No confusing, verbose, repetitive, or unnecessarily technical user-facing issues worth opening from this cycle.

### Acceptance notes
- Setup completion still distinguishes first-time background enable from already-installed-but-needs-refresh.
- Config persistence/reload guidance stays predictable: save config first, then re-run `install-agent` when background mode needs the saved config applied.
- Device rename / metric toggle persistence coverage still passes in the targeted suite.
- `npx` guidance remains clean: foreground trial usage stays on `npx`; durable background install stays on `npm install -g idlewatch` + `idlewatch install-agent`.
- `--test-publish` alias remains present and discoverable.
- LaunchAgent uninstall messaging stays clear and confirms config/log retention.

### Exact repro commands used
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. `FAKEBIN=$(mktemp -d)`
4. Create fake `launchctl` shim that leaves the agent not loaded while allowing install/uninstall commands to succeed:
   ```bash
   cat > "$FAKEBIN/launchctl" <<'EOF'
   #!/usr/bin/env bash
   set -euo pipefail
   cmd="${1:-}"
   if [[ "$cmd" == "print" ]]; then
     exit 1
   fi
   if [[ "$cmd" == "bootstrap" || "$cmd" == "enable" || "$cmd" == "bootout" || "$cmd" == "disable" || "$cmd" == "kickstart" ]]; then
     exit 0
   fi
   exit 0
   EOF
   chmod +x "$FAKEBIN/launchctl"
   ```
5. `node bin/idlewatch-agent.js install-agent --help`
6. `HOME="$TMPHOME" node bin/idlewatch-agent.js status`
7. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent`
8. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
9. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
10. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent`
11. `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+2p'`
12. `npm run validate:onboarding --silent`
13. `npm run test:unit --silent`

### Notes
- The cron payload pointed at `~/.openclaw/workspace/idlewatch-skill`, but the actual active repo for this pass was still `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- No auth, ingest, or packaging redesign is recommended from this cycle.

---

## Cycle R89 Status: CLOSED

This pass stayed intentionally narrow: make `install-agent --help` match the calmer durable-install wording already used in the refusal path and setup/status follow-ups.

### Outcome
- Shipped one tiny, low-risk copy polish improvement.
- `install-agent --help` now uses the same shorter durable-install wording already used elsewhere:
  - `Install once: npm install -g idlewatch`
  - `Then enable: idlewatch install-agent`
- Tightened one sentence so the saved-config follow-up reads a bit more naturally:
  - `run quickstart later, then re-run install-agent to apply it`
- Telemetry behavior, LaunchAgent behavior, auth/ingest, and packaging were left untouched.

### R89 spot-check coverage
- `install-agent --help`
- Existing targeted onboarding/install/status regression suite slice for install-path messaging

### Prioritized findings

#### [x] L7 — `install-agent --help` now matches the calmer durable-install wording used by the refusal path
**Why it matters:** Help output is where cautious users pause to decide whether background mode is simple or fiddly. The command already behaved correctly, but the help text still had older wording and a slightly fussier explanation than the rest of the product.

**What shipped**
- `install-agent --help` now says:
  - `Install once: npm install -g idlewatch`
  - `Then enable: idlewatch install-agent`
- Reworded the optional-config sentence slightly so the refresh path reads faster.

### Acceptance notes
- Background usage still points to the durable global install path, never `npx idlewatch install-agent`.
- Foreground one-off usage remains unchanged.
- LaunchAgent behavior and the working telemetry path remain unchanged.

---

## Cycle R88 Status: CLOSED

This pass stayed intentionally narrow: keep the setup/install mental model as calm and minimal as the already-polished setup/reconfigure/status flows.

### Outcome
- Shipped one tiny, low-risk copy polish improvement.
- `install-agent` help and the `npx` refusal path now use the same shorter durable-install wording already used elsewhere:
  - `Install once: npm install -g idlewatch`
  - `Then enable: idlewatch install-agent`
- Removed one extra explanatory line from the `npx` refusal path so the next step is faster to scan.
- Telemetry behavior, LaunchAgent behavior, auth/ingest, and packaging were left untouched.

### R88 spot-check coverage
- `install-agent --help`
- `install-agent` from an `npx`-like invocation
- Existing targeted onboarding/install/status regression suite

### Prioritized findings

#### [x] L6 — `install-agent` now matches the calmer durable-install wording used by setup/reconfigure/status
**Why it matters:** The product already had a nicer two-step mental model in setup/reconfigure/status, but `install-agent` still used older, more explanatory wording. This is tiny, but it is exactly the kind of seam users hit when they are deciding how to enable background mode.

**What shipped**
- `install-agent --help` now shows the durable path directly instead of only warning that one-off `npx`/`npm exec` installs are disposable.
- The `npx` refusal path now says:
  - `Install once: npm install -g idlewatch`
  - `Then enable: idlewatch install-agent`
  - `Run now: npx idlewatch run`
- Removed the extra npm-cache explanation line to reduce friction and keep the action path obvious.

### Acceptance notes
- Foreground one-off usage still points to `npx idlewatch run`.
- Background usage still points to the durable global install path, never `npx idlewatch install-agent`.
- LaunchAgent behavior and the working telemetry path remain unchanged.

---

## Cycle R87 Status: CLOSED

This pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install path clarity.

### Outcome
- No new end-user polish regressions found in the targeted R87 checks.
- The current CLI still reads cleanly in the specific UX seams that were most likely to feel fussy: first-run status, install-before-setup, saved-config refresh guidance, and `npx` vs durable-install messaging.
- Existing tiny copy fixes from the prior rounds still hold up under spot-check and test coverage.

### R87 spot-check coverage
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status` with LaunchAgent installed but not loaded
- `npx`-style first-run `status`
- Targeted installer/onboarding/status unit coverage

### Prioritized findings
- None. No new polish issues worth opening from this cycle.

### Acceptance notes
- First-run `status` stays calm: default metrics first, extras secondary.
- Setup completion still distinguishes first-time background enable from already-installed-but-needs-refresh.
- Post-setup `status` remains honest when config exists but the LaunchAgent is installed and not loaded.
- `npx` guidance stays minimal and durable-install oriented: foreground on `npx`, background on `npm install -g idlewatch` + `idlewatch install-agent`.
- Device rename / metric persistence coverage still passes in the targeted unit suite.
- `--test-publish` alias remains present and discoverable in status/help output.

---

## Cycle R86 Status: CLOSED

This pass stayed intentionally narrow: keep `status` as tidy as setup/reconfigure for `npx` users, especially around saved-config background follow-up hints.

### Outcome
- Shipped one tiny, low-risk polish improvement.
- `status` now uses the same shorter durable-install mental model already used in setup/reconfigure:
  - `Install once: npm install -g idlewatch`
  - `Then enable: idlewatch install-agent`
- Telemetry behavior, install semantics, and working background flows were left untouched.

### R86 spot-check coverage
- `npx`-style `status` with saved config and no samples yet
- `npx`-style `status` with saved config and existing samples
- Existing onboarding/status regression test suite slice

### Prioritized findings

#### [x] L5 — `npx` status background hint now matches the calmer setup/reconfigure wording
**Why it matters:** `status` is often where people sanity-check what to do next. The old one-line `npx` background hint was correct, but wordier and less scannable than the cleaner two-line setup/reconfigure copy.

**What shipped**
- Replaced the old `status` hint:
  - `Background: install IdleWatch globally first, then run idlewatch install-agent`
- With the shorter pair:
  - `Install once: npm install -g idlewatch`
  - `Then enable: idlewatch install-agent`

### Acceptance notes
- `npx` status still keeps foreground commands on `npx`.
- Background guidance still points to durable `idlewatch install-agent`, not `npx idlewatch install-agent`.
- The copy is shorter, easier to scan, and consistent with setup/reconfigure.

## Cycle R85 Status: CLOSED

This pass stayed intentionally narrow: setup/reconfigure completion copy, saved-config mental model, and keeping `npx` guidance minimal without changing the durable-install recommendation.

### Outcome
- Shipped one tiny, low-risk polish improvement.
- `npx` quickstart/configure completion now says the durable background path in a shorter, cleaner two-line shape instead of a more verbose three-line explanation.
- Telemetry behavior and install semantics were left untouched.

### R85 spot-check coverage
- `npx`-style `quickstart --no-tui` completion copy
- `npx`-style `configure --no-tui` completion copy
- Existing installer/setup/reconfigure messaging regression test suite

### Prioritized findings

#### [x] L4 — `npx` setup/reconfigure background follow-up copy is shorter and less fussy
**Why it matters:** The existing `npx` completion copy was correct, but it spent an extra line explaining the durable-install mental model. For a setup flow that is already doing the right thing, shorter is nicer.

**What shipped**
- `npx` quickstart/configure now says:
  - `Install IdleWatch once, then run idlewatch install-agent`
  - `npm install -g idlewatch`
- This keeps the durable-install guidance intact while reducing friction and visual noise.

### Acceptance notes
- `npx` setup/reconfigure still keeps foreground guidance on `npx`.
- Background guidance still points to durable `idlewatch install-agent`, not `npx idlewatch install-agent`.
- The copy is shorter without changing behavior.

## Cycle R84 Status: CLOSED

This pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install path clarity.

### Outcome
- No new user-facing polish regressions found in the targeted R84 checks.
- The current CLI still feels appropriately low-friction: calm first status output, clear durable-install guidance for background mode, and honest copy when saved config exists but the LaunchAgent still needs a refresh/start.
- The cron prompt pointed at `~/.openclaw/workspace/idlewatch-skill`, but the active repo for this pass was still `~/.openclaw/workspace.bak/idlewatch-skill`.

### R84 spot-check coverage
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- Local-only `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status`
- `configure --no-tui` device rename + metric change persistence
- `--test-publish` alias behavior
- `uninstall-agent` messaging
- `npx`-style quickstart / configure / status / install-agent messaging

### Prioritized findings
- None. No new polish issues worth opening from this cycle.

### Acceptance notes
- Setup completion correctly distinguishes first-time background enable vs already-installed-but-needs-refresh.
- Device rename preserves the original device ID and log file path while updating the visible device name.
- Metric selection changes persist cleanly into saved config and the next `status` output.
- `npx` flows keep foreground guidance on `npx` while pointing background setup back to durable `idlewatch install-agent`.
- `uninstall-agent` messaging stays calm and confirms config/log retention.

## Cycle R83 Status: CLOSED

This pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install path clarity.

### Outcome
- No new user-facing polish regressions found in the targeted R83 spot-checks.
- The small copy/messaging fixes from the prior round still hold up in clean first-run, install-before-setup, and reconfigure flows.
- Product shape still feels right: low-friction setup, calm first status output, durable-install clarity for background mode, and honest refresh/re-enable language after config changes.

### R83 spot-check coverage
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- Local-only `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status`
- `configure --no-tui` device rename + metric change persistence
- `install-agent` / refresh guidance from an `npx`-like invocation
- `--test-publish` alias behavior
- `uninstall-agent` messaging

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
- [x] `npx` quickstart/configure background follow-up is now shorter: install once, then run `idlewatch install-agent`.
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
