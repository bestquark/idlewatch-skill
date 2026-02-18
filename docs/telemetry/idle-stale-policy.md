# OpenClaw Usage Staleness & Idle Policy

## Overview

When IdleWatch monitors OpenClaw usage via `openclaw status --json`, the
`openclawUsageAgeMs` field reflects how long ago the most recent session
activity occurred. During periods of user inactivity (no prompts, no agent
turns), this age grows continuously.

## Expected behavior during idle

| Condition | `usageFreshnessState` | `usageAlertLevel` | `usageAlertReason` |
|---|---|---|---|
| Age < `IDLEWATCH_USAGE_NEAR_STALE_MS` | `fresh` | `ok` | `healthy` |
| Age ≥ near-stale threshold | `fresh` (aging) | `ok` | `healthy` |
| Age ≥ `IDLEWATCH_USAGE_STALE_MS` + grace | `stale` | `warning` | `activity-past-threshold` |
| Age ≥ `IDLEWATCH_USAGE_IDLE_AFTER_MS` (6h default) | `stale` | `idle` | `idle-expected` |

## Why stale/warning is normal during idle

OpenClaw's `status --json` reports the timestamp of the **last session
activity**. If no one is using the assistant, the age naturally grows past the
stale threshold (default 60s + 10s grace). This does **not** indicate a
monitoring failure — it indicates the assistant is simply idle.

The `warning` alert level means "usage data is stale relative to the
freshness SLO" — it is an **informational signal**, not an error. Operators
should treat sustained `warning` during known idle windows (nights,
weekends) as normal.

## When to investigate

- `warning` persisting during **active** usage sessions (the assistant is
  being used but IdleWatch still reports stale) → probe or parse failure.
- `usageIngestionStatus` is not `ok` → the probe itself is broken.
- `usageProbeResult` shows `command-error` or `parse-error` → OpenClaw CLI
  issue.

## Thresholds

| Env var | Default | Description |
|---|---|---|
| `IDLEWATCH_USAGE_STALE_MS` | `max(interval×3, 60000)` | Age beyond which usage is stale |
| `IDLEWATCH_USAGE_NEAR_STALE_MS` | `floor((stale+grace)×0.85)` | Pre-stale aging signal |
| `IDLEWATCH_USAGE_STALE_GRACE_MS` | `min(interval, 10000)` | Grace window before stale alert |
| `IDLEWATCH_USAGE_IDLE_AFTER_MS` | `21600000` (6h) | Downgrade stale→idle after this age |
| `IDLEWATCH_MAX_OPENCLAW_USAGE_AGE_MS` | `600000` (10m) | SLO validator threshold |

## Dashboard guidance

- Filter alerts: suppress `warning` when `usageAlertReason` is
  `activity-past-threshold` during off-hours.
- Use `idle` alert level (after 6h) as a positive signal that the host is
  inactive rather than broken.
- Key reliability signals: `usageIngestionStatus` and `usageProbeResult`.
  If both are `ok`, the monitoring pipeline is healthy regardless of
  freshness state.
