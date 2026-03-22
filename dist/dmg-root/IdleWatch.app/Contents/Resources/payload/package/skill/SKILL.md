---
name: idlewatch
description: Collect host CPU/memory/GPU and token telemetry and stream to Firebase Firestore.
---

# IdleWatch Skill

Install (npm package):

```bash
npx idlewatch-skill --help
```

Run collector:

```bash
idlewatch-agent
```

Dry-run once (no Firestore write):

```bash
idlewatch-agent --dry-run
```

Environment:

- `IDLEWATCH_HOST` optional custom host label
- `IDLEWATCH_INTERVAL_MS` sampling interval (default 10000)
- `IDLEWATCH_LOCAL_LOG_PATH` optional local NDJSON durability log path
- `IDLEWATCH_OPENCLAW_USAGE` usage lookup mode (`auto` or `off`)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` (preferred)
- `FIREBASE_SERVICE_ACCOUNT_B64` (legacy)

Output fields:

- `cpuPct`
- `memPct`
- `gpuPct` (darwin best-effort)
- `tokensPerMin` (OpenClaw usage when available)
- `openclawModel`
- `openclawTotalTokens`
