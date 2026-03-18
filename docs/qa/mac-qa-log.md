# IdleWatch Installer QA Log
**Focus:** UX polish (no auth/backend redesigns)

---

## Date: 2026-03-18 07:00 AM EST

### H1. Device name persists correctly after reauth/reinstall | **⚠️ FAIL**
**Repro:**
1. Run `idlewatch quickstart` and note device name (e.g., "My MacBook")
2. Re-run `idlewatch quickstart` or `idlewatch menubar --launch` after auth key change
3. Check `~/.idlewatch/idlewatch.env` for persisted `IDLEWATCH_DEVICE_NAME`
**Expected:** Device name preserved in config file, restored on reinstall/reboot
**Actual:** Device name resets to fallback during re-auth flow; config persistence occurs but TUI wizard doesn't load prior device name before prompt
**Impact:** Users must re-enter device name after every auth change or install attempt
**Fix:** Persist and restore `IDLEWATCH_DEVICE_NAME` from config file before showing TUI prompts in `quickstart/configure` commands. If not present in env file, use as fallback but log warning.
**Acceptance:** After changing API key or re-running installer, device name persists from prior run unless explicitly changed.

### H2. Config reload behavior is predictable | **⚠️ FAIL**
**Repro:**
1. Run `idlewatch quickstart` to generate config in `~/.idlewatch/idlewatch.env`
2. Edit env file to add/modify `IDLEWATCH_CUSTOM_METRICS_FILE` or any path-based variable
3. Run `idlewatch run` without restart; observe if new paths are used
**Expected:** Environment variables loaded at startup should respect changes made to persisted config file, OR provide clear mechanism (CLI flag + reload command) to re-read config at runtime
**Actual:** CLI only reads env vars from current process environment at startup; modifications to `idlewatch.env` are not picked up until full restart or source the file explicitly
**Impact:** Users unaware that changing persistent config requires CLI restart; confusing when "not working" after edits
**Fix:** Document reload pattern: run `idlewatch --once` with explicit env override, OR implement config watch in `run` command to re-parse env on startup. At minimum, print clear message when config file modified.
**Acceptance:** After modifying persisted config file, users can verify changes took effect via status or dashboard within a new CLI invocation.

### M1. Add status screen showing device/link/metric state | **FAIL - TODO**
**Repro:** Run `idlewatch status` command
**Expected:** Output includes:
- Device name (from env file)
- API key link status (pending/linked/detached)
- Last publish result (success/failure with sample timestamp)
- Enabled metrics count/type
**Actual:** Status shows generic config, no device/linkage/publish state visibility
**Impact:** Users unable to self-verify setup success beyond "no errors shown"
**Fix:** Implement `buildStatusPayload` function mirroring `buildLocalDashboardPayload`, add to status command output
**Acceptance:** `idlewatch status` displays device name, link status, last publish result, metrics count.

### M2. Add explicit test publish flow in setup/control | **FAIL - TODO**
**Repro:** After running `quickstart`, try to verify end-to-end publish without waiting for background run
**Expected:** CLI flag or command like `idlewatch test` that sends one sample with clear success/error output
**Actual:** No explicit test-publish command; must wait for `idlewatch run` or rely on `--once` as ad-hoc workaround
**Impact:** Users anxious about connection quality have no quick verification path
**Fix:** Add `idlewatch test` command similar to `--once` but with enhanced messaging (device name, status, metrics sent count)
**Acceptance:** `idlewatch test` sends one telemetry sample and prints clear success/error message with device identity.

### M3. Clearer success confirmation after first link/publish | **FAIL - TODO**
**Repro:** Run `quickstart`, observe final output after successful sample publish
**Expected:** Output explicitly confirms: "Device '{deviceName}' linked successfully", includes optional dashboard URL for real-time monitoring
**Actual:** Vague success message; no device identity or next steps clearly communicated
**Impact:** Users unsure whether link actually persisted, what metrics are active, where to verify
**Fix:** Success output prints device name and status: "✅ Device '{deviceName}' linked successfully" + optional dashboard URL
**Acceptance:** After successful `quickstart`, user sees confirmed device identity with status message.

### M4. Test publish errors are clear and actionable | **FAIL - TODO**
**Repro:** Run `--once` with invalid API key, observe error
**Expected:** Error message includes: "Invalid API key format", suggest checking at idlewatch.com/api
**Actual:** Generic "setup is not finished yet" with no guidance on what's wrong
**Impact:** Users frustrated by vague messaging; must guess fix (check website? key?)
**Fix:** Detect invalid API key and print explicit error: "Invalid API key format. Check https://idlewatch.com/api for instructions"
**Acceptance:** Invalid key produces clear, actionable error message with URL.

### L1. Settings/edit flow for changing metrics without re-entering unchanged values | **TODO - low priority**
**Repro:** Run `quickstart` to set "CPU", then try to add "Memory" metric
**Expected:** Add new metric without requiring full re-entry of existing settings
**Actual:** Must rerun `quickstart` entirely; no partial update flow exposed
**Impact:** Higher friction for post-setup tuning
**Fix:** Implement TUI edit mode that preserves prior values, or CLI flag to add/remove specific metrics from config
**Acceptance:** Users can modify metric list without re-entering full configuration.

### L2. Launch-agent install/uninstall is clear and safe | **TODO - low priority**
**Repro:** Run `idlewatch menubar --launch`, observe output
**Expected:** Clear message explaining when agent installed/removed, optional path to manual service management
**Actual:** No explicit messaging about LaunchAgent behavior; silent installation/removal possible
**Impact:** Users unsure why service started/stopped
**Fix:** Print clear success/failure messages for LaunchAgent commands, explain "auto-installed" context
**Acceptance:** User sees clear explanation of LaunchAgent install status with no ambiguity.

### L3. Local storage location is clear/expected | **TODO - low priority**
**Repro:** Run `quickstart`, ask "where does config live?"
**Expected:** Config location (`~/.idlewatch/idlewatch.env`) displayed or easily discoverable via docs/help
**Actual:** No explicit location print during setup; discovered by browsing filesystem
**Impact:** Self-service debugging requires manual file exploration
**Fix:** Print config path in success message, add `--help` location hints
**Acceptance:** Config file path visible in `quickstart` output or help.

---

## Findings Summary

| Priority | Count | Status |
|----------|-------|--------|
| High     | 2/2   | ❌ All FAIL |
| Medium   | 4/4   | ❌ All FAIL |
| Low      | 3/3   | ⚠️ TODO |

**Action Items:**
- Address H1: Persist and restore `IDLEWATCH_DEVICE_NAME` in TUI prompts
- Address H2: Implement config reload pattern or document explicitly required restart
- Add M1/M2/M3/M4 status screen, test publish, clearer messaging
- Document L3 config path visibility

**Next Steps:**
- QA log commit pushed (docs only)
- Backlog items tracked for follow-up polish cycle

---

_Last updated: 2026-03-18 07:00 AM EST_
