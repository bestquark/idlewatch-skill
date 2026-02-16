# idlewatch-skill

Telemetry collector for IdleWatch.

## Run

```bash
npm install
npm start
```

or with npx after publish:

```bash
npx idlewatch-skill
```

## Firebase wiring

```bash
export FIREBASE_PROJECT_ID=your-project
export FIREBASE_SERVICE_ACCOUNT_B64=$(base64 -i serviceAccount.json)
```

## Local-only mode

Without Firebase env vars, it logs JSON telemetry to stdout only.
