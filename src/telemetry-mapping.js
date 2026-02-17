export const OPENCLAW_FLEET_SCHEMA = Object.freeze({
  family: 'idlewatch.openclaw.fleet',
  version: '1.0.0',
  backwardCompatibleWith: ['0.x-flat-row']
})

export function enrichWithOpenClawFleetTelemetry(sample, context = {}) {
  const host = context.host ?? sample.host ?? null
  const collector = context.collector ?? 'idlewatch-agent'
  const collectorVersion = context.collectorVersion ?? null
  const collectedAtMs = context.collectedAtMs ?? sample.ts ?? null

  return {
    ...sample,
    schemaFamily: OPENCLAW_FLEET_SCHEMA.family,
    schemaVersion: OPENCLAW_FLEET_SCHEMA.version,
    schemaCompat: OPENCLAW_FLEET_SCHEMA.backwardCompatibleWith,
    fleet: {
      host,
      collectedAtMs,
      resources: {
        cpuPct: sample.cpuPct ?? null,
        memUsedPct: sample.memUsedPct ?? sample.memPct ?? null,
        memPressurePct: sample.memPressurePct ?? null,
        memPressureClass: sample.memPressureClass ?? 'unavailable'
      },
      usage: {
        model: sample.openclawModel ?? null,
        totalTokens: sample.openclawTotalTokens ?? null,
        tokensPerMin: sample.tokensPerMin ?? null,
        sessionId: sample.openclawSessionId ?? null,
        agentId: sample.openclawAgentId ?? null,
        usageTimestampMs: sample.openclawUsageTs ?? null,
        usageAgeMs: sample.openclawUsageAgeMs ?? null,
        freshnessState: sample.source?.usageFreshnessState ?? null,
        integrationStatus: sample.source?.usageIntegrationStatus ?? 'unavailable',
        ingestionStatus: sample.source?.usageIngestionStatus ?? 'unavailable',
        activityStatus: sample.source?.usageActivityStatus ?? 'unavailable',
        alertLevel: sample.source?.usageAlertLevel ?? 'critical',
        alertReason: sample.source?.usageAlertReason ?? 'ingestion-unavailable'
      },
      provenance: {
        collector,
        collectorVersion,
        usageSource: sample.source?.usage ?? 'unavailable',
        usageCommand: sample.source?.usageCommand ?? null,
        usageProbeResult: sample.source?.usageProbeResult ?? 'unavailable',
        usageProbeAttempts: sample.source?.usageProbeAttempts ?? 0,
        usageUsedFallbackCache: sample.source?.usageUsedFallbackCache ?? false,
        usageFallbackCacheSource: sample.source?.usageFallbackCacheSource ?? null
      }
    }
  }
}
