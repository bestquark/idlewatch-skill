# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R78 (installer/CLI polish verification pass)

## Status: OPEN - 1 high-priority polish gap

Core flow still looks solid, but one user-facing setup path tells two different stories depending on which install surface they use.

---

## Priority findings

### H1. `idlewatch install-agent` still blocks on missing config, contradicting packaged script/docs
**Priority:** High
**Status:** ❌ Open

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

**Current conflicting surfaces:**
- `bin/idlewatch-agent.js` hard-fails when config is missing.
- `scripts/install-macos-launch-agent.sh` explicitly supports no-config install and explains the follow-up flow.
- `README.md` / `docs/onboarding-external.md` / `docs/packaging/macos-launch-agent.md` imply install-first is valid.

**Acceptance criteria:**
- Pick one story and make every user-facing surface match it.
- Preferred polish direction: make `idlewatch install-agent` behave like the packaged install script.
- On a no-config machine, `idlewatch install-agent` should still install/load the LaunchAgent, then print a short next-step message:
  - LaunchAgent installed
  - run `idlewatch quickstart`
  - re-run `idlewatch install-agent` once after setup to restart with saved config
- `idlewatch status` should remain clear about “no saved config yet” vs “agent installed”.
- No auth/ingest redesign; this is just setup-flow consistency.

---

## Verified areas in this cycle
- Config next-start/restart messaging still reads clean.
- `--test-publish` alias remains wired and documented.
- Packaged LaunchAgent script messaging is cleaner than older rounds.
- NPM/global/NPX command-path wording is mostly aligned.

## Summary
One important polish gap remains: the npm/CLI install path is stricter than the packaged app install path, even though docs now describe the relaxed path as the intended UX. Fix that mismatch and this lane is back to feeling simple.
