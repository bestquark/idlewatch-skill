# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R77 (polish-focused verification pass)

## Status: OPEN - small polish gaps found

These are not architecture problems. They are user-facing polish issues that make setup/background behavior feel more confusing than it needs to.

---

## H1. Config reload behavior is still unclear / effectively undocumented
**Priority:** High

**Why it matters:** The repo claims config reload behavior is predictable, but the shipped CLI surface does not give users a clear reload path, and the current process model appears startup-loaded rather than live-reloaded.

**Repro:**
1. Open `bin/idlewatch-agent.js`.
2. Confirm persisted config is loaded once at startup via `loadPersistedEnvIntoProcess()` near line 316.
3. Confirm a `reloadRequested` flag exists near line 670.
4. Confirm there is no implemented handler/help text for `reloadRequested` and no user-facing `reload` command in `printHelp()` / subcommand help.
5. Search docs: `grep -RIn "reload" README.md docs src test bin`.

**Observed:**
- `reloadRequested` is parsed but unused.
- Help/docs do not tell a user how edited config becomes active for an already-running background agent.
- Current QA plan/log claim reload is verified, which overstates the user experience.

**Acceptance criteria:**
- Document one clear, minimal rule for config changes: either **"changes apply on next start"** or a real reload command exists.
- If restart is required, `configure` / `status` / launch-agent docs should say exactly how to apply changes to a running agent.
- Remove or implement dead `reload` affordance so the CLI does not imply hidden behavior.

---

## M1. “Test publish” flow is claimed in QA docs, but no obvious `--test-publish` CLI exists
**Priority:** Medium

**Why it matters:** The polish plan says `idlewatch --test-publish` is available, but the actual CLI/help surface points users to `--once`. That mismatch is small but trust-eroding.

**Repro:**
1. Open `docs/qa/idlewatch-cron-polish-plan.md`.
2. Note the claim: `CLI \`idlewatch --test-publish\` available`.
3. Search CLI source: `grep -n "test-publish" bin/idlewatch-agent.js src/enrollment.js README.md docs -R`.
4. Review `printHelp()` and subcommand help in `bin/idlewatch-agent.js`.

**Observed:**
- QA docs claim a `--test-publish` path.
- CLI/help do not expose `--test-publish`.
- Setup completion/error messaging instead tells users to run `idlewatch --once`.

**Acceptance criteria:**
- Either add a small alias (`--test-publish`) that maps to the existing one-shot publish check,
- or remove the claim from polish docs and standardize all user-facing messaging on `idlewatch --once`.
- README/help/setup success text should use one term consistently.

---

## M2. Launch-agent install script gives conflicting next steps when no config exists
**Priority:** Medium

**Why it matters:** For packaged users, the install flow should feel clean and obvious. Right now the script bootstraps the LaunchAgent, then tells the user to “run setup first” and “enable the agent from System Settings → Login Items,” which is visually noisy and conceptually mixed up.

**Repro:**
1. Open `scripts/install-macos-launch-agent.sh`.
2. Follow the flow after `launchctl bootstrap` / `launchctl enable`.
3. Inspect the branch where `~/.idlewatch/idlewatch.env` does not exist.

**Observed:**
- The script installs/enables the LaunchAgent first.
- Then, in the no-config branch, it says:
  - `Run setup first ...`
  - `then enable the agent from System Settings → Users & Groups → Login Items.`
- That is confusing because the agent has already been installed via `launchctl`; “Login Items” sounds like a different mechanism.
- For end users, this reads like duplicate setup systems or an incomplete install.

**Acceptance criteria:**
- Keep one simple story: either install only after config exists, or clearly say the agent is already installed but needs config before it can do useful work.
- Remove the Login Items wording from the LaunchAgent script path unless it is truly required.
- Packaged-user guidance should favor one exact next command/path, not multiple overlapping mechanisms.

---

## L1. Install path messaging is still slightly split between global CLI, npx, and packaged app
**Priority:** Low

**Why it matters:** The project is close, but first-run messaging still makes users translate between `idlewatch`, `npx idlewatch`, and app-bundled script paths on their own.

**Repro:**
1. Read `README.md` install/quickstart sections.
2. Read `scripts/postinstall.mjs`.
3. Read `docs/onboarding-external.md` and `docs/packaging/macos-launch-agent.md`.

**Observed:**
- README correctly shows both `npm install -g idlewatch` and `npx idlewatch quickstart`.
- Postinstall always prints `Run "idlewatch quickstart" to set up this device.`
- Packaged docs switch to long app-bundled script paths.
- The repo does not present a single crisp sentence like: **global install → `idlewatch ...`; no install → `npx idlewatch ...`; packaged app → use the app’s bundled command/script path**.

**Acceptance criteria:**
- Keep the setup story minimal and explicit across README/postinstall/packaged docs.
- Every surface should make it obvious which command form applies to that install mode.
- Avoid making packaged users guess whether a global `idlewatch` command exists.

---

## Summary

**Most important fixes:**
1. Be honest and explicit about config reload/apply behavior.
2. Reconcile `--test-publish` docs vs actual CLI.
3. Simplify no-config launch-agent messaging so it does not mention conflicting startup mechanisms.

**Not recommended in this lane:** auth redesign, ingest changes, packaging redesign.
