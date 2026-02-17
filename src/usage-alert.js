export function deriveUsageAlert(source, options = {}) {
  const ingestion = source?.usageIngestionStatus
  const activity = source?.usageActivityStatus
  const nearStale = source?.usageNearStale === true
  const pastStaleThreshold = source?.usagePastStaleThreshold === true
  const usageAgeMs = Number.isFinite(options?.usageAgeMs) ? options.usageAgeMs : null
  const idleAfterMs = Number.isFinite(options?.idleAfterMs) && options.idleAfterMs > 0 ? options.idleAfterMs : null
  const isIdle = idleAfterMs !== null && usageAgeMs !== null && usageAgeMs >= idleAfterMs

  if (ingestion === 'disabled') {
    return { level: 'off', reason: 'usage-disabled' }
  }

  if (ingestion === 'unavailable') {
    return { level: 'critical', reason: 'ingestion-unavailable' }
  }

  if (isIdle) {
    return { level: 'notice', reason: 'activity-idle' }
  }

  if (activity === 'stale') {
    return { level: 'warning', reason: 'activity-stale' }
  }

  if (pastStaleThreshold) {
    return { level: 'warning', reason: 'activity-past-threshold' }
  }

  if (nearStale) {
    return { level: 'notice', reason: 'activity-near-stale' }
  }

  return { level: 'ok', reason: 'healthy' }
}
