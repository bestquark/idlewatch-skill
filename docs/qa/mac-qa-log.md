# IdleWatch QA Cycle R804 Summary

**Date:** 2026-03-29 06:00 UTC  
**Author:** OpenClaw Assistant

## Status: 3 minor polish findings

### Verified Stable (no changes needed)

- H1: Device name persistence ✅
- H2: Config reload predictability ✅
- M1–M4: Status screen, test publish, success messages, error formatting ✅
- L2: Launch-agent install/uninstall messaging ✅
- L3: Local storage path clarity ✅
- Setup wizard quality: clean, low-friction ✅
- `--help` output: concise, well-structured ✅
- `--dry-run` output: compact single-line summary ✅
- `status` field alignment: consistent padding ✅

### New Findings

#### P3-01: Duplicate `parseEnvValue`/`normalizeEnvKey` definitions

- **Severity:** P3 (code hygiene, no user impact)
- **Location:** `bin/idlewatch-agent.js:616-641` and `src/enrollment.js:286-311`
- **Issue:** Both files define identical `parseEnvValue()` and `normalizeEnvKey()` functions independently. If one drifts, config parsing could silently differ between enrollment and runtime.
- **Repro:** `grep -n 'function parseEnvValue\|function normalizeEnvKey' bin/idlewatch-agent.js src/enrollment.js`
- **Fix:** Extract to a shared `src/env-parse.js` module and import in both files.
- **Acceptance:** Only one definition of each function exists in the codebase (excluding `dist/`).

#### P3-02: Status "Get started" fallback line off-by-one alignment

- **Severity:** P3 (cosmetic)
- **Location:** `bin/idlewatch-agent.js:2124`
- **Issue:** When status shows "Get started" (12 chars + colon + spaces = 16 visible chars before the command), the fallback `--no-tui` line uses 17 chars of indent, creating a 1-space misalignment.
- **Repro:** `node bin/idlewatch-agent.js status` (without saved config)
- **Observed:**
  ```
    Get started:  idlewatch quickstart
                   idlewatch quickstart --no-tui   # plain text fallback
  ```
- **Expected:** Both lines should align at the same column.
- **Fix:** Adjust indent string from `'                 '` to `'                '` (16 chars), or compute it dynamically from the label width.
- **Acceptance:** Both command lines start at the same column in `status` output regardless of label ("Get started" vs "Finish setup").

#### P3-03: Dry-run "555% overflow" phrasing may alarm users

- **Severity:** P3 (UX copy)
- **Location:** Dry-run summary line
- **Issue:** `100%+ context used (555% overflow)` reads like something is broken. For a monitoring tool, this is just a data point about OpenClaw usage, but "overflow" sounds like an error.
- **Repro:** `node bin/idlewatch-agent.js --dry-run`
- **Observed:** `OpenClaw: gpt-5.4, 100%+ context used (555% overflow), 151,280 tok/min`
- **Suggestion:** Consider "555% of context window" or "5.5× context window" — factual without alarm.
- **Acceptance:** Dry-run summary uses neutral phrasing for high context usage values.

### Cycle Summary

The product is in good shape. All prior H/M items remain stable. The 3 new findings are P3 (low severity, no functional impact). The duplicate function defs are the most worth addressing for maintainability; the other two are cosmetic.

---
*Auto-generated during IdleWatch QA polish cycle R804*
