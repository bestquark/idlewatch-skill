# IdleWatch Installer QA Log

**Repo:** `/Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`  
**Last updated:** Wednesday, March 25th, 2026 — 4:15 PM (America/Toronto)  
**Status:** CLOSED - R116 polish spot-check pass found no new end-user issues

---

## Cycle R116 Status: CLOSED ✅

This pass stayed intentionally narrow and product-facing: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install-path clarity.

### Outcome
- No new end-user polish regressions were worth opening from this cycle.
- The current CLI still feels calm in the seams most likely to get noisy: first-run status, install-before-setup, already-installed refresh guidance, uninstall retention messaging, test-publish discoverability, device rename continuity, metric toggle persistence, and `npx` vs durable-install guidance.
- The small saved-mode persistence fix from R115 still holds up in the surrounding setup/reconfigure flows.

### R116 spot-check coverage
- `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+8p'`
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- Local-only `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status` with LaunchAgent installed but not loaded
- `configure --no-tui` device rename + metric toggle persistence
- `uninstall-agent` messaging
- `npx`-like `install-agent --help`
- `npx`-like `quickstart --no-tui`
- `npx`-like `status`
- `npx`-like `install-agent` refusal
- Durable LaunchAgent preinstalled + `npx` `configure --no-tui`
- `npm run validate:onboarding --silent`

### Prioritized findings
- None. No confusing, verbose, repetitive, visually noisy, or unnecessarily technical user-facing issues were worth opening from this cycle.

### Acceptance notes
- First-run `status` stays light: default metrics lead and OpenClaw extras remain secondary.
- Install-before-setup still keeps the right mental model: background install can happen early, but collection waits for saved setup.
- Setup and reconfigure completion still clearly distinguish first-time background enable from already-installed-needs-refresh.
- Device rename still preserves the original device ID and local log path while updating the visible device name.
- Metric selection changes still persist cleanly into saved config and next `status` output.
- LaunchAgent uninstall messaging remains clear, safe, and confirms config/log retention.
- `--test-publish` remains present and discoverable.
- `npx` guidance still keeps foreground trial usage on `npx` while pointing background mode to the durable global install path.

### Exact repro commands used
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. `TMPHOME2=$(mktemp -d)`
4. `TMPHOME3=$(mktemp -d)`
5. `FAKEBIN=$(mktemp -d)`
6. Create fake `launchctl` shim that leaves the agent not loaded while allowing install/uninstall commands to succeed:
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
7. `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+8p'`
8. `HOME="$TMPHOME" node bin/idlewatch-agent.js status`
9. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent`
10. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
11. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
12. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_DEVICE_NAME='Renamed QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
13. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
14. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent`
15. `npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent --help`
16. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
17. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js status`
18. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME3" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent`
19. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" node bin/idlewatch-agent.js install-agent >/dev/null`
20. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_DEVICE_NAME='NPX Reconfig Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
21. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" node bin/idlewatch-agent.js status`
22. `npm run validate:onboarding --silent`

### Notes
- The cron payload path was stale again; the active repo/docs available for this pass were under `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- No auth, ingest, packaging, or background-agent redesign is recommended from this cycle.

---

## Cycle R115 Status: CLOSED ✅

This pass stayed intentionally narrow and product-facing: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install-path clarity.

### Outcome
- Shipped one small, low-risk polish fix in the saved-config / reconfigure lane.
- Non-interactive `configure --no-tui` now keeps the existing saved publish mode when the caller only changes visible settings.
- Local-only devices stay local-only unless the user explicitly switches modes, so reconfigure no longer feels like a partial reset.
- No auth, ingest, packaging, or background-agent redesign was needed.

### Prioritized findings

#### [x] H3 — Non-interactive `configure --no-tui` now preserves the saved mode
**Why it matters:** This is exactly the kind of subtle setup seam that makes a polished CLI feel unreliable in automation, cron, CI-ish, or copy-pasted terminal flows. Reconfigure is supposed to preserve existing choices unless the user changes them. Right now, a saved local-only device silently falls back to production/cloud mode semantics in non-interactive reconfigure, which then fails asking for an API key the user never intended to add.

**Exact repro**
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. First-time local-only setup:
   ```bash
   HOME="$TMPHOME" \
   IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
   IDLEWATCH_ENROLL_MODE=local \
   IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
   IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
   node bin/idlewatch-agent.js quickstart --no-tui
   ```
4. Reconfigure without explicitly restating the mode, only changing visible settings:
   ```bash
   HOME="$TMPHOME" \
   IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
   IDLEWATCH_ENROLL_DEVICE_NAME='Renamed Box' \
   IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' \
   node bin/idlewatch-agent.js configure --no-tui
   ```

**Observed before fix**
- First-time setup succeeds in local-only mode.
- Non-interactive reconfigure exits with:
  - `Enrollment failed: Missing cloud API key (IDLEWATCH_CLOUD_API_KEY).`
- The command behaves as if mode silently reverted to cloud/production instead of inheriting the already-saved local-only choice.

**Why this feels off**
- The product’s current mental model everywhere else is: saved config is reused unless you intentionally change it.
- Interactive reconfigure effectively follows that model.
- Non-interactive reconfigure breaking that expectation makes automation feel brittle and more technical than it should.
- This is especially confusing because the failure happens after a perfectly valid local-only setup.

**What shipped**
- Non-interactive enrollment now reuses the saved mode as the default when `IDLEWATCH_ENROLL_MODE` is omitted during reconfigure.
- Explicit mode overrides still win when the caller provides one.
- Existing saved API-key reuse behavior for production mode remains unchanged.

**Acceptance notes**
- Non-interactive `configure --no-tui` now preserves the saved mode when `IDLEWATCH_ENROLL_MODE` is omitted.
- A previously local-only device stays local-only unless the user explicitly switches to cloud mode.
- A previously cloud-linked device stays cloud-linked unless the user explicitly switches modes.
- Reconfigure still allows an explicit mode override when provided.
- The working telemetry path remains untouched.

### Spot-check coverage
- Non-interactive local-only `quickstart --no-tui`
- Non-interactive local-only `configure --no-tui` with only device-name/metric changes
- Targeted regression in `test/openclaw-env.test.mjs`
- Narrow config-persistence regression slice in `node --test test/openclaw-env.test.mjs`

### Notes
- The cron payload path was stale again; the active repo/docs available for this pass were under `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- This fix is narrow and user-facing; it does not require auth, ingest, packaging, or background-agent redesign.

---

## Cycle R114 Status: CLOSED ✅

This pass stayed intentionally narrow and product-facing: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install-path clarity.

### Outcome
- Shipped one small, low-risk polish fix in the device-identity lane.
- Core behavior stays the same: reconfigure still preserves the original device ID/log/cache identity on purpose.
- The product seam is now explained directly in both reconfigure completion and `status`, so preserved identity reads as intentional continuity rather than partial drift.
- No auth, ingest, packaging, or background-agent behavior changes were needed.

### Prioritized findings

#### [x] M6 — Device rename persistence is correct, and the status/reconfigure UX now explains preserved identity clearly
**Why it matters:** This is exactly the kind of subtle trust seam that makes a polished setup feel slightly off. The product intentionally keeps the original device identity stable across reconfigure, which is good for continuity. But after a rename, `status` shows the new visible name beside the old device ID and old log-file stem with no explanation. To an end user, that can look like partial config drift rather than an intentional identity-preservation rule.

**Exact repro**
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. Run first-time setup:
   ```bash
   HOME="$TMPHOME" \
   IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
   IDLEWATCH_NO_TUI=1 \
   IDLEWATCH_ENROLL_MODE=production \
   IDLEWATCH_CLOUD_API_KEY=iwk_abcdefghijklmnopqrstuvwxyz123456 \
   IDLEWATCH_ENROLL_DEVICE_NAME='Kitchen Mac' \
   IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,temperature' \
   node bin/idlewatch-agent.js quickstart
   ```
4. Reconfigure with a new visible name and a different metric set:
   ```bash
   HOME="$TMPHOME" \
   IDLEWATCH_ENROLL_NON_INTERACTIVE=1 \
   IDLEWATCH_NO_TUI=1 \
   IDLEWATCH_ENROLL_DEVICE_NAME='Desk Mac' \
   IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' \
   node bin/idlewatch-agent.js configure
   ```
5. Check status:
   ```bash
   HOME="$TMPHOME" node bin/idlewatch-agent.js status
   ```

**Observed**
- `configure` preserves identity as designed:
  - `IDLEWATCH_DEVICE_NAME=Desk Mac`
  - `IDLEWATCH_DEVICE_ID=kitchen-mac`
  - `IDLEWATCH_LOCAL_LOG_PATH=.../kitchen-mac-metrics.ndjson`
- `status` then shows:
  - `Device: Desk Mac`
  - `Device ID: kitchen-mac`
  - `Local log: .../kitchen-mac-metrics.ndjson`
- Nothing in that screen explains that this is intentional continuity, not a partial rename.

**Why this feels off**
- The behavior itself is probably the right default.
- The wording is the seam: the CLI currently makes preserved identity look like a mismatch.
- This is especially likely to confuse cautious users doing a rename specifically to clean up what they see in the product.

**What shipped**
- Kept the current persistence behavior unchanged.
- `configure` / `reconfigure` now add a short clarifier when the visible device name changed but the stable device identity was preserved.
- `status` now shows the same calm clarification inline:
  - `Device ID: kitchen-mac (kept from original setup for continuity)`
- This makes the old local-log stem feel intentional without adding any extra setup branch or long explanation.

**Acceptance notes**
- The stable device identity is still preserved across rename.
- The wording now explains that preserved identity directly where users notice it.
- The log/cache path remains unchanged and now reads as intentional continuity rather than stale config.
- No auth, ingest, packaging, or telemetry-path behavior was touched.

### Spot-check coverage
- Clean first-run `status` from a packaged/global install
- `install-agent` before setup from a packaged/global install
- `uninstall-agent` retention messaging from a packaged/global install
- Non-interactive `quickstart` / `configure` rename + metric toggle persistence in a clean HOME
- `status` after rename with preserved device ID
- Invalid cloud-key setup failure copy

### Notes
- The cron payload path was stale again; the active repo/docs available for this pass were under `~/.openclaw/workspace.bak/idlewatch-skill`.
- A packaged/global install still gives clean `idlewatch ...` command hints; the confusing seam found in this pass is specifically the preserved-identity explanation after rename, not npm/npx path clarity.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.

---

## Cycle R113 Status: CLOSED

This pass stayed intentionally narrow: one tiny setup/reconfigure help-text consistency fix only, with no setup-flow changes, no saved-config behavior changes, and no telemetry-path changes.

### Outcome
- Shipped one small, low-risk polish improvement.
- `configure --help` and `reconfigure --help` now match the calmer wording already used elsewhere in the product:
  - `Saved changes apply on the next start.`
  - `If background mode is already enabled, re-run ... install-agent to refresh it with the saved config.`
- No auth, ingest, packaging, or telemetry behavior was touched.

### R113 spot-check coverage
- [x] `node bin/idlewatch-agent.js configure --help`
- [x] Help-text regression coverage in `test/openclaw-env.test.mjs`

### Prioritized findings

#### [x] L21 — Configure help now matches the calmer saved-config / refresh wording used elsewhere
**Why it matters:** The actual product behavior was already right, but help still used an older, slightly more technical phrasing (`the next time IdleWatch starts`, `restart it with the updated config`). Tightening that seam makes setup/reconfigure feel more consistent with the rest of the CLI.

**What shipped**
- Reworded configure/reconfigure help from:
  - `Saved changes apply the next time IdleWatch starts.`
  - `If the background agent is already running, re-run ... to restart it with the updated config.`
- To:
  - `Saved changes apply on the next start.`
  - `If background mode is already enabled, re-run ... to refresh it with the saved config.`

### Acceptance notes
- Help now matches the CLI's existing saved-config mental model more closely.
- No setup semantics changed.
- The working telemetry path remains untouched.

---

## Cycle R112 Status: CLOSED

This pass stayed intentionally narrow and product-facing: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install-path clarity.

### Outcome
- No new user-facing polish regressions were worth opening from this cycle.
- The current installer/CLI still feels neat in the seams most likely to get noisy: first-run status, install-before-setup, already-installed refresh guidance, uninstall retention messaging, device rename persistence, metric toggle persistence, and `npx` vs durable-install guidance.
- The calmer non-TTY guidance and durable-install wording still hold up in both source-checkout and `npx`-like paths.

### R112 spot-check coverage
- `node bin/idlewatch-agent.js install-agent --help`
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status` with LaunchAgent installed but not loaded
- `configure --no-tui` device rename + metric toggle persistence
- `uninstall-agent` messaging
- `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+6p'`
- `npx`-like `install-agent --help`
- `npx`-like `quickstart --no-tui` in a clean HOME
- `npx`-like `status`
- `npx`-like `install-agent` refusal
- `npx`-like `configure --no-tui` after pre-installing the LaunchAgent
- `npm run validate:onboarding --silent`

### Prioritized findings
- None. No confusing, verbose, repetitive, visually noisy, or unnecessarily technical user-facing issues were worth opening from this cycle.

### Acceptance notes
- First-run `status` remains light: default metrics lead, OpenClaw extras stay secondary.
- Install-before-setup still keeps the right mental model: background install can happen early, but collection waits for saved setup.
- Setup and reconfigure completion still clearly distinguish first-time background enable from already-installed-needs-refresh.
- Device rename still preserves the original device ID and local log path while updating the visible device name.
- Metric selection changes still persist cleanly into saved config and next `status` output.
- LaunchAgent uninstall messaging remains clear, safe, and confirms config/log retention.
- `--test-publish` remains present and discoverable.
- `npx` guidance still keeps foreground trial usage on `npx` while pointing background mode to the durable global install path.

### Exact repro commands used
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. `TMPHOME2=$(mktemp -d)`
4. `TMPHOME3=$(mktemp -d)`
5. `FAKEBIN=$(mktemp -d)`
6. Create fake `launchctl` shim that leaves the agent not loaded while allowing install/uninstall commands to succeed:
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
7. `node bin/idlewatch-agent.js install-agent --help`
8. `HOME="$TMPHOME" node bin/idlewatch-agent.js status`
9. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent`
10. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
11. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
12. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='Renamed QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
13. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
14. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent`
15. `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+6p'`
16. `npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent --help`
17. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
18. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js status`
19. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME3" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent`
20. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" node bin/idlewatch-agent.js install-agent >/dev/null`
21. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Reconfig Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
22. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" node bin/idlewatch-agent.js status`
23. `npm run validate:onboarding --silent`

### Notes
- The cron payload path was stale again; the active repo/docs available for this pass were under `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- No auth, ingest, or packaging redesign is recommended from this cycle.

---

## Cycle R111 Status: CLOSED

This pass stayed intentionally narrow and product-facing: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install-path clarity.

### Outcome
- No new user-facing polish regressions were worth opening from this cycle.
- The current installer/CLI still feels neat in the seams most likely to get noisy: first-run status, install-before-setup, already-installed refresh guidance, uninstall retention messaging, device rename persistence, metric toggle persistence, and `npx` vs durable-install guidance.
- The tiny R110 non-TTY hint cleanup still holds up in both source-checkout and `npx`-like paths.

### R111 spot-check coverage
- `node bin/idlewatch-agent.js install-agent --help`
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status` with LaunchAgent installed but not loaded
- `configure --no-tui` device rename + metric toggle persistence
- `uninstall-agent` messaging
- `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+6p'`
- `npx`-like `install-agent --help`
- `npx`-like `quickstart --no-tui` in a clean HOME
- `npx`-like `status`
- `npx`-like `install-agent` refusal
- `npx`-like `configure --no-tui` after pre-installing the LaunchAgent
- `npm run validate:onboarding --silent`

### Prioritized findings
- None. No confusing, verbose, repetitive, visually noisy, or unnecessarily technical user-facing issues were worth opening from this cycle.

### Acceptance notes
- First-run `status` remains light: default metrics lead, OpenClaw extras stay secondary.
- Install-before-setup still keeps the right mental model: background install can happen early, but collection waits for saved setup.
- Setup and reconfigure completion still clearly distinguish first-time background enable from already-installed-needs-refresh.
- Device rename still preserves the original device ID and local log path while updating the visible device name.
- Metric selection changes still persist cleanly into saved config and next `status` output.
- LaunchAgent uninstall messaging remains clear, safe, and confirms config/log retention.
- `--test-publish` remains present and discoverable.
- `npx` guidance still keeps foreground trial usage on `npx` while pointing background mode to the durable global install path.

### Exact repro commands used
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. `TMPHOME2=$(mktemp -d)`
4. `TMPHOME3=$(mktemp -d)`
5. `FAKEBIN=$(mktemp -d)`
6. Create fake `launchctl` shim that leaves the agent not loaded while allowing install/uninstall commands to succeed:
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
7. `node bin/idlewatch-agent.js install-agent --help`
8. `HOME="$TMPHOME" node bin/idlewatch-agent.js status`
9. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent`
10. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
11. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
12. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='Renamed QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
13. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
14. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent`
15. `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+6p'`
16. `npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent --help`
17. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
18. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js status`
19. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME3" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent`
20. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" node bin/idlewatch-agent.js install-agent >/dev/null`
21. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Reconfig Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
22. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" node bin/idlewatch-agent.js status`
23. `npm run validate:onboarding --silent`

### Notes
- The cron payload path was stale again; the active repo/docs available for this pass were under `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- No auth, ingest, or packaging redesign is recommended from this cycle.

---

## Cycle R110 Status: CLOSED

This pass stayed intentionally narrow: one small non-TTY setup guidance polish fix only, with no setup-flow redesign, no auth/ingest changes, no packaging changes, and no telemetry-path changes.

### Outcome
- Shipped one tiny, low-risk setup/install/status guidance improvement.
- When the CLI is running without a TTY, first-step and recovery hints now point to `quickstart --no-tui` instead of plain `quickstart`.
- This keeps headless, cron, paste-into-terminal, and CI-ish contexts on the path that is most likely to work immediately.
- Telemetry behavior, saved config behavior, LaunchAgent behavior, and durable-install guidance were left untouched.

### R110 spot-check coverage
- `node --test test/openclaw-env.test.mjs`
- `npm run validate:onboarding --silent`
- Non-TTY help/status/install/retry command-hint review in source-checkout and `npx` contexts

### Prioritized findings

#### [x] L20 — Non-TTY setup hints now point straight to `--no-tui`
**Why it matters:** The product already supports `--no-tui`, but some of the most important next-step hints still suggested plain `quickstart` even when there was no TTY. In those contexts, the calmer path is to point straight at the text-prompt route so the next command works on the first try.

**What shipped**
- In non-TTY contexts, these hints now use `quickstart --no-tui`:
  - main `--help` footer
  - `install-agent` before-setup follow-up (`Save setup:`)
  - setup-failure retry copy (`Redo:`)
  - first-run `status` (`Get started:`)
- Interactive TTY usage remains unchanged and still points to plain `quickstart`.

### Acceptance notes
- Normal interactive setup still defaults to the standard `quickstart` path.
- Non-TTY guidance now removes one avoidable setup stumble without adding any new options or branches.
- The working telemetry path remains untouched.

---

## Cycle R109 Status: CLOSED

This pass stayed intentionally narrow and product-facing: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install-path clarity.

### Outcome
- No new end-user polish regressions were worth opening from this cycle.
- The current installer/CLI still feels calm in the seams most likely to get noisy: first-run status, install-before-setup, already-installed refresh guidance, uninstall retention messaging, device rename persistence, metric toggle persistence, and `npx` vs durable-install guidance.
- The tiny R108 wording changes still hold up in real CLI output and keep the setup flow simpler rather than more narrated.

### R109 spot-check coverage
- `node bin/idlewatch-agent.js install-agent --help`
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status` with LaunchAgent installed but not loaded
- `configure --no-tui` device rename + metric toggle persistence
- `uninstall-agent` messaging
- `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+6p'`
- `npx`-like `install-agent --help`
- `npx`-like `quickstart --no-tui` in a clean HOME
- `npx`-like `status`
- `npx`-like `install-agent` refusal
- `npx`-like `configure --no-tui` after pre-installing the LaunchAgent
- `npm run validate:onboarding --silent`

### Prioritized findings
- None. No confusing, verbose, repetitive, visually noisy, or unnecessarily technical user-facing issues were worth opening from this cycle.

### Acceptance notes
- First-run `status` remains light: default metrics lead, OpenClaw extras stay secondary.
- Install-before-setup still keeps the right mental model: background install can happen early, but collection waits for saved setup.
- Setup and reconfigure completion still clearly distinguish first-time background enable from already-installed-needs-refresh.
- Device rename still preserves the original device ID and local log path while updating the visible device name.
- Metric selection changes still persist cleanly into saved config and next `status` output.
- LaunchAgent uninstall messaging remains clear, safe, and confirms config/log retention.
- `--test-publish` remains present and discoverable.
- `npx` guidance still keeps foreground trial usage on `npx` while pointing background mode to the durable global install path.

### Exact repro commands used
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. `TMPHOME2=$(mktemp -d)`
4. `TMPHOME3=$(mktemp -d)`
5. `FAKEBIN=$(mktemp -d)`
6. Create fake `launchctl` shim that leaves the agent not loaded while allowing install/uninstall commands to succeed:
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
7. `node bin/idlewatch-agent.js install-agent --help`
8. `HOME="$TMPHOME" node bin/idlewatch-agent.js status`
9. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent`
10. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
11. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
12. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='Renamed QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
13. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
14. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent`
15. `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+6p'`
16. `npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent --help`
17. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
18. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js status`
19. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME3" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent`
20. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" node bin/idlewatch-agent.js install-agent >/dev/null`
21. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Reconfig Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
22. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" node bin/idlewatch-agent.js status`
23. `npm run validate:onboarding --silent`

### Notes
- The cron payload path was stale again; the active repo/docs available for this pass were under `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- No auth, ingest, or packaging redesign is recommended from this cycle.

---

## Cycle R108 Status: CLOSED

This pass stayed intentionally narrow: one tiny setup/install wording cleanup and one tiny setup-completion wording cleanup, with no behavior, config, install semantics, or telemetry changes.

### Outcome
- Shipped two small, low-risk polish improvements.
- Install-before-setup no longer says `Saved config:` before any config exists; it now says `Config path:` so the file location is clear without implying setup already happened.
- Setup/reconfigure completion for the already-installed-but-not-loaded background agent now uses a shorter action-first shape:
  - `Start it: ...`
  - `It will reload using the saved config.`
- No auth, ingest, packaging, or telemetry-path changes were touched.

### R108 spot-check coverage
- `install-agent` before setup in a clean HOME
- `quickstart --no-tui` after pre-installing the LaunchAgent
- `npm run validate:onboarding --silent`
- `node --test test/openclaw-env.test.mjs`

### Prioritized findings

#### [x] L18 — Install-before-setup no longer implies config was already saved
**Why it matters:** This was a tiny wording trust seam. The no-config install path behaved correctly, but showing `Saved config:` before setup existed made the path feel a little sloppier than the actual product behavior.

**What shipped**
- Reworded the no-config install follow-up from:
  - `Saved config: ...`
- To:
  - `Config path: ...`
- The path still stays visible so cautious users know where setup will save.

#### [x] L19 — Already-installed setup completion now leads with the action instead of a sentence
**Why it matters:** This path was already honest, but slightly more narrated than the rest of the product. A short action-first follow-up scans faster right after setup succeeds.

**What shipped**
- Reworded the already-installed background follow-up from:
  - `Re-run ... install-agent to start it with the saved config.`
- To:
  - `Start it: ...`
  - `It will reload using the saved config.`
- `npx` still keeps the durable-install reminder unchanged.

### Acceptance notes
- Install-before-setup still keeps background mode off until setup is saved.
- The already-installed background path still clearly distinguishes `saved config exists` from `background not loaded yet`.
- The working telemetry path remains untouched.

---

## Cycle R107 Status: CLOSED

This pass stayed intentionally narrow and product-facing: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install-path clarity.

### Outcome
- No new end-user polish regressions were worth opening from this cycle.
- The current installer/CLI still feels calm in the seams most likely to get noisy: first-run status, install-before-setup, already-installed refresh guidance, uninstall retention messaging, device rename persistence, metric toggle persistence, and `npx` vs durable-install guidance.
- The packaged app shell scripts still match the calmer CLI mental model from the prior round: no-config install stays dormant, and uninstall copy stays safe/reversible.

### R107 spot-check coverage
- `node bin/idlewatch-agent.js install-agent --help`
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status` with LaunchAgent installed but not loaded
- `configure --no-tui` device rename + metric toggle persistence
- `uninstall-agent` messaging
- `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+5p'`
- `npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent --help`
- `npx`-like `quickstart --no-tui` in a clean HOME
- `npx`-like `status`
- `npx`-like `install-agent` refusal
- `npx`-like `configure --no-tui` after pre-installing the LaunchAgent
- `npm run validate:onboarding --silent`

### Prioritized findings
- None. No confusing, verbose, repetitive, visually noisy, or unnecessarily technical user-facing issues were worth opening from this cycle.

### Acceptance notes
- First-run `status` remains light: default metrics lead, OpenClaw extras stay secondary.
- Install-before-setup still keeps the right mental model: background install can happen early, but collection waits for saved setup.
- Setup and reconfigure completion still clearly distinguish first-time background enable from already-installed-needs-refresh.
- Device rename still preserves the original device ID and local log path while updating the visible device name.
- Metric selection changes still persist cleanly into saved config and next `status` output.
- LaunchAgent uninstall messaging remains clear, safe, and confirms config/log retention.
- `--test-publish` remains present and discoverable.
- `npx` guidance still keeps foreground trial usage on `npx` while pointing background mode to the durable global install path.

### Exact repro commands used
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. `TMPHOME2=$(mktemp -d)`
4. `TMPHOME3=$(mktemp -d)`
5. `FAKEBIN=$(mktemp -d)`
6. Create fake `launchctl` shim that leaves the agent not loaded while allowing install/uninstall commands to succeed:
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
7. `node bin/idlewatch-agent.js install-agent --help`
8. `HOME="$TMPHOME" node bin/idlewatch-agent.js status`
9. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent`
10. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
11. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
12. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='Renamed QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
13. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
14. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent`
15. `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+5p'`
16. `npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent --help`
17. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
18. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js status`
19. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME3" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent`
20. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" node bin/idlewatch-agent.js install-agent >/dev/null`
21. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Reconfig Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
22. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" node bin/idlewatch-agent.js status`
23. `npm run validate:onboarding --silent`

### Notes
- The cron payload path was stale again; the active repo/docs available for this pass were under `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- No auth, ingest, or packaging redesign is recommended from this cycle.

---

## Cycle R106 Status: CLOSED

This pass stayed narrow and product-facing: setup wizard quality, config persistence/reload behavior, launch-agent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install-path clarity.

### Outcome
- Shipped two small, low-risk script-path polish fixes.
- Both were UX/trust seams, not architecture problems.
- Main theme: the app-installer LaunchAgent scripts now better match the calmer CLI mental model.

### R106 spot-check coverage
- README install / npx guidance review
- `bin/idlewatch-agent.js` help, setup, install-agent, uninstall-agent, status, and test-publish copy review
- `src/enrollment.js` device-id + metric persistence review
- `scripts/install-macos-launch-agent.sh` / `scripts/uninstall-macos-launch-agent.sh` behavior review
- Config persistence + reload-path review against saved `~/.idlewatch/idlewatch.env` flow

### Prioritized findings

#### [x] M5 — Packaged app LaunchAgent script no longer auto-starts before setup is saved, matching the calmer CLI path
**Why it matters:** This is the biggest remaining polish mismatch. The CLI `idlewatch install-agent` path is careful: if setup is not saved yet, it installs safely but keeps background collection off until the user finishes setup and re-runs install. The packaged app shell installer does the opposite mental model: it always writes `RunAtLoad=true` and `KeepAlive=true`, bootstraps immediately, and then says the agent is already installed and will start at login. That makes the app path feel less predictable and more technical than the CLI path.

**Exact repro**
1. Open `scripts/install-macos-launch-agent.sh`.
2. Note that the generated plist always contains:
   - `<key>RunAtLoad</key><true/>`
   - `<key>KeepAlive</key><true/>`
3. Note that the script always runs:
   - `launchctl bootstrap "gui/$USER_GUID" "$PLIST_PATH"`
   - `launchctl enable "$PLIST_ID"`
4. Continue reading the `else` branch for missing config.
5. Observe the user-facing copy:
   - `The LaunchAgent is already installed and will start at login.`
   - `Finish setup to give it a saved config:`
6. Compare that with `bin/idlewatch-agent.js install-agent`, which intentionally keeps background mode off until config exists and tells the user to re-run install after setup.

**Acceptance criteria**
- The packaged app installer should match the CLI mental model as closely as possible.
- If no saved config exists, install should feel safe and dormant, not like a half-configured agent is already live.
- Messaging should clearly say setup is not finished yet and background collection is not active until the saved config is present / reloaded.
- App and CLI install paths should give materially the same next-step guidance.

#### [x] L17 — Shell-script uninstall messaging now matches the calmer CLI uninstall reassurance
**Why it matters:** The CLI uninstall path feels polished and safe: it says background collection stopped and explicitly reassures the user that config and logs were kept. The shell uninstall path is technically fine but emotionally harsher: `Uninstalled LaunchAgent` / `Removed plist` with no reassurance. That makes uninstall feel more destructive than it really is.

**Exact repro**
1. Open `scripts/uninstall-macos-launch-agent.sh`.
2. Observe the only success output:
   - `Uninstalled LaunchAgent: $PLIST_ID`
   - `Removed plist: $PLIST_PATH`
3. Compare with `bin/idlewatch-agent.js uninstall-agent`, which says:
   - `✅ LaunchAgent removed — background collection stopped.`
   - `Your config and logs were kept in ~/.idlewatch`
   - `Re-enable: ...`
4. Note that both paths remove the same background startup mechanism, but only one explains retention and recovery.

**Acceptance criteria**
- Uninstall copy should explicitly say this stops background startup only.
- It should reassure the user that saved config and local logs are preserved.
- It should include a clean re-enable hint, consistent with the install path in use.
- App-script uninstall should feel as safe and reversible as the CLI uninstall path.

### What shipped
- `scripts/install-macos-launch-agent.sh` now writes a dormant plist when no saved config exists:
  - `RunAtLoad=false`
  - `KeepAlive=false`
  - `Disabled=true`
- The no-config installer path now keeps `launchctl bootstrap/enable` skipped until saved setup exists.
- No-config copy now says setup is not finished yet and background collection stays off for now, then points to `quickstart` followed by re-running install.
- `scripts/uninstall-macos-launch-agent.sh` now says background collection stopped, reassures that config/logs were kept, and gives a clean re-enable hint.

### Acceptance notes
- Device-name persistence across reconfigure still looks intentional and stable.
- Metric-toggle persistence still looks clean: selected targets are rewritten once into saved config and reloaded on next start.
- `npx` vs durable-install guidance in README/CLI is mostly in good shape now.
- No auth, ingest, or packaging redesign is recommended from this cycle.

### Exact repro steps used in this pass
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. Review `README.md` install / quickstart / background sections.
3. Review `bin/idlewatch-agent.js` help, setup-completion, `status`, `install-agent`, `uninstall-agent`, and `--test-publish` copy.
4. Review `src/enrollment.js` for saved device name / device ID / metric selection persistence.
5. Review `scripts/install-macos-launch-agent.sh` for no-config install behavior and success copy.
6. Review `scripts/uninstall-macos-launch-agent.sh` for uninstall retention / recovery messaging.
7. Cross-check app-script behavior against the CLI LaunchAgent flow in `bin/idlewatch-agent.js`.

### Notes
- The cron payload path was stale again; the active repo/docs available for this pass were under `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.

---

## Cycle R105 Status: CLOSED

This pass stayed intentionally narrow: one tiny status follow-up fix only, with no setup-flow reshaping, no LaunchAgent behavior changes, and no telemetry-path changes.

### Outcome
- Shipped one small, low-risk status polish improvement.
- `status` from an `npx`-like run now stays honest when a durable LaunchAgent is already present:
  - if background mode is already installed but not loaded, it now says `Re-enable: idlewatch install-agent`
  - if background mode is already loaded, it now says `Background: already enabled via the durable install`
  - only the truly-not-installed path still says:
    - `Install once: npm install -g idlewatch`
    - `Then enable: idlewatch install-agent`
- No auth, ingest, telemetry, or packaging redesign was touched.

### R105 spot-check coverage
- `npx`-like `status` with saved config and no durable background install
- `npx`-like `status` with saved config and a durable LaunchAgent already installed but not loaded
- `node --test test/openclaw-env.test.mjs`
- `npm run validate:onboarding --silent`

### Prioritized findings

#### [x] L16 — `npx` status no longer tells users to install again when the durable background agent already exists
**Why it matters:** This was a tiny but real trust seam in a place cautious users check often. After a durable install already existed, `status` from an `npx` invocation still repeated the generic `Install once` guidance instead of acknowledging the actual saved-config/background state.

**What shipped**
- `status` now reuses the real LaunchAgent state before picking the `npx` next-step hint.
- Installed-but-not-loaded now shows `Re-enable: idlewatch install-agent`.
- Already-loaded now shows `Background: already enabled via the durable install`.
- Fresh `npx` setups still keep the calmer durable-install guidance unchanged.

### Acceptance notes
- `npx` foreground guidance still stays on `npx idlewatch run` / `npx idlewatch configure`.
- Durable background guidance still points to `idlewatch install-agent`, never `npx idlewatch install-agent`.
- The working telemetry path remains untouched.

---

## Cycle R104 Status: CLOSED

This pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, LaunchAgent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install-path clarity.

### Outcome
- No new end-user polish regressions were worth opening from this cycle.
- The current CLI still feels calm in the seams most likely to get noisy: first-run status, install-before-setup, already-installed re-enable messaging, uninstall retention messaging, device rename persistence, metric toggle persistence, and `npx` vs durable-install guidance.
- The previously polished `npx` reconfigure path still holds up when a background agent was installed earlier: it keeps foreground usage on `npx`, points background refresh back to the durable install, and clearly says the `npx` run only saved config.

### R104 spot-check coverage
- `node bin/idlewatch-agent.js install-agent --help`
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status` with LaunchAgent installed but not loaded
- `uninstall-agent` messaging
- `configure --no-tui` device rename + metric toggle persistence
- `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+4p'`
- `npx`-like `install-agent --help`
- `npx`-like `quickstart --no-tui` in a clean HOME
- `npx`-like `status`
- `npx`-like `install-agent` refusal
- `npx`-like `quickstart --no-tui` after pre-installing the LaunchAgent
- `npx`-like `configure --no-tui` after pre-installing the LaunchAgent
- `npm run validate:onboarding --silent`

### Prioritized findings
- None. No confusing, verbose, repetitive, visually noisy, or unnecessarily technical user-facing issues were worth opening from this cycle.

### Acceptance notes
- First-run `status` remains light: default metrics lead, OpenClaw extras stay secondary.
- Install-before-setup still keeps the right mental model: background install can happen early, but collection waits for saved setup.
- Setup and reconfigure completion still correctly distinguish first-time background enable from already-installed-needs-refresh.
- Device rename still preserves the original device ID and local log path while updating the visible device name.
- Metric selection changes still persist cleanly into saved config and next `status` output.
- LaunchAgent uninstall messaging remains clear, safe, and confirms config/log retention.
- `--test-publish` remains present and discoverable.
- `npx` guidance still keeps foreground trial usage on `npx` while pointing background mode to the durable global install path.

### Exact repro commands used
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. `TMPHOME2=$(mktemp -d)`
4. `TMPHOME3=$(mktemp -d)`
5. `FAKEBIN=$(mktemp -d)`
6. Create fake `launchctl` shim that leaves the agent not loaded while allowing install/uninstall commands to succeed:
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
7. `node bin/idlewatch-agent.js install-agent --help`
8. `HOME="$TMPHOME" node bin/idlewatch-agent.js status`
9. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent`
10. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
11. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
12. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent`
13. `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+4p'`
14. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='Renamed QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
15. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
16. `npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent --help`
17. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
18. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js status`
19. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME3" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent`
20. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" node bin/idlewatch-agent.js install-agent >/dev/null`
21. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Reconfig Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
22. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Reconfig Box 2' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
23. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" node bin/idlewatch-agent.js status`
24. `npm run validate:onboarding --silent`

### Notes
- The cron payload path was stale again; the active repo/docs for this pass were under `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- No auth, ingest, or packaging redesign is recommended from this cycle.

---

## Cycle R103 Status: CLOSED

This pass stayed intentionally narrow: one tiny `npx` setup/reconfigure completion copy consistency fix only, with no saved-config behavior changes, no LaunchAgent behavior changes, and no telemetry-path changes.

### Outcome
- Shipped one small, low-risk setup copy polish improvement.
- `npx` `quickstart` / `configure` completion now uses the same calmer two-line durable-install shape already used elsewhere:
  - `Install once: npm install -g idlewatch`
  - `Then enable: idlewatch install-agent`
- No auth, ingest, telemetry, or packaging redesign was touched.

### R103 spot-check coverage
- `npx`-like `quickstart --no-tui` in a clean HOME
- `npx`-like `configure --no-tui`
- `node --test test/openclaw-env.test.mjs`

### Prioritized findings

#### [x] L15 — `npx` setup/reconfigure completion now matches the calmer durable-install wording used elsewhere
**Why it matters:** The product behavior was already right, but this one completion path still used an older sentence-style hint instead of the cleaner two-step pattern already used by help and status. Tightening that seam makes setup/reconfigure feel more consistent and easier to scan.

**What shipped**
- Reworded `npx` quickstart/configure background follow-up from:
  - `Install IdleWatch once, then run idlewatch install-agent`
  - `npm install -g idlewatch`
- To:
  - `Install once: npm install -g idlewatch`
  - `Then enable: idlewatch install-agent`
- Saved-config behavior and background semantics remain unchanged.

### Acceptance notes
- Foreground `npx` usage still points to `npx idlewatch run`.
- Background guidance still points to the durable install path, not `npx idlewatch install-agent`.
- The working telemetry path remains untouched.

---

## Cycle R102 Status: CLOSED

This pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, LaunchAgent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install-path clarity.

### Outcome
- No new end-user polish regressions were worth opening from this cycle.
- The current CLI still feels calm in the specific seams most likely to get noisy: first-run status, install-before-setup, saved-config refresh wording, uninstall retention messaging, device identity persistence, metric toggle persistence, and `npx` vs durable-install guidance.
- The previously tightened `npx` `install-agent --help` path still holds up and now matches the real refusal behavior cleanly.

### R102 spot-check coverage
- `node bin/idlewatch-agent.js install-agent --help`
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status` with LaunchAgent installed but not loaded
- `uninstall-agent` messaging
- `configure --no-tui` device rename + metric toggle persistence
- `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+4p'`
- `npx`-like `install-agent --help`
- `npx`-like `quickstart --no-tui` in a clean HOME
- `npx`-like `status`
- `npx`-like `install-agent` refusal
- `npm run validate:onboarding --silent`

### Prioritized findings
- None. No confusing, verbose, repetitive, visually noisy, or unnecessarily technical user-facing issues were worth opening from this cycle.

### Acceptance notes
- First-run `status` remains light: default metrics lead, OpenClaw extras stay secondary.
- Install-before-setup still keeps the right mental model: background install can happen early, but collection waits for saved setup.
- Setup completion still correctly distinguishes first-time background enable from already-installed-needs-refresh.
- Device rename still preserves the original device ID and local log path while updating the visible device name.
- Metric selection changes still persist cleanly into saved config and next `status` output.
- LaunchAgent uninstall messaging remains clear, safe, and confirms config/log retention.
- `--test-publish` remains present and discoverable.
- `npx` guidance still keeps foreground trial usage on `npx` while pointing background mode to the durable global install path.

### Exact repro commands used
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. `TMPHOME=$(mktemp -d)`
3. `TMPHOME2=$(mktemp -d)`
4. `TMPHOME3=$(mktemp -d)`
5. `FAKEBIN=$(mktemp -d)`
6. Create fake `launchctl` shim that leaves the agent not loaded while allowing install/uninstall commands to succeed:
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
7. `node bin/idlewatch-agent.js install-agent --help`
8. `HOME="$TMPHOME" node bin/idlewatch-agent.js status`
9. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent`
10. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
11. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
12. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent`
13. `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+4p'`
14. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='Renamed QA Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory,gpu' node bin/idlewatch-agent.js configure --no-tui`
15. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME" node bin/idlewatch-agent.js status`
16. `npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent --help`
17. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
18. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js status`
19. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME3" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent`
20. `npm run validate:onboarding --silent`

### Notes
- The cron payload path was stale again; the active repo/docs for this pass were under `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- No auth, ingest, or packaging redesign is recommended from this cycle.

---

## Cycle R101 Status: CLOSED

This pass stayed intentionally narrow: one tiny `npx` help-path polish only, with no setup-flow reshaping, no saved-config behavior changes, and no telemetry-path changes.

### Outcome
- Shipped one small, low-risk install/help polish improvement.
- `install-agent --help` in an `npx`-like context no longer headlines `npx idlewatch install-agent` as if it were a usable background command.
- The help path now goes straight to the durable-install shape:
  - `Background mode needs a durable install.`
  - `Install once: npm install -g idlewatch`
  - `Then enable: idlewatch install-agent`
- No auth, ingest, telemetry, or packaging redesign was touched.

### R101 spot-check coverage
- `node bin/idlewatch-agent.js install-agent --help`
- `npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent --help`
- `npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent`
- `node --test test/openclaw-env.test.mjs` (47/47 passing)

### Prioritized findings

#### [x] L14 — `npx` help for `install-agent` no longer presents the wrong command as the usage line
**Why it matters:** The real runtime behavior was already right, but help still briefly implied the opposite. Tightening that tiny contradiction makes the setup story feel cleaner and more trustworthy.

**What shipped**
- `install-agent --help` now detects `npx`/`npm exec` context and shows durable-install guidance directly instead of a misleading `Usage: npx idlewatch install-agent` block.
- The actual install semantics remain unchanged: one-off foreground runs still work via `npx`, while background install still requires a durable install.

### Acceptance notes
- `npx` help no longer presents `npx idlewatch install-agent` as the main usage line.
- The refusal path remains unchanged and still points to the same durable-install commands.
- The working telemetry path remains untouched.

---

## Cycle R100 Status: CLOSED

This pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, LaunchAgent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install-path clarity.

### Outcome
- Most of the targeted polish seams still hold up well.
- One small but real clarity issue remained in the `npx` background-install help path.
- No auth, ingest, telemetry, or packaging redesign is recommended from this cycle.

### R100 spot-check coverage
- `node bin/idlewatch-agent.js install-agent --help`
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status` with LaunchAgent installed but not loaded
- `uninstall-agent` messaging
- `configure --no-tui` device rename + metric toggle persistence
- `node bin/idlewatch-agent.js --help | sed -n '/test-publish/,+4p'`
- `npx`-like `install-agent --help`
- `npx`-like `quickstart --no-tui` in a clean HOME
- `npx`-like `status`
- `npx`-like `install-agent` refusal
- `npm run validate:onboarding --silent`

### Prioritized findings

#### [ ] L14 — `npx` help for `install-agent` still presents the wrong command as the usage line
**Why it matters:** The real runtime behavior is already correct: background install is a durable-install feature, and `npx idlewatch install-agent` is refused. But the `--help` screen for that same path still headlines the invalid command as if it were usable. That tiny contradiction makes the setup story feel less crisp than the actual product behavior.

**Exact repro**
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. Run:
   ```bash
   npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent --help
   ```
3. Compare with the real refusal path:
   ```bash
   npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent
   ```

**Observed**
- Help currently starts with:
  - `npx idlewatch install-agent — Install background LaunchAgent (macOS)`
  - `Usage:  npx idlewatch install-agent`
- But the actual command immediately refuses that route and says:
  - `Background install needs a durable IdleWatch install first.`
  - `Install once:  npm install -g idlewatch`
  - `Then enable:   idlewatch install-agent`

**Why this feels off**
- The product behavior is neat; the help framing is the noisy part.
- A cautious user checking help first gets shown the exact command they should not actually use.
- This is a small trust seam in the npm/npx install-path guidance, which is one of the main polish targets for this lane.

**Acceptance criteria**
- When `install-agent --help` is invoked from an `npx`-like context, do not present `npx idlewatch install-agent` as the main usage line.
- Prefer a calmer shape like:
  - `Background mode needs a durable install.`
  - `Install once: npm install -g idlewatch`
  - `Then enable: idlewatch install-agent`
- Keep one-off foreground guidance on `npx` unchanged.
- Do not change install semantics; this is copy/help-shape only.

### Acceptance notes
- First-run `status` still feels calm and minimal.
- Install-before-setup still uses the right mental model.
- Setup completion still distinguishes already-installed-needs-refresh vs not-enabled-yet.
- Device rename still preserves the original device ID and log path while updating the visible device name.
- Metric selection changes still persist cleanly into saved config and next `status` output.
- LaunchAgent uninstall messaging remains clear and safe.
- `--test-publish` remains present and discoverable.
- The active repo/docs for this pass were again under `~/.openclaw/workspace.bak/idlewatch-skill`, not the stale path in the cron payload.

---

## Cycle R99 Status: CLOSED

This pass stayed intentionally narrow: one tiny install-before-setup copy polish only, with no setup-flow reshaping, no saved-config behavior changes, and no telemetry-path changes.

### Outcome
- Shipped one small, low-risk install-path polish improvement.
- The `install-agent` success path without saved setup now reads like a cleaner three-step flow:
  - `Save setup`
  - `Run now`
  - `Then enable`
- The saved config path is still shown, just demoted behind the action steps.
- No auth, ingest, telemetry, packaging, or LaunchAgent behavior was touched.

### R99 spot-check coverage
- `node bin/idlewatch-agent.js install-agent` in a clean HOME with no saved setup
- `node --test test/openclaw-env.test.mjs` (46/46 passing)
- `npm run validate:onboarding --silent`

### Prioritized findings

#### [x] L13 — Install-before-setup success copy now reads like a calmer next-step flow
**Why it matters:** This path already behaved correctly, but the message shape still felt slightly more narrated than guided. In a product that is otherwise getting nicely minimal, this was one of the remaining tiny seams where the right answer took an extra beat to scan.

**What shipped**
- Reworded the install-without-saved-setup success block from a looser sequence:
  - `Next`
  - `Or run now`
  - `When ready`
- To a cleaner action-first flow:
  - `Save setup`
  - `Run now`
  - `Then enable`
- Kept the saved config path visible, but moved it below the main action steps.

### Acceptance notes
- Install-before-setup still keeps background collection off until setup is saved.
- The saved config path is still visible for users who want it.
- Telemetry behavior, LaunchAgent behavior, and the working telemetry path remain unchanged.

---

## Cycle R98 Status: CLOSED

This pass stayed intentionally narrow: one tiny LaunchAgent installer recovery hint only, with no setup-flow reshaping, no saved-config behavior changes, and no telemetry-path changes.

### Outcome
- Shipped one small, low-risk install-path polish improvement.
- The missing-app failure path now mentions both override routes:
  - `IDLEWATCH_APP_PATH` for the app bundle
  - `IDLEWATCH_APP_BIN` for the launcher binary
- If `IDLEWATCH_APP_PATH` was already set, the failure output now echoes that exact app-bundle path too, so recovery is more obvious.
- No auth, ingest, telemetry, or packaging behavior was touched.

### R98 spot-check coverage
- `./scripts/install-macos-launch-agent.sh` with neither standard app location present
- `./scripts/install-macos-launch-agent.sh` with a wrong custom `IDLEWATCH_APP_PATH`

### Prioritized findings

#### [x] L12 — Missing-app installer hint now names the calmer override path first
**Why it matters:** The installer already supports both `IDLEWATCH_APP_PATH` and `IDLEWATCH_APP_BIN`, but the failure path only suggested the binary override. That works, but it pushes users toward the fussier knob first when most non-standard installs are really just “my app lives in a different folder.”

**What shipped**
- Reworded the missing-app failure guidance so it now says:
  - set `IDLEWATCH_APP_PATH` to the app bundle, or
  - set `IDLEWATCH_APP_BIN` to the launcher binary
- If `IDLEWATCH_APP_PATH` is already set, the failure output now prints that bundle path before the derived binary path.

### Acceptance notes
- Recovery is faster for non-standard app installs.
- Standard `/Applications` and `~/Applications` auto-detection remains unchanged.
- Saved config behavior, LaunchAgent behavior, and the working telemetry path remain unchanged.

---

## Cycle R97 Status: CLOSED

This pass stayed intentionally narrow: setup/install clarity, config persistence/reload behavior, LaunchAgent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install-path clarity.

### Outcome
- Shipped one small install-path polish improvement.
- The LaunchAgent installer now auto-detects IdleWatch in both standard Mac app locations:
  - `/Applications/IdleWatch.app`
  - `~/Applications/IdleWatch.app`
- The missing-app failure message now points to those same locations before suggesting an override.
- No auth, ingest, telemetry, or major packaging redesign was touched.

### R97 spot-check coverage
- `./scripts/install-macos-launch-agent.sh` on a Mac with IdleWatch installed at `~/Applications/IdleWatch.app`
- Current installed app location vs script default path
- Existing help/status wording for background setup mental model

### Prioritized findings

#### [x] M2 — LaunchAgent installer is too rigid about the app path
**Why it matters:** This is exactly the kind of small setup seam that makes a polished product feel fiddly. On a normal single-user Mac, dragging the app into `~/Applications` is common and reasonable. The installer currently fails as if IdleWatch is missing, even when the app is already installed and ready.

**Exact repro**
1. Install IdleWatch at `~/Applications/IdleWatch.app`.
2. Ensure `/Applications/IdleWatch.app` does not exist.
3. Run:
   ```bash
   cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill
   ./scripts/install-macos-launch-agent.sh
   ```

**Observed**
- Script exits with:
  - `IdleWatch launcher executable not found or not executable: /Applications/IdleWatch.app/Contents/MacOS/IdleWatch`
  - `Set IDLEWATCH_APP_BIN to the correct binary path before running this script.`
- On this machine, the app actually exists at:
  - `/Users/luismantilla/Applications/IdleWatch.app`

**Why this feels off**
- The failure message is technically correct but product-wise a bit brittle.
- It makes a valid install location feel like an error state.
- It also pushes the user into path plumbing during what should be the calmest part of setup.

**What shipped**
- The installer now auto-detects both standard app locations before failing:
  - `/Applications/IdleWatch.app`
  - `~/Applications/IdleWatch.app`
- Reusing the default LaunchAgent label is now allowed for either standard app location, so a normal single-user install in `~/Applications` no longer looks like a side-by-side custom path.
- If neither app location exists, the failure message now mentions both supported locations first and only then suggests `IDLEWATCH_APP_BIN` for non-standard installs.

### Acceptance notes
- Setup stays low-friction on Macs where IdleWatch lives in the user Applications folder.
- The telemetry path was left untouched.
- This pass still did not surface a reason to reopen device identity persistence, metric toggle persistence, or test-publish messaging.
- The cron payload path was stale again; the active repo/docs for this pass were under `~/.openclaw/workspace.bak/idlewatch-skill`.

---

## Cycle R96 Status: CLOSED

This pass stayed intentionally narrow: one setup validation seam only, with no setup-flow reshaping, no background behavior changes, and no telemetry changes.

### Outcome
- Shipped one tiny, low-risk validation polish improvement.
- Invalid non-interactive enrollment mode errors now name the accepted values instead of stopping at the invalid value alone.
- Telemetry behavior, LaunchAgent behavior, auth/ingest, and packaging were left untouched.

### R96 spot-check coverage
- Non-interactive `quickstart --no-tui` with invalid `IDLEWATCH_ENROLL_MODE`
- `npm run validate:onboarding --silent`
- `npm run test:unit --silent` (145/145 passing)

### Prioritized findings

#### [x] L11 — Invalid enrollment mode now tells you the valid choices
**Why it matters:** This only shows up in scripted or env-driven setup, but when it does, recovery should be immediate. Saying the bad value without naming the accepted ones adds one unnecessary lookup step.

**What shipped**
- Reworded invalid mode errors from:
  - `Invalid enrollment mode: cloudy`
- To:
  - `Invalid enrollment mode: cloudy. Choose "production" (cloud) or "local".`
- Saved config behavior remains unchanged: setup still fails fast and does not write config when the mode is invalid.

### Acceptance notes
- Error recovery is faster in non-interactive setup flows.
- No new options, no behavior changes, no telemetry-path changes.
- The rest of the installer/setup wording remains unchanged.

---

## Cycle R95 Status: CLOSED

This pass stayed intentionally narrow: setup wizard quality, config persistence/reload behavior, LaunchAgent install/uninstall behavior, test-publish messaging, device identity persistence, metric toggle persistence, and npm/npx install-path clarity.

### Outcome
- No new end-user polish regressions were worth opening from this cycle.
- The current CLI still feels neat in the seams that usually get noisy: first-run status, install-before-setup, saved-config refresh language, uninstall retention messaging, device rename persistence, metric toggle persistence, and `npx` vs durable-install guidance.
- The active repo/docs for this pass were still under `~/.openclaw/workspace.bak/idlewatch-skill`, not the older path mentioned in the cron payload.

### R95 spot-check coverage
- `install-agent --help`
- First-run `status` in a clean HOME
- `install-agent` before setup in a clean HOME
- `quickstart --no-tui` after pre-installing the LaunchAgent
- Post-setup `status` with LaunchAgent installed but not loaded
- `uninstall-agent` messaging
- `configure --no-tui` device rename + metric toggle persistence
- `--test-publish` help discoverability
- `npx`-like `install-agent --help`
- `npx`-like `quickstart --no-tui` in a clean HOME
- `npx`-like `status` after setup
- `npx`-like quickstart after pre-installing the LaunchAgent
- `npm run validate:onboarding --silent`

### Prioritized findings
- None. No confusing, verbose, repetitive, visually noisy, or unnecessarily technical user-facing issues were worth opening from this cycle.

### Acceptance notes
- First-run `status` stays calm: default metrics are primary and OpenClaw extras remain secondary.
- Install-before-setup still uses the right mental model: the LaunchAgent can be installed early, but background collection waits for saved config.
- Setup completion still distinguishes first-time background enable from already-installed-but-needs-refresh.
- Device rename still preserves the original device ID and local log path while updating the visible device name.
- Metric selection changes still persist cleanly into saved config and the next `status` output.
- LaunchAgent uninstall messaging remains clear and confirms config/log retention.
- `--test-publish` remains present and discoverable.
- `npx` guidance still keeps foreground trial usage on `npx` while pointing background mode to the durable global install path:
  - `npm install -g idlewatch`
  - `idlewatch install-agent`

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
14. `npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js install-agent --help`
15. `TMPHOME2=$(mktemp -d)`
16. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
17. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME2" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec node bin/idlewatch-agent.js status`
18. `TMPHOME3=$(mktemp -d)`
19. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME3" node bin/idlewatch-agent.js install-agent >/dev/null`
20. `PATH="$FAKEBIN:$PATH" HOME="$TMPHOME3" npm_execpath=/usr/local/lib/node_modules/npm/bin/npx-cli.js npm_command=exec IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='NPX Reconfig Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
21. `npm run validate:onboarding --silent`

### Notes
- The cron payload still points at `~/.openclaw/workspace/idlewatch-skill`, but the active repo for this pass was `~/.openclaw/workspace.bak/idlewatch-skill`.
- Working tree still contains an unrelated untracked artifact: `idlewatch-0.2.0.tgz`.
- No auth, ingest, or packaging redesign is recommended from this cycle.

## Cycle R94 Status: CLOSED

This pass stayed intentionally narrow: improve one validation seam and one help-text seam without changing setup flow shape, background behavior, or telemetry.

### Outcome
- Shipped two tiny, low-risk polish improvements.
- Invalid non-interactive metric selections now say which metric names were unknown instead of only saying nothing valid was selected.
- `install-agent --help` now uses a slightly calmer `npx` lead-in while keeping the same durable-install guidance.
- Telemetry behavior, LaunchAgent behavior, auth/ingest, and packaging were left untouched.

### R94 spot-check coverage
- `install-agent --help`
- Non-interactive `quickstart --no-tui` with fully invalid `IDLEWATCH_ENROLL_MONITOR_TARGETS`
- `npm run validate:onboarding --silent`
- `npm run test:unit --silent` (144/144 passing)

### Prioritized findings

#### [x] L9 — Invalid metric selection now names the unknown entries
**Why it matters:** Setup validation is already strict, but the old error made typo recovery slower than it needed to be. Naming the bad entries is a tiny but real friction reduction in scripted or copy-pasted setup flows.

**What shipped**
- Fully invalid metric selections now include the unknown names, e.g.:
  - `No valid metrics were selected. Unknown: wat, not-real. Choose one or more of: ...`
- Saved config behavior remains unchanged: setup still fails fast and does not write config when metric selection is invalid.

#### [x] L10 — `install-agent --help` trims one more bit of wording around the `npx` path
**Why it matters:** This is small, but help output is part of first-run confidence. The durable-install guidance was already correct; the intro line just read a little more explanatory than necessary.

**What shipped**
- Reworded:
  - `For one-off npx/npm exec runs:`
- To:
  - `If you're using npx/npm exec:`
- Durable next steps stay the same:
  - `Install once: npm install -g idlewatch`
  - `Then enable: idlewatch install-agent`

### Acceptance notes
- Invalid metric validation is clearer without adding more steps or relaxing validation.
- `install-agent --help` remains durable-install oriented and still avoids suggesting `npx idlewatch install-agent`.
- The working telemetry path remains untouched.

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
