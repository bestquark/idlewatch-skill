# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R78 (installer/CLI polish verification pass)

## Status: CLOSED - high-priority setup mismatch fixed

Core flow still looks solid, and the remaining setup-path mismatch from this pass is now fixed.

---

## Priority findings

### H1. `idlewatch install-agent` no longer blocks on missing config; CLI now matches packaged install flow
**Priority:** High
**Status:** ✅ Fixed

**Why this matters:**
The packaged macOS install flow and docs now present a nice low-friction story:
- install the LaunchAgent first,
- run quickstart when ready,
- then re-run install once to restart with saved config.

But the main CLI command still says the opposite. That makes the same product feel inconsistent depending on whether the user arrived via npm/npx vs the packaged app.

**Exact repro:**
1. Use a clean HOME with no `~/.idlewatch/idlewatch.env` present.
2. Run:
   ```bash
   HOME="$(mktemp -d)" node bin/idlewatch-agent.js install-agent
   ```
3. Observe the command exits with:
   ```text
   No config found. Run idlewatch quickstart first.
   ```

**What changed:**
- `bin/idlewatch-agent.js` now installs/loads the LaunchAgent even when `~/.idlewatch/idlewatch.env` is missing.
- The CLI success output now mirrors the packaged script's intended story:
  - LaunchAgent installed
  - run `idlewatch quickstart`
  - re-run `idlewatch install-agent` after setup to restart with saved config
- Existing-config installs still stay concise and point users at `idlewatch status`.
- Tiny QoL parity improvement: the CLI also issues `launchctl enable` after bootstrap, matching the packaged installer behavior more closely.

**Acceptance criteria:**
- [x] Pick one story and make every user-facing surface match it.
- [x] Make `idlewatch install-agent` behave like the packaged install script.
- [x] On a no-config machine, `idlewatch install-agent` still installs/loads the LaunchAgent, then prints the short next-step message.
- [x] `idlewatch status` remains the place to check “no saved config yet” vs “agent installed”.
- [x] No auth/ingest redesign; telemetry path preserved.

---

## Verified areas in this cycle
- Config next-start/restart messaging still reads clean.
- `--test-publish` alias remains wired and documented.
- Packaged LaunchAgent script messaging is cleaner than older rounds.
- NPM/global/NPX command-path wording is mostly aligned.

## Summary
The main setup story is aligned again: npm/CLI and packaged installs now both allow install-first, quickstart-later background setup. This keeps reconfigure/startup guidance simple without touching auth, ingest, or the now-working telemetry path.
