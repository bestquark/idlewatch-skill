# External onboarding + distribution

## Paths for external users

### 1) npx quickstart (fastest)

```bash
npx idlewatch-skill quickstart
```

Wizard output:
- Prompts for a device name, API key, and which metrics to collect.
- Generates an env file (`idlewatch.env`) under the user config directory.
- Saves local config so later runs auto-load without manually sourcing the env file.
- Sends a first sample so the device can link right away.

### 2) Signed DMG install (managed rollout)

1. Build trusted artifacts:
   ```bash
   npm run package:trusted
   ```
2. Distribute `dist/IdleWatch-<version>-signed.dmg`.
3. User drags app into Applications and launches.
4. On first run, user executes quickstart from packaged app terminal context to link the device with an API key.

### Optional: background startup on macOS

Users can register the packaged app for background startup with LaunchAgent:

```bash
npm run install:macos-launch-agent
```

To remove the LaunchAgent later:

```bash
npm run uninstall:macos-launch-agent
```

See `docs/packaging/macos-dmg.md` for signing/notarization setup.

## Credential strategy (least privilege)

- Prefer `FIREBASE_SERVICE_ACCOUNT_FILE` over raw JSON env values.
- Use a dedicated service account per deployment environment.
- Grant minimal Firestore write permissions needed for telemetry ingestion.
- Avoid reusing broad admin credentials across developer laptops.
- Rotate keys periodically and replace the local credential file path atomically.

## Automation validation

Run:

```bash
npm run validate:onboarding
```

This validates non-interactive enrollment output and secure credential file staging.
