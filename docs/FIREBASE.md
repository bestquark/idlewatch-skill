# Advanced Firebase Wiring (Self-Hosted)

Most users don't need this — the cloud API key from `idlewatch.com/api` handles everything. This guide is for self-hosted Firebase ingest.

## Manual wiring

```bash
export FIREBASE_PROJECT_ID=your-project
export FIREBASE_SERVICE_ACCOUNT_FILE="$HOME/.idlewatch/credentials/your-project-service-account.json"
```

Raw JSON and base64 are still supported for compatibility, but **file-path credentials are preferred**:

```bash
export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
# or
export FIREBASE_SERVICE_ACCOUNT_B64=$(base64 -i serviceAccount.json)
```

## Firestore emulator mode

No service-account JSON required:

```bash
export FIREBASE_PROJECT_ID=idlewatch-dev
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

## Least-privilege guidance

- Create a dedicated IdleWatch writer service account per environment/project.
- Grant only the Firestore write scope needed for `metrics` ingestion (avoid Owner/Editor roles).
- Store credentials as a file with user-only permissions (`chmod 600`) and reference via `FIREBASE_SERVICE_ACCOUNT_FILE`.

## Behavior

- If Firebase env vars are incomplete or invalid, the CLI exits with a clear configuration error.
- If Firebase vars are omitted entirely, it runs in local-only mode and prints telemetry to stdout.
- `firebase-admin` is loaded lazily only when Firebase publish mode is configured, so dry-run/local-only flows remain resilient in minimal packaged/runtime environments.
- Set `IDLEWATCH_REQUIRE_FIREBASE_WRITES=1` to fail fast when running `--once` without a working Firebase publish path.
