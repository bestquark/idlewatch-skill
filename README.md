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

## Reliability improvements

- Local NDJSON durability log at `logs/<host>-metrics.ndjson` (override via `IDLEWATCH_LOCAL_LOG_PATH`)
- Retry-once+ for transient Firestore write failures
- Non-overlapping scheduler loop (prevents concurrent sample overlap when host is busy)
- Darwin GPU usage probing across multiple command shapes

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

## OpenClaw usage ingestion (best effort)

By default (`IDLEWATCH_OPENCLAW_USAGE=auto`), the agent attempts to read OpenClaw
session usage from local CLI JSON endpoints when available, then enriches samples with:

- `tokensPerMin`
- `openclawModel`
- `openclawTotalTokens`

If OpenClaw stats are unavailable, these fields are emitted as `null` and collection continues.
Set `IDLEWATCH_OPENCLAW_USAGE=off` to disable lookup.

## Packaging scaffold

DMG release scaffolding is included:

- `docs/packaging/macos-dmg.md`
- `scripts/package-macos.sh`
- `scripts/build-dmg.sh`
