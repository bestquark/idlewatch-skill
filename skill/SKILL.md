---
name: idlewatch
description: Collect host CPU/memory/GPU and token telemetry and stream to Firebase Firestore.
---

# IdleWatch Skill

Install (npm package):

```bash
npx idlewatch-skill
```

Run collector:

```bash
idlewatch-agent
```

Environment:

- `IDLEWATCH_HOST` optional custom host label
- `IDLEWATCH_INTERVAL_MS` sampling interval (default 10000)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_B64` base64 JSON service account

Output fields:

- `cpuPct`
- `memPct`
- `gpuPct` (darwin best-effort)
- `tokensPerMin` (placeholder until direct OpenClaw usage integration)
