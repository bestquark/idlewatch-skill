# macOS DMG packaging pipeline (scaffold)

This repository currently ships a Node CLI, not a notarized macOS app bundle.
A full DMG release requires signing identities, notarization credentials, and an
`.app` wrapper. Until those are available, use the scaffold scripts in `scripts/`
for CI wiring and local dry-runs.

## Prerequisites

- Xcode Command Line Tools (`xcode-select --install`)
- Node.js 20+ on target host (current scaffold launcher depends on `npx`)
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
- `MACOS_CODESIGN_IDENTITY="Developer ID Application: ..."` — signs `IdleWatch.app` during `package-macos.sh`.
- `MACOS_NOTARY_PROFILE="<keychain-profile>"` — notarizes/staples DMG during `build-dmg.sh`.

- `scripts/package-macos.sh`
  - Creates `dist/IdleWatch.app`
  - Bundles the generated `idlewatch-skill-<version>.tgz`
  - Generates a working launcher (`Contents/MacOS/IdleWatch`) that runs:
    - `npx --yes --package <bundled-tgz> idlewatch-agent ...`
  - Stages `dist/dmg-root` and adds `/Applications` symlink
- `scripts/build-dmg.sh`
  - Creates `dist/IdleWatch-<version>-unsigned.dmg` (or `-signed.dmg` when `MACOS_CODESIGN_IDENTITY` is set) from `dist/dmg-root`
  - If `MACOS_NOTARY_PROFILE` is set, submits DMG via `notarytool` and staples on success

## CI integration suggestion

```yaml
# .github/workflows/release.yml
- run: npm ci
- run: npm test
- run: ./scripts/package-macos.sh
- run: ./scripts/build-dmg.sh
```

Add secrets for signing and notarization before enabling release uploads.
