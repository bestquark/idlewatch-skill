export function deriveUsageFreshness(usage, nowMs, staleMs, nearStaleMs = null) {
  const usageTs = usage?.usageTimestampMs
  if (typeof usageTs !== 'number' || !Number.isFinite(usageTs)) {
    return { usageAgeMs: null, isStale: false, isNearStale: false, freshnessState: 'unknown' }
  }

  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) {
    return { usageAgeMs: null, isStale: false, isNearStale: false, freshnessState: 'unknown' }
  }

  const ageMs = nowMs - usageTs
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return { usageAgeMs: null, isStale: false, isNearStale: false, freshnessState: 'unknown' }
  }

  const staleThresholdMs = typeof staleMs === 'number' && Number.isFinite(staleMs) && staleMs > 0 ? staleMs : null
  const nearThresholdMs = typeof nearStaleMs === 'number' && Number.isFinite(nearStaleMs) && nearStaleMs > 0 ? nearStaleMs : null
  const isStale = staleThresholdMs === null ? false : ageMs > staleThresholdMs
  const isNearStale = nearThresholdMs === null ? false : ageMs >= nearThresholdMs

  return {
    usageAgeMs: ageMs,
    isStale,
    isNearStale,
    freshnessState: isStale ? 'stale' : (isNearStale ? 'aging' : 'fresh')
  }
}
