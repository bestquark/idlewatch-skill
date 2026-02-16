# idlewatch-skill

Telemetry collector for IdleWatch.

## Install / Run

```bash
npm install
npm start
```

With npx (after publish):

```bash
npx idlewatch-skill --help
npx idlewatch-skill --dry-run
```

## CLI options

- `--help`: show usage
- `--dry-run`: collect one sample and exit (no Firebase write)

## Firebase wiring

Copy `.env.example` and set:

```bash
export FIREBASE_PROJECT_ID=your-project
export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

Legacy (still supported):

```bash
export FIREBASE_SERVICE_ACCOUNT_B64=$(base64 -i serviceAccount.json)
```

If Firebase env vars are incomplete or invalid, the CLI exits with a clear configuration error.
If Firebase vars are omitted entirely, it runs in local-only mode and prints telemetry to stdout.
