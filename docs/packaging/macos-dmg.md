# macOS DMG packaging pipeline

IdleWatch ships an `.app` scaffold in `dist/` and a DMG installer pipeline.
Signing/notarization are optional but available when Apple credentials are configured.
The `scripts/` folder now includes packaging, runtime, and launch lifecycle helpers for
local testing and release preparation.

## Prerequisites

- Xcode Command Line Tools (`xcode-select --install`)
- Node.js 20+ on target host (current launcher executes payload with local `node` or bundled runtime)
- Apple Developer signing identity (for production)
- Notary API key/profile configured in keychain (for production)
- Optional tools for polished DMG UX:
  - `create-dmg`
  - `dmgbuild`

## Pipeline stages

1. **Build artifact**
   - `npm ci`
   - `npm test`
   - `npm pack` to generate tarball
2. **Create app wrapper skeleton**
   - Stage Node package + app metadata into `dist/IdleWatch.app/Contents/Resources/`
   - Add launcher script in `Contents/MacOS/IdleWatch`
3. **Launch lifecycle (optional)**
   - Install LaunchAgent to keep IdleWatch running in the background:
     - `scripts/install-macos-launch-agent.sh`
   - Uninstall: `scripts/uninstall-macos-launch-agent.sh`
4. **Codesign (optional)**
   - Sign app with `codesign --deep --force --options runtime ...`
5. **Notarize (optional)**
   - `xcrun notarytool submit ... --wait`
   - `xcrun stapler staple IdleWatch-<ver>-*.dmg`
6. **Build DMG (baseline)**
   - `hdiutil create ...` output: `dist/IdleWatch-<version>-unsigned.dmg` or `-signed.dmg`

## Current scaffold commands

### OpenClaw discoverability in packaged launches

IdleWatch writes packaging metadata (`Contents/Resources/packaging-metadata.json`) during `package-macos` with the `openclawBinHint` used at build time.

When the packaged launcher starts, it resolves the OpenClaw binary in this order:

1. `IDLEWATCH_OPENCLAW_BIN` (explicit runtime override, preferred)
2. `IDLEWATCH_OPENCLAW_BIN_HINT` (legacy launcher hint, supported)
3. `openclawBinHint` from `packaging-metadata.json`
   (packaging writes this value from the same `IDLEWATCH_OPENCLAW_BIN` / `IDLEWATCH_OPENCLAW_BIN_HINT` inputs used during build)
4. `openclaw` via normal `PATH`

When bundling a Node runtime, `package-macos.sh` copies a portable subset (`bin`, `lib`, `include`) with symlink dereference, so packaged layouts remain portable even when the host runtime is a symlink and avoids copying non-essential symlinked shell-completion trees.

OpenClaw command probing in the packaged runtime uses the same command preference list as local runs:
`status --json`, `usage --json`, `session status --json`, `session_status --json`, `stats --json`.

This makes packaged installs more reliable in environments where `openclaw` is not on the default launcher `PATH`.


Each packaged app includes `Contents/Resources/packaging-metadata.json` with build provenance (version, signing/runtime hints, payload filename, and launcher settings) to support supportability checks and deterministic QA.

Optional environment variables:
- `IDLEWATCH_OPENCLAW_BIN="/opt/homebrew/bin/openclaw"` — pins OpenClaw binary path for packaged/non-interactive runtime usage collection.
- `IDLEWATCH_OPENCLAW_BIN_HINT="/opt/homebrew/bin/openclaw"` — legacy launcher hint (supported for compatibility).
- `IDLEWATCH_NODE_BIN="/opt/homebrew/bin/node"` — pins Node binary path used by packaged app launcher.
- `IDLEWATCH_NODE_RUNTIME_DIR="/path/to/node-runtime"` — optionally bundles portable Node runtime into app resources (`<runtime>/bin/node` required).
- `IDLEWATCH_APP_PATH="/Applications/IdleWatch.app"` — app path used by LaunchAgent scripts.
- `IDLEWATCH_LAUNCH_AGENT_LABEL="com.idlewatch.agent"` — override LaunchAgent label.
- `IDLEWATCH_LAUNCH_AGENT_PLIST_ROOT="$HOME/Library/LaunchAgents"` — override plist root for install/uninstall scripts.
- `IDLEWATCH_LAUNCH_AGENT_LOG_DIR="$HOME/Library/Logs/IdleWatch"` — set log destination for LaunchAgent output.
- `IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS=2500` — baseline per-probe timeout for OpenClaw usage commands (packaging validation wrappers default to `4000`).
- `IDLEWATCH_DRY_RUN_TIMEOUT_MS=15000` — baseline timeout in milliseconds for `--dry-run` validation helpers (prevents launchers that emit continuous output from hanging validation).
  - Packaged runtime and DMG install validators default this to `30000` during execution to reduce false timeout failures on slow hosts.
- `IDLEWATCH_DRY_RUN_TIMEOUT_RETRY_BONUS_MS=10000` — extra timeout budget (in ms) applied when an `--dry-run` attempt does not emit telemetry.
  - Example: `30000` -> fallback retry tries `40000` (then `50000`, etc., if `IDLEWATCH_DRY_RUN_TIMEOUT_MAX_ATTEMPTS` is raised).
- `IDLEWATCH_DRY_RUN_TIMEOUT_MAX_ATTEMPTS=3` — number of timeout/retry attempts for packaged validator dry-runs. Set to `1` to keep strict single-pass behavior.
- `IDLEWATCH_DRY_RUN_TIMEOUT_BACKOFF_MS=2000` — optional backoff delay (ms) between retries in packaged validators. Helps avoid flapping when disk or mount pressure temporarily stalls output.
  - Set to `0` for tight loops when deterministic timing is already stable.
- `MACOS_CODESIGN_IDENTITY="Developer ID Application: ..."` — signs `IdleWatch.app` during `package-macos.sh`.
- `MACOS_NOTARY_PROFILE="<keychain-profile>"` — notarizes/staples DMG during `build-dmg.sh`.
- `IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION=1` — strict mode; fails packaging unless signing/notarization prerequisites are present.
- `IDLEWATCH_ALLOW_UNSIGNED_TAG_RELEASE=1` — explicit CI-only bypass for tag builds; disables auto-strict guard that otherwise blocks unsigned `refs/tags/*` packaging.

- `scripts/package-macos.sh`
  - Creates `dist/IdleWatch.app`
  - Bundles the generated `idlewatch-skill-<version>.tgz` and expands it into `Contents/Resources/payload/package`
  - Installs production runtime dependencies into packaged payload (`npm ci --omit=dev` when a lockfile is available, otherwise `npm install --omit=dev`) so mounted-DMG launches do not rely on workspace/global `node_modules`
  - Generates a working launcher (`Contents/MacOS/IdleWatch`) that runs:
    - `<node> Contents/Resources/payload/package/bin/idlewatch-agent.js ...`
    - Node binary resolution order: `IDLEWATCH_NODE_BIN` → bundled runtime (`Contents/Resources/runtime/node/bin/node`, when `IDLEWATCH_NODE_RUNTIME_DIR` is supplied at package time) → `PATH` (`node`)
  - Launcher enforces Node.js major version `>=20` and fails with actionable runtime-path/version diagnostics otherwise
  - Stages `dist/dmg-root` and adds `/Applications` symlink
- `scripts/build-dmg.sh`
  - Creates `dist/IdleWatch-<version>-unsigned.dmg` (or `-signed.dmg` when `MACOS_CODESIGN_IDENTITY` is set) from `dist/dmg-root`
  - Writes SHA-256 checksum to `dist/IdleWatch-<version>-<signed|unsigned>.dmg.sha256`
  - If `MACOS_NOTARY_PROFILE` is set, submits DMG via `notarytool` and staples on success
- `scripts/validate-packaged-metadata.sh`
  - Verifies generated `Contents/Resources/packaging-metadata.json` and packaged entrypoint integrity
- `scripts/validate-dmg-checksum.sh`
  - Verifies checksum integrity for latest DMG (or explicit path)
- `npm run validate:dmg-checksum`
  - Runs `scripts/validate-dmg-checksum.sh` for artifact integrity checks in local/release workflows
- `npm run validate:packaged-metadata`
  - Runs `scripts/validate-packaged-metadata.sh` and validates bundle metadata + platform consistency
- `npm run package:release`
  - Runs `package:trusted` and checksum validation in one command (safe for production-ready artifact preparation)
- `scripts/install-macos-launch-agent.sh`
  - Writes `~/Library/LaunchAgents/<label>.plist`
  - Loads `LaunchAgent` under current user sandbox, with `StartInterval` aligned to `IDLEWATCH_INTERVAL_MS` (min 60s), background mode, stdout/stderr logs
- `scripts/uninstall-macos-launch-agent.sh`
  - Unloads and removes `~/Library/LaunchAgents/<label>.plist`
- `npm run install:macos-launch-agent`
  - Wrapper for `scripts/install-macos-launch-agent.sh`
- `npm run uninstall:macos-launch-agent`
  - Wrapper for `scripts/uninstall-macos-launch-agent.sh`
- `scripts/validate-trusted-prereqs.sh`
  - Validates local signing identity + notary keychain profile before trusted packaging
- `npm run package:trusted`
  - Strict signed + notarized local path (`IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION=1`)
- `npm run validate:dmg-install`
  - Mounts latest DMG (or a provided path), copies `IdleWatch.app` into a temp Applications-like folder, then validates launcher dry-run schema from the copied app.
  - Runs OpenClaw-enabled dry-run first and retries up to `IDLEWATCH_DRY_RUN_TIMEOUT_MAX_ATTEMPTS` with increasing timeout (`+IDLEWATCH_DRY_RUN_TIMEOUT_RETRY_BONUS_MS`) plus optional backoff (`IDLEWATCH_DRY_RUN_TIMEOUT_BACKOFF_MS`) before a disabled-usage launchability pass (`IDLEWATCH_OPENCLAW_USAGE=off`).
- `npm run validate:packaged-bundled-runtime`
  - Repackages with `IDLEWATCH_NODE_RUNTIME_DIR` pointed at the current Node runtime, validates the generated package metadata, then executes `IdleWatch.app/Contents/MacOS/IdleWatch --dry-run` in a PATH-scrubbed environment to confirm bundled runtime/path-resolution still works when the host PATH does not provide a Node binary.
  - The validation is timeout-bound via `IDLEWATCH_DRY_RUN_TIMEOUT_MS`, retry count (`IDLEWATCH_DRY_RUN_TIMEOUT_MAX_ATTEMPTS`), and incremental timeout/backoff (`IDLEWATCH_DRY_RUN_TIMEOUT_RETRY_BONUS_MS`, `IDLEWATCH_DRY_RUN_TIMEOUT_BACKOFF_MS`).
  - It validates required sample fields (`host`, `ts`, and `fleet`/`source` contract) while preventing false positives from log banners.
  - If the OpenClaw-enabled dry-run path does not emit telemetry within the timeout window, the script retries with extended timeout and then falls back to `IDLEWATCH_OPENCLAW_USAGE=off` for deterministic launchability checks.
  - In `IDLEWATCH_OPENCLAW_USAGE=off`, schema validation expects `source.usage=disabled` and `usageFreshnessState=disabled`, so launchability checks remain deterministic even without local OpenClaw CLI availability.
- Clean-machine verification note:
  - For external QA, treat `validate:packaged-bundled-runtime` output plus a fresh `validate:dmg-install` smoke run from a separate macOS account/environment as your clean-machine gate for end-user install friction.
  - This script is self-contained (Node-only) and does not depend on host Python tooling.


## CI integration

- Baseline packaging smoke: `.github/workflows/ci.yml` (`macos-packaging-smoke` job; includes bundled-runtime launcher validation via `npm run validate:packaged-bundled-runtime`, packaged app telemetry schema check via `npm run validate:packaged-dry-run-schema:reuse-artifact`, packaged usage-health validation via `npm run validate:packaged-usage-health:reuse-artifact`, parser resilience for non-zero-exit/noisy probe output via `npm run validate:packaged-usage-probe-noise-e2e:reuse-artifact`, packaged usage alert-rate transitions via `npm run validate:packaged-usage-alert-rate-e2e:reuse-artifact`, packaged usage-age SLO gate via `npm run validate:packaged-usage-age-slo:reuse-artifact`, packaged stale-threshold recovery validation via `npm run validate:packaged-usage-recovery-e2e:reuse-artifact`, checksum validation via `npm run validate:dmg-checksum`, and DMG install validation via `npm run validate:dmg-install`)
- Core validation coverage also runs `npm run validate:openclaw-stats-ingestion` and `npm run validate:packaged-openclaw-release-gates` (which bundles `validate:packaged-openclaw-stats-ingestion` + `validate:packaged-openclaw-cache-recovery-e2e`) to guard the `stats --json` fallback path and packaged recovery behavior when probe output is noisy or stale.
- Trusted signed/notarized release path: `.github/workflows/release-macos-trusted.yml`

Trusted release workflow enforces stronger OpenClaw verification and expects these repository secrets:

- `MACOS_CODESIGN_IDENTITY`
- `APPLE_DEVELOPER_ID_APP_P12_BASE64`
- `APPLE_DEVELOPER_ID_APP_P12_PASSWORD`
- `APPLE_BUILD_KEYCHAIN_PASSWORD`
- `APPLE_NOTARY_KEY_ID`
- `APPLE_NOTARY_ISSUER_ID`
- `APPLE_NOTARY_API_KEY_P8`

When present, the workflow imports a temporary build keychain, signs `IdleWatch.app`, notarizes/staples the DMG, and uploads `IdleWatch-*-signed.dmg`.

Release policy gate:
- Trusted release workflow enforces OpenClaw resilience gate via `npm run validate:packaged-openclaw-release-gates` (runs `validate:packaged-usage-health`, `validate:packaged-openclaw-stats-ingestion`, and `validate:packaged-openclaw-cache-recovery-e2e`) before artifact upload. In release mode these checks run against the already-built signed app via `IDLEWATCH_SKIP_PACKAGE_MACOS=1` and enforce OpenClaw usage presence by default (`IDLEWATCH_REQUIRE_OPENCLAW_USAGE=1` unless explicitly disabled). Set `0|false|off|no` to disable and `1|true|on|yes` to force on.
- Trusted release workflow additionally enforces `IDLEWATCH_MAX_OPENCLAW_USAGE_AGE_MS=300000` so packaged rows fail if usage age is excessively stale at validation time.
- Packaging scripts now auto-enable strict trusted requirements on CI tag refs (`refs/tags/*`) to prevent accidental unsigned release artifacts; set `IDLEWATCH_ALLOW_UNSIGNED_TAG_RELEASE=1` only for deliberate break-glass exceptions.
- Packaged validators default to packaging a fresh app unless reuse mode is requested. `validate:packaged-dry-run-schema`, `validate:packaged-usage-age-slo`, and `validate:packaged-usage-health` still auto-run `package:macos` first; their `:reuse-artifact` counterparts assume a prebuilt artifact and set `IDLEWATCH_SKIP_PACKAGE_MACOS=1` to validate the already-built binary directly.
