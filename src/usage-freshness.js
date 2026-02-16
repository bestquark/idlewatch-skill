export function deriveUsageFreshness(usage, nowMs, staleMs) {
  const usageTs = usage?.usageTimestampMs
  if (typeof usageTs !== 'number' || !Number.isFinite(usageTs)) {
    return { usageAgeMs: null, isStale: false }
  }

  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) {
    return { usageAgeMs: null, isStale: false }
  }

  const ageMs = nowMs - usageTs
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return { usageAgeMs: null, isStale: false }
  }

  const thresholdMs = typeof staleMs === 'number' && Number.isFinite(staleMs) && staleMs > 0 ? staleMs : null

  return {
    usageAgeMs: ageMs,
    isStale: thresholdMs === null ? false : ageMs > thresholdMs
  }
}
