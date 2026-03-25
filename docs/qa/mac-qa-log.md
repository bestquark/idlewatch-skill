# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R79 (installer/CLI polish follow-up)

## Status: CLOSED - setup-path polish shipped

The core installer/CLI flow is still good. This pass found two small-but-real UX mismatches, and both are now fixed with low-risk copy/path polish.

---

## Priority findings

### M1. `install-agent --help` still describes the old config-first story
**Priority:** Medium
**Status:** Fixed

**Why this matters:**
The command behavior is now pleasantly install-first: users can install the LaunchAgent before quickstart, then finish setup later. But the built-in help text still says the command "Uses the saved config from ~/.idlewatch/idlewatch.env," which reads like config is required up front. That's a tiny trust leak right at the moment the user asks for guidance.

**Exact repro:**
1. From the repo root, run:
   ```bash
   node bin/idlewatch-agent.js install-agent --help
   ```
2. Observe the help text says:
   ```text
   Creates a LaunchAgent plist and loads it so IdleWatch runs automatically
   in the background. Uses the saved config from ~/.idlewatch/idlewatch.env.
   ```
3. Compare that with the actual no-config behavior:
   ```bash
   HOME="$(mktemp -d)" node bin/idlewatch-agent.js install-agent
   ```
4. Observe the command now installs successfully even without saved config and prints the install-first / quickstart-later next steps.

**Acceptance criteria:**
- [x] `idlewatch install-agent --help` matches the real behavior.
- [x] Help text makes it clear saved config is optional on first install.
- [x] The short description stays simple and non-technical.
- [x] No behavior change required; docs/help copy only.

---

### M2. Setup follow-up commands assume a global `idlewatch` binary even in non-global flows
**Priority:** Medium
**Status:** Fixed

**Why this matters:**
Docs now do a decent job distinguishing global install vs `npx` vs packaged app. The runtime UX is less careful. Several success/error messages tell users to run `idlewatch ...` unconditionally, even when they arrived through `node bin/idlewatch-agent.js ...`, `npx idlewatch ...`, or app-bundled paths. That creates a low-grade "wait, which command am I actually supposed to use?" moment exactly where the product should feel frictionless.

**Exact repro:**
1. From a source checkout, run:
   ```bash
   HOME="$(mktemp -d)" node bin/idlewatch-agent.js install-agent
   ```
2. Observe the follow-up copy says:
   ```text
   Next:             idlewatch quickstart
   Then re-run:      idlewatch install-agent
   Check anytime:    idlewatch status
   ```
3. In the same source-checkout context, note that the command the user actually invoked was `node bin/idlewatch-agent.js ...`, not a guaranteed global `idlewatch` binary.
4. The packaged install script already handles this more gracefully by showing the app-bundled command path when `idlewatch` is not available on PATH.

**Acceptance criteria:**
- [x] User-facing next-step messages prefer the command path that matches the current install path.
- [x] Global installs can keep showing `idlewatch ...`.
- [x] Source / local / app-bundled flows should avoid implying a global binary exists when it may not.
- [x] Output remains short and calm — no big install-mode explainer blocks.

---

## Verified areas in this cycle
- `install-agent` still succeeds on a clean HOME with no saved config.
- `uninstall-agent` remains safe and non-destructive.
- `status` correctly shows `(no saved config)` and the LaunchAgent state after install-first setup.
- Docs continue to point new users to `idlewatch` / `npx idlewatch` rather than the old `idlewatch-skill` package name.
- `--test-publish` remains documented as an alias for `--once`.

## Summary
Nothing scary here — just two last-mile setup guidance mismatches. This cycle fixed both without changing the working telemetry path:
- `install-agent --help` now matches the install-first reality and says saved config is optional.
- `install-agent` follow-up commands now prefer the command path that matches how the user launched the CLI, so source-checkout flows no longer imply a global binary exists.

Validation:
- `node --test test/openclaw-env.test.mjs`
