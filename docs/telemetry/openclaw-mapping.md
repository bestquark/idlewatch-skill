# OpenClaw Telemetry Mapping for Fleet Aggregation

## Purpose

This spec defines a stable, versioned OpenClaw-focused telemetry envelope for fleet dashboards while preserving the existing flat IdleWatch row shape.

## Goals

- Keep existing flat fields fully backward compatible.
- Add a canonical `fleet` object for aggregation across hosts.
- Carry explicit provenance so operators can trust/triage usage data.
- Version the schema to support additive evolution.

## Schema contract (v1)

- `schemaFamily`: `idlewatch.openclaw.fleet`
- `schemaVersion`: `1.0.0`
- `schemaCompat`: `["0.x-flat-row"]`

### Backward compatibility

All prior top-level fields are retained (`cpuPct`, `memPct`, `tokensPerMin`, `openclaw*`, `source.*`, etc.).
Consumers using old selectors continue to work.

## Canonical mapping

### Fleet identity

- `fleet.host` ← `host`
- `fleet.collectedAtMs` ← `ts`

### Fleet resources (high-value host load)

- `fleet.resources.cpuPct` ← `cpuPct`
- `fleet.resources.memUsedPct` ← `memUsedPct` (fallback `memPct`)
- `fleet.resources.memPressurePct` ← `memPressurePct`
- `fleet.resources.memPressureClass` ← `memPressureClass`

### Fleet usage (OpenClaw)

- `fleet.usage.model` ← `openclawModel`
- `fleet.usage.totalTokens` ← `openclawTotalTokens`
- `fleet.usage.tokensPerMin` ← `tokensPerMin`
- `fleet.usage.sessionId` ← `openclawSessionId`
- `fleet.usage.agentId` ← `openclawAgentId`
- `fleet.usage.usageTimestampMs` ← `openclawUsageTs`
- `fleet.usage.usageAgeMs` ← `openclawUsageAgeMs`
- `fleet.usage.freshnessState` ← `source.usageFreshnessState`
- `fleet.usage.integrationStatus` ← `source.usageIntegrationStatus`
- `fleet.usage.ingestionStatus` ← `source.usageIngestionStatus`
- `fleet.usage.activityStatus` ← `source.usageActivityStatus`
- `fleet.usage.alertLevel` ← `source.usageAlertLevel`
- `fleet.usage.alertReason` ← `source.usageAlertReason`

### Provenance

- `fleet.provenance.collector` ← static `idlewatch-agent`
- `fleet.provenance.collectorVersion` ← package version
- `fleet.provenance.usageSource` ← `source.usage`
- `fleet.provenance.usageCommand` ← `source.usageCommand`
- `fleet.provenance.usageProbeResult` ← `source.usageProbeResult`
- `fleet.provenance.usageProbeAttempts` ← `source.usageProbeAttempts`
- `fleet.provenance.usageUsedFallbackCache` ← `source.usageUsedFallbackCache`
- `fleet.provenance.usageFallbackCacheSource` ← `source.usageFallbackCacheSource`

## Enrichment rollout plan

1. Emit `schemaFamily/schemaVersion/schemaCompat` + `fleet` object (additive only).
2. Keep legacy flat fields indefinitely during migration.
3. Dashboards/alerts migrate to `fleet.*` paths by domain:
   - capacity: `fleet.resources.*`
   - usage: `fleet.usage.*`
   - reliability: `fleet.provenance.*` + `fleet.usage.ingestionStatus`
4. Future changes are additive under v1; breaking path changes require v2.

## Fixtures and tests

- Fixture sample: `test/fixtures/openclaw-fleet-sample-v1.json`
- Mapping unit tests: `test/telemetry-mapping.test.mjs`
- Dry-run schema gate includes v1 checks: `scripts/validate-dry-run-schema.mjs`
