# IdleWatch Installer QA Log

## Session
[cron:c1e239d5-6bd1-42fd-8f86-08fc0615bbe1 IdleWatch Installer QA polish lane]

---

## 2026-03-21 — Round 9: Status Reconciliation

### Resolved since Round 8
- **P2 `--version` flag**: Now works (`idlewatch 0.1.9`, exits cleanly). **CLOSED.**
- **P1 Self-dependency**: `package.json` no longer lists `"idlewatch"` in dependencies. **CLOSED.**
- **P2 Dev artifacts**: `enrollment-new.js`, `enrollment.js.tmp`, `enrollment-full-backup.js` all deleted. **CLOSED.**
- **P2 `src/status.js` dead code**: File removed entirely. **CLOSED.**

### Still open, verified unchanged

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | **P1** | `--help` dumps 69 lines incl. 30 env vars (Advanced env, Firebase internals) | OPEN |
| 2 | P2 | No CLI subcommand for LaunchAgent install/uninstall (`idlewatch install-agent` / `uninstall-agent`) | OPEN |
| 3 | P2 | `create` wizard can't edit/delete existing custom metrics | OPEN |
| 4 | P2 | Post-quickstart success/error messages are debug-formatted (raw JSON, no summary) | OPEN |
| 5 | P2 | npx menubar help text is vague / dead-end | OPEN |
| 6 | P3 | `.env.example` mixes user config with CI/packaging vars | OPEN |
| 7 | P3 | `status` doesn't show LaunchAgent state (running/stopped/not installed) | OPEN |

### NEW P1 — `--help` mixes user-facing and internal env vars in a single wall of text

**Repro**:
```
node bin/idlewatch-agent.js --help
```

**Observed**: 69 lines printed. 30 environment variables listed, including advanced internals (`IDLEWATCH_OPENCLAW_MAX_OUTPUT_BYTES_HARD_CAP`, `IDLEWATCH_USAGE_REFRESH_REPROBES`) and Firebase emulator vars. No visual separation between "things a user needs" and "things a developer tunes."

**Why it matters**: A new user running `idlewatch --help` is overwhelmed. The useful info (subcommands + quickstart steps) is buried. This is the single most visible first-impression surface.

**Acceptance**:
1. `--help` prints ≤25 lines: subcommands, quickstart steps, and ≤5 common env vars
2. Advanced/internal env vars move to `--help-env` or `--help-advanced` (or just the README)
3. No Firebase/emulator vars in default help output

### NEW P2 — `status` should show LaunchAgent state

**Repro**:
```
node bin/idlewatch-agent.js status
```

**Observed**: Output shows device config, publish mode, metrics, last sample age — but nothing about whether the LaunchAgent is installed/loaded/running. User has no single place to check "is IdleWatch actually running in the background?"

**Acceptance**: `status` output includes a line like:
```
  Background:   LaunchAgent loaded (running)
```
or `not installed` / `stopped` as appropriate. Use `launchctl print gui/<uid>/com.idlewatch.agent` to detect state.

### NEW P3 — Wizard "Choose setup mode" box is wider than necessary

**Repro**: Run `idlewatch quickstart` in a terminal.

**Observed**: The ASCII box is 49 chars wide with generous padding, and the two mode options use nested indentation that makes it look like a form rather than a quick choice. Minor visual noise.

**Acceptance**: Box width ≤40 chars or removed entirely. Mode prompt can be a simple inline question: `Setup mode — 1) Cloud (recommended) 2) Local-only [1]: `

---

## Priority Summary (Round 9, 2026-03-21)

| # | Sev | Summary | Status |
|---|-----|---------|--------|
| 1 | **P1** | `--help` is 69 lines with 30 env vars — overwhelming for new users | ✅ CLOSED — trimmed to 26 lines, env vars moved to `--help-env` |
| 2 | P2 | No CLI subcommand for LaunchAgent install/uninstall | OPEN |
| 3 | P2 | `create` wizard can't edit/delete existing custom metrics | OPEN |
| 4 | P2 | Post-quickstart success/error messages are debug-formatted | OPEN |
| 5 | P2 | npx menubar help text is vague / dead-end | OPEN |
| 6 | P2 | `status` doesn't show LaunchAgent state | ✅ CLOSED — status now shows LaunchAgent loaded/idle/not installed |
| 7 | P3 | `.env.example` mixes user config with CI vars | OPEN |
| 8 | P3 | Wizard ASCII box is visually noisy for a 2-option prompt | ✅ CLOSED — replaced with minimal inline prompt |

### Notes
- 4 items closed this round (--version, self-dep, dev artifacts, dead status.js). Good progress.
- **Top recommendation for next implementer cycle**: Trim `--help` to ≤25 lines. Move advanced env docs to README or `--help-advanced`. This is the highest-impact polish item remaining.
- LaunchAgent state in `status` promoted to P2 — it's the natural place users check "is it running?" and currently gives no answer.
