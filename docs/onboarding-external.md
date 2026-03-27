# External onboarding + distribution

## Paths for external users

Command rule of thumb:
- global install → `idlewatch ...`
- one-off / no install → `npx idlewatch ...`
- packaged app → use the app-bundled script path shown below

### 1) npx quickstart (fastest)

```bash
npx idlewatch quickstart --no-tui
```

Use this path for the simplest one-off setup and foreground testing.

`idlewatch` is the default package/command name. `idlewatch-skill` remains available as a compatibility alias, but it should not be the main path shown to new users.

Wizard output:
- Prompts for a device name, API key, and which metrics to collect.
- Generates an env file (`idlewatch.env`) under the user config directory.
- Saves local config so later runs use the saved setup without manually sourcing the env file.
- Sends a first sample so the device can link right away.

### 2) Signed DMG install (managed rollout)

1. Build trusted artifacts:
   ```bash
   npm run package:trusted
   ```
2. Distribute `dist/IdleWatch-<version>-signed.dmg`.
3. User drags app into Applications and launches.
4. On first run, user executes quickstart from packaged app terminal context to link the device with an API key.

### Optional: background mode on macOS

Background mode needs a durable install. `npx idlewatch ...` is for one-off runs, not background-mode setup.

For a normal packaged-app install, turn on background mode with the script bundled inside the app:

```bash
/Applications/IdleWatch.app/Contents/Resources/payload/package/scripts/install-macos-launch-agent.sh
```

To turn background mode off later:

```bash
/Applications/IdleWatch.app/Contents/Resources/payload/package/scripts/uninstall-macos-launch-agent.sh
```

If you're working from a source checkout instead of the installed app, the maintainer/dev wrappers still exist:

```bash
npm run install:macos-launch-agent
npm run uninstall:macos-launch-agent
```

See `docs/packaging/macos-dmg.md` for signing/notarization setup.

## Credential strategy (least privilege)

- Use a dedicated API key per device or deployment environment.
- Avoid reusing broad admin credentials across developer laptops.
- Rotate keys periodically on idlewatch.com/api.
- For advanced Firebase mode: prefer `FIREBASE_SERVICE_ACCOUNT_FILE` over raw JSON env values, grant minimal Firestore write permissions, and rotate the local credential file path atomically.

## Automation validation

Run:

```bash
npm run validate:onboarding
```

This validates non-interactive enrollment output and secure credential file staging.
