# IdleWatch Installer QA Log

**Repo:** `/Users/luismantilla/.openclaw/workspace/idlewatch-skill`  
**Last updated:** Wednesday, March 25th, 2026 — 10:25 AM (America/Toronto)
**Status:** OPEN - polish follow-up

---

## Cycle R79 Status: OPEN

Small UX polish issues only. Core installer/CLI flow is working.

### Priority 2 (Medium)

#### [M1] Quickstart does not clearly reactivate a preinstalled LaunchAgent
**Why it matters:** A neat setup flow should make the “install agent first, configure second” path feel intentional, not half-manual. Right now the post-setup copy falls back to generic background guidance instead of clearly saying the already-installed agent needs one more refresh.

**Repro**
1. Use a clean HOME.
2. Run `node bin/idlewatch-agent.js install-agent` before any setup.
3. Run `node bin/idlewatch-agent.js quickstart --no-tui`.
4. Choose local-only, accept defaults, complete setup.
5. Read the completion message.

**Observed**
- Setup succeeds.
- Completion ends with generic copy:
  - `Use it now: ... run`
  - `For background mode: ... install-agent`
- It does **not** explicitly say the LaunchAgent is already installed and should now be **re-run / refreshed** to start using the saved config.

**Acceptance criteria**
- If a LaunchAgent plist already exists but is not loaded because setup was not saved yet, quickstart completion should say that explicitly.
- Preferred copy shape: “Background agent is already installed. Re-run `idlewatch install-agent` to start it with the saved config.”
- Avoid making the user infer whether this is a first install vs a refresh.

---

### Priority 3 (Low)

#### [L1] First-run `status` preview is slightly too technical/noisy before setup
**Why it matters:** On an unconfigured machine, `status` is often a reassurance screen. Showing the full advanced metric preview (`OpenClaw activity`, `OpenClaw tokens`, `OpenClaw runtime`, etc.) before setup makes the surface feel more technical than necessary.

**Repro**
1. Use a clean HOME.
2. Run `node bin/idlewatch-agent.js status`.

**Observed**
- Output is functional, but the preview includes the full advanced metric set before the user has chosen anything.
- The first-run screen feels a bit busier than it needs to be.

**Acceptance criteria**
- Keep `status` useful before setup, but reduce cognitive load.
- Prefer a simpler preview such as:
  - a shorter default label (`Default metrics`) or
  - only the core default metrics, with advanced/OpenClaw metrics shown after setup or in a secondary detail line.
- Avoid removing important info from configured/status-after-setup flows.

---

## Notes
- Core polish areas requested for this cycle mostly verify well: config persistence, test publish behavior, uninstall safety, and npm/npx durable-install messaging are broadly in good shape.
- No redesign requested or recommended.
