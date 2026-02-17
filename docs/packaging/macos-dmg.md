# macOS DMG packaging pipeline (scaffold)

This repository currently ships a Node CLI, not a notarized macOS app bundle.
A full DMG release requires signing identities, notarization credentials, and an
`.app` wrapper. Until those are available, use the scaffold scripts in `scripts/`
for CI wiring and local dry-runs.

## Prerequisites

- Xcode Command Line Tools (`xcode-select --install`)
- Node.js 20+ on target host (current scaffold launcher executes bundled payload with local `node`)
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
   - Stage Node runtime + CLI into `dist/IdleWatch.app/Contents/Resources/`
   - Add launcher script in `Contents/MacOS/IdleWatch`
3. **Codesign (optional in scaffold)**
   - Sign binaries with `codesign --deep --force --options runtime ...`
4. **Notarize (optional in scaffold)**
   - `xcrun notarytool submit ... --wait`
   - `xcrun stapler staple IdleWatch.app`
5. **Build DMG (optional in scaffold)**
   - `hdiutil create ...` (baseline)
   - or `create-dmg` for branded layout

## Current scaffold commands

Optional environment variables:
- `IDLEWATCH_OPENCLAW_BIN="/opt/homebrew/bin/openclaw"` — pins OpenClaw binary path for packaged/non-interactive runtime usage collection.
- `IDLEWATCH_NODE_BIN="/opt/homebrew/bin/node"` — pins Node binary path used by packaged app launcher.
- `IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS=2500` — per-probe timeout for OpenClaw usage commands.
- `MACOS_CODESIGN_IDENTITY="Developer ID Application: ..."` — signs `IdleWatch.app` during `package-macos.sh`.
- `MACOS_NOTARY_PROFILE="<keychain-profile>"` — notarizes/staples DMG during `build-dmg.sh`.
- `IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION=1` — strict mode; fails packaging unless signing/notarization prerequisites are present.

- `scripts/package-macos.sh`
  - Creates `dist/IdleWatch.app`
  - Bundles the generated `idlewatch-skill-<version>.tgz` and expands it into `Contents/Resources/payload/package`
  - Generates a working launcher (`Contents/MacOS/IdleWatch`) that runs:
    - `<node> Contents/Resources/payload/package/bin/idlewatch-agent.js ...`
    - Node binary resolution order: `IDLEWATCH_NODE_BIN` → `PATH` (`node`)
  - Stages `dist/dmg-root` and adds `/Applications` symlink
- `scripts/build-dmg.sh`
  - Creates `dist/IdleWatch-<version>-unsigned.dmg` (or `-signed.dmg` when `MACOS_CODESIGN_IDENTITY` is set) from `dist/dmg-root`
  - If `MACOS_NOTARY_PROFILE` is set, submits DMG via `notarytool` and staples on success
- `npm run validate:trusted-prereqs`
  - Validates local signing identity + notary keychain profile before running trusted packaging
- `npm run package:trusted`
  - Convenience strict path (`IDLEWATCH_REQUIRE_TRUSTED_DISTRIBUTION=1`) that now runs trusted-prereq validation before build/sign/notarize
- `npm run validate:dmg-install`
  - Mounts latest DMG (or a provided path), copies `IdleWatch.app` into a temp Applications-like folder, then validates launcher dry-run schema from the copied app

## CI integration

- Baseline packaging smoke: `.github/workflows/ci.yml` (`macos-packaging-smoke` job; includes packaged usage-age SLO gate via `npm run validate:packaged-usage-age-slo`, packaged stale-threshold recovery validation via `npm run validate:packaged-usage-recovery-e2e`, and DMG install validation via `npm run validate:dmg-install`)
- Trusted signed/notarized release path: `.github/workflows/release-macos-trusted.yml`

Trusted release workflow expects these repository secrets:

- `MACOS_CODESIGN_IDENTITY`
- `APPLE_DEVELOPER_ID_APP_P12_BASE64`
- `APPLE_DEVELOPER_ID_APP_P12_PASSWORD`
- `APPLE_BUILD_KEYCHAIN_PASSWORD`
- `APPLE_NOTARY_KEY_ID`
- `APPLE_NOTARY_ISSUER_ID`
- `APPLE_NOTARY_API_KEY_P8`

When present, the workflow imports a temporary build keychain, signs `IdleWatch.app`, notarizes/staples the DMG, and uploads `IdleWatch-*-signed.dmg`.

Release policy gate:
- Trusted release workflow enforces packaged dry-run OpenClaw usage availability (`source.usage=openclaw`) before artifact upload via `npm run validate:packaged-usage-health`.
- Trusted release workflow additionally enforces `IDLEWATCH_MAX_OPENCLAW_USAGE_AGE_MS=300000` so packaged rows fail if usage age is excessively stale at validation time.
- All packaged validators (`validate:packaged-dry-run-schema`, `validate:packaged-usage-health`, `validate:packaged-usage-age-slo`) auto-run `package:macos` first so checks always target fresh packaged bits.
