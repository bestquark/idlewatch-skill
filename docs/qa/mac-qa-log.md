# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R87 (installer/CLI polish follow-up)

## Status: CLOSED — README quickstart framing polished

The core flow still feels solid: config persists, local verification copy is calmer now, status stays readable, and LaunchAgent install/uninstall remains simple. The remaining first-run docs friction is now fixed: README quickstart presents local-only and cloud setup as equally intentional, without making cloud auth feel mandatory up front.

---

## Priority findings

### M1. README quickstart still frames cloud setup as mandatory even though local-only setup is a valid low-friction path
**Priority:** Medium  
**Status:** Fixed

**Why this matters:**
This is a small docs issue, but it lands right on the product’s first impression. The CLI now supports a neat local-first setup path, yet the README still starts with:
- `Create an API key at idlewatch.com/api`
- `Run the setup wizard`
- `Pick a device name and metrics — done!`

That makes the product feel more gated and more technical than it actually is. For a utility like this, the nicest setup story is: run it, pick a name, choose local or cloud, done. If cloud is optional, the top-level quickstart should not read like cloud auth is step zero.

This is especially relevant for:
- people testing via `npx idlewatch quickstart`
- local-only users who just want telemetry on disk first
- QA and first-run reviewers judging setup friction from the README before they ever see the wizard

**Exact repro:**
1. Open the README install/quickstart section:
   ```bash
   cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
   sed -n '1,80p' README.md
   ```
2. Compare the README quickstart copy with the actual local-only setup behavior:
   ```bash
   TMPHOME=$(mktemp -d)
   HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
     IDLEWATCH_ENROLL_METRICS='agent_activity,token_usage' \
     node bin/idlewatch-agent.js quickstart --no-tui
   ```
3. Observe the mismatch:
   - README implies API key creation is required before setup.
   - Actual product supports a successful local-only setup with no API key.

**Acceptance criteria:**
- [x] README quickstart makes local-only vs cloud setup feel equally intentional.
- [x] Top-level setup instructions do not imply a cloud API key is mandatory for first use.
- [x] `npm install -g` and `npx` paths still stay short and obvious.
- [x] The docs keep the setup story minimalistic rather than branching into a long decision tree.
- [x] Cloud users can still easily find the API-key step when they want publishing.

---

## Verified in this cycle
- `quickstart --no-tui` still persists device name and metrics into the active `idlewatch.env`.
- Device identity still persists cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- `status` still makes saved-config state, metrics enabled, local log path, log size, last sample age, and LaunchAgent state easy to scan.
- `--test-publish` still behaves as the documented alias for `--once`.
- `install-agent` / `uninstall-agent` messaging is still concise and safe.
- Postinstall install-path hints still clearly distinguish global install vs one-off `npx` use.
- README install path stays short, and the first-run cloud-vs-local framing is now aligned with the actual product flow.

## Validation used
```bash
cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
TMPHOME=$(mktemp -d)
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
  IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
  IDLEWATCH_ENROLL_METRICS='agent_activity,token_usage' \
  node bin/idlewatch-agent.js quickstart --no-tui
cat "$TMPHOME/.idlewatch/idlewatch.env"
HOME="$TMPHOME" node bin/idlewatch-agent.js status
HOME="$TMPHOME" node bin/idlewatch-agent.js --test-publish
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
node scripts/postinstall.mjs
sed -n '1,120p' README.md
```

## Notes
- The repo-level `idlewatch-cron-polish-plan.md` reads like a historical checklist now; current CLI behavior was the more reliable source of truth for this pass.
- No auth, ingest, or packaging redesign recommended from this cycle.
- The product itself is in better shape than the README currently advertises, which is a nice problem to have.
