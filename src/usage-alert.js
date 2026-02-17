export function deriveUsageAlert(source) {
  const ingestion = source?.usageIngestionStatus
  const activity = source?.usageActivityStatus
  const nearStale = source?.usageNearStale === true
  const pastStaleThreshold = source?.usagePastStaleThreshold === true

  if (ingestion === 'disabled') {
    return { level: 'off', reason: 'usage-disabled' }
  }

  if (ingestion === 'unavailable') {
    return { level: 'critical', reason: 'ingestion-unavailable' }
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
