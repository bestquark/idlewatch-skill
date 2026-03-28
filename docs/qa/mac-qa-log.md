# IdleWatch Installer QA polish log

## Cycle R777 Status: COMPLETE ✅

Fresh scoped installer/CLI polish pass reran the exact lane from `idlewatch-cron-polish-plan.md` and did not surface another small end-user issue worth shipping.

### Priority call
No new polish issue cleared the bar this cycle. The current product still feels calm and low-friction across the setup and recovery surfaces that matter most in this lane: help still leads with plain `quickstart`, install-before-setup remains truthful and low-noise, saved setup and reconfigure still keep device identity continuity and metric-toggle persistence explicit inline, running-background flows still teach the same predictable `Apply saved config` mental model, local-only `--test-publish` flow that stays intentionally lightweight, consistent copy across main CLI, global npm postinstall (`idlewatch install-agent`), and standalone macOS scripts.

The now-working telemetry path remains untouched; all polish stayed scoped to UX/copy surfaces.

### Verification evidence
- `[x] cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
- `[x] Fresh normal help + install-before-setup + saved-setup + local test-publish spot checks with a stubbed non-running `launchctl`:`
  - `node bin/idlewatch-agent.js --help`
  - `node bin/idlewatch-agent.js install-agent --help`
  - `HOME="$TMPHOME1" PATH="$FAKEBIN:$PATH" node bin/idlewatch-agent.js install-agent`
  - `HOME="$TMPHOME1" PATH="$FAKEBIN:$PATH" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Polish Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
  - `HOME="$TMPHOME1" PATH="$FAKEBIN:$PATH" node bin/idlewatch-agent.js status`
  - `HOME="$TMPHOME1" PATH="$FAKEBIN:$PATH" node bin/idlewatch-agent.js --test-publish`
- `[x] Fresh running-background reconfigure/status spot checks with a stubbed running `launchctl`:`
  - `HOME="$TMPHOME2" PATH="$FAKEBIN_RUNNING:$PATH" node bin/idlewatch-agent.js install-agent`
  - `HOME="$TMPHOME2" PATH="$FAKEBIN_RUNNING:$PATH" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Running Box' IDLEWATCH_ENROLL_MONITOR_TARGETS='cpu,memory' node bin/idlewatch-agent.js quickstart --no-tui`
  - `HOME="$TMPHOME2" PATH="$FAKEBIN_RUNNING:$PATH" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local IDLEWATCH_ENROLL_DEVICE_NAME='QA Running Box Renamed' IDLEWATCH_ENROLL_MONITOR_TARGETS='memory' node bin/idlewatch-agent.js configure --no-tui`
  - `HOME="$TMPHOME2" PATH="$FAKEBIN_RUNNING:$PATH" node bin/idlewatch-agent.js status`
- `[x] Fresh true-`npx` help + status spot checks with explicit npm-exec env vars:`
  - `HOME="$TMPHOME3" npm_execpath=/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js npm_command=exec npm_lifecycle_event=npx npm_config_user_agent='npm/11.9.0 node/v25.6.1 darwin arm64 workspaces/false' node bin/idlewatch-agent.js --help`
  - `HOME="$TMPHOME3" npm_execpath=/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js npm_command=exec npm_lifecycle_event=npx npm_config_user_agent='npm/11.9.0 node/v25.6.1 darwin arm64 workspaces/false' node bin/idlewatch-agent.js install-agent --help`
  - `HOME="$TMPHOME3" PATH="$FAKEBIN:$PATH" npm_execpath=/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js npm_command=exec npm_lifecycle_event=npx npm_config_user_agent='npm/11.9.0 node/v25.6.1 darwin arm64 workspaces/false' node bin/idlewatch-agent.js status`
- `[x] Fresh global npm-install + standalone macOS side-by-side install/uninstall spot checks:`
  - `npm_config_global=true node scripts/postinstall.mjs`
  - `HOME="$TMPHOME3" PATH="$FAKEBIN:/usr/bin:/bin:/opt/homebrew/bin:$PATH" IDLEWATCH_APP_PATH="$APP" IDLEWATCH_LAUNCH_AGENT_LABEL='com.idlewatch.agent.qa' bash scripts/install-macos-launch-agent.sh`
  - `HOME="$TMPHOME3" PATH="$FAKEBIN:/usr/bin:/bin:/opt/homebrew/bin:$PATH" IDLEWATCH_LAUNCH_AGENT_LABEL='com.idlewatch.agent.qa' bash scripts/uninstall-macos-launch-agent.sh`
- `[x] Observed in the same pass:`
  - top-level help still leads with `Get started:  idlewatch quickstart`, with `idlewatch quickstart --no-tui` one line below as the plain-text fallback
  - installed `install-agent --help` still stays setup-first and low-noise (`Turns on background mode on macOS with your saved setup.` / `If you've already finished setup, this works right away.`)
  - install-before-setup still says `✅ Background integration installed.` and keeps the honest `Setup isn't saved yet, so background mode stays off for now.` handoff
  - saved local `status` still keeps the settings and background next steps short and literal (`Change: idlewatch configure` / `Turn on background mode: idlewatch install-agent`)
  - running-background setup/reconfigure/status still say `Apply saved config:  re-run idlewatch install-agent to apply the saved config`
  - device identity continuity still stays explicit inline (`Device ID: ... kept from original setup for continuity`)
  - metric-toggle persistence still stays visible in `status`
  - local-only `--test-publish` still stays intentionally lightweight
  - true `npx` help/status still keep one-off commands literal while background mode stays on the explicit durable-install handoff
  - global npm postinstall still leads with `idlewatch quickstart`, with `idlewatch quickstart --no-tui` kept secondary as the fallback
  - standalone macOS custom-label install/uninstall still keep their follow-up commands literally runnable for that same label

### Prioritized findings
#### [x] P0 — no new product-facing installer/CLI polish issue found in scope after another fresh live pass
**Why this matters:** This lane is about reducing friction, not manufacturing churn. The current setup and recovery path already feels neat, minimal, and trustworthy across the exact surfaces this plan cares about, so the right move here was to verify the important paths and stop.

**Exact repro / verification path**
1. `cd /Users/luismantilla/.openclaw/workspace.bak/idlewatch-skill`
2. Create one fake `launchctl` shim that reports `print` as not running and one that reports it as already running; let both succeed for install/uninstall actions
3. Run the normal help, install-before-setup, saved-setup, running-background reconfigure/status, local-only `--test-publish`, true-`npx`, global postinstall, and standalone macOS side-by-side checks listed above
4. Observe that the user-facing copy remains literal, low-noise, and consistent across those flows

**Acceptance checks**
- Top-level help and setup/recovery surfaces continue to lead with plain `quickstart`, with `--no-tui` kept secondary as the fallback
- Install-before-setup remains truthful and low-noise
- Device IDs still persist through rename/reconfigure and stay visible inline where continuity matters
- Metric toggles still persist cleanly and show up clearly in saved-setup `status`
- Config reload/apply guidance remains predictable when background mode is already on
- Launch-agent install/uninstall behavior remains clear, reversible, and low-noise in both the main CLI and standalone macOS scripts
- Local-only `--test-publish` stays intentionally lightweight rather than growing into a second setup flow
- True-`npx` setup/status/help surfaces keep one-off-safe `npx idlewatch ...` commands while background mode stays on the explicit durable-install handoff
- Global npm-install handoff still leads with `idlewatch quickstart`, with `idlewatch quickstart --no-tui` kept secondary as the fallback
- Standalone macOS side-by-side custom-label install/uninstall flows keep their follow-up commands literally runnable for that same label
- No auth, ingest, packaging, or major launch-agent behavior changes were introduced in this verification-only pass

**Last updated:** Saturday, March 28th, 2026 — 12:30 PM (America/Toronto)
---
