# IdleWatch Installer QA Log 2026-03-25

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
