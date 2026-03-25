# IdleWatch Installer QA Log 2026-03-25

**Cycle:** R86 (installer/CLI polish follow-up)

## Status: OPEN — one low-risk copy polish nit remains

Core setup/install behavior still feels solid. Reconfigure + LaunchAgent refresh now behave like a boring, dependable path, which is exactly what this product wants. This pass only found one small UX polish issue: the local-only quickstart success path still flashes a warning-style sample message right before declaring success.

---

## Priority findings

### L1. Local-only quickstart still uses warning-flavored sample copy inside an otherwise successful setup flow
**Priority:** Low  
**Status:** Open

**Why this matters:**
The setup flow is almost there, but the emotional tone is slightly crossed. In local-only mode, the wizard says:
- `Running in local-only mode — telemetry is saved to disk but not published.`
- `⚠️ Sample collected (3 metrics) (not published)`
- `✅ Setup complete — "QA Box" is live!`

Technically correct, but not ideal product taste. “Not published” in local mode is expected behavior, not a warning. The warning glyph makes the success path feel like a partial failure for no good reason.

For a simple setup flow, local-only mode should feel intentional, calm, and complete — more like “saved locally” than “warning: didn’t publish.”

**Exact repro:**
1. From a source checkout, use a clean temp home:
   ```bash
   cd /Users/luismantilla/.openclaw/workspace/idlewatch-skill
   TMPHOME=$(mktemp -d)
   ```
2. Run local-only quickstart:
   ```bash
   HOME="$TMPHOME" IDLEWATCH_ENROLL_NON_INTERACTIVE=1 IDLEWATCH_ENROLL_MODE=local \
     IDLEWATCH_ENROLL_DEVICE_NAME='QA Box' \
     IDLEWATCH_ENROLL_METRICS='agent_activity,token_usage' \
     node bin/idlewatch-agent.js quickstart --no-tui
   ```
3. Observe this sequence in the success path:
   ```text
   Running in local-only mode — telemetry is saved to disk but not published. Run node bin/idlewatch-agent.js configure to add a cloud API key.
   Collecting sample for "QA Box" (local-only mode)…
   ⚠️ Sample collected (3 metrics) (not published)

   ✅ Setup complete — "QA Box" is live!
      Mode:   local
      ...
      ✓ Local telemetry verified.
   ```

**Acceptance criteria:**
- [ ] Local-only quickstart success avoids warning-style framing for expected local behavior.
- [ ] The one-shot verification message feels intentionally successful in local mode (for example: saved locally, verified locally, or similar calm wording).
- [ ] Users can still clearly tell that local-only mode does not publish to the cloud.
- [ ] Cloud mode keeps stronger publish confirmation language.
- [ ] The setup completion block remains short and visually quiet.

---

## Verified in this cycle
- `quickstart --no-tui` still persists device name and metrics into the active `idlewatch.env`.
- Device identity still persists cleanly (`IDLEWATCH_DEVICE_NAME=QA Box`, `IDLEWATCH_DEVICE_ID=qa-box`).
- `status` still makes saved-config state, metrics enabled, local log path, log size, last sample age, and LaunchAgent state easy to scan.
- `--test-publish` still behaves as the documented alias for `--once`.
- First-run `install-agent` still succeeds and explains uninstall safety clearly.
- Immediate `install-agent` re-run still behaves like a clean refresh.
- `uninstall-agent` still preserves config and logs as expected.
- Postinstall install-path hints are still mostly clear about global install vs one-off `npx` usage.

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
HOME="$TMPHOME" node bin/idlewatch-agent.js install-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js uninstall-agent
HOME="$TMPHOME" node bin/idlewatch-agent.js status
node scripts/postinstall.mjs
```

## Notes
- The live repo-level `/Users/luismantilla/.openclaw/workspace/idlewatch-cron-polish-plan.md` still behaves more like a historical snapshot than an active checklist, so the practical source of truth for this cycle was the current CLI behavior.
- No packaging, auth, or ingest redesign needed from this pass.
