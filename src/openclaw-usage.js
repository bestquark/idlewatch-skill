function pickNumber(...vals) {
  for (const val of vals) {
    if (typeof val === 'number' && Number.isFinite(val)) return val
    if (typeof val === 'string') {
      const normalized = val.trim()
      if (!normalized) continue
      const parsed = Number(normalized)
      if (Number.isFinite(parsed)) return parsed

      const asDate = Date.parse(normalized)
      if (!Number.isNaN(asDate)) return asDate
    }
  }
  return null
}

function pickTimestamp(...vals) {
  for (const val of vals) {
    if (val === null || typeof val === 'undefined') continue

    if (typeof val === 'number' && Number.isFinite(val)) {
      const numeric = val
      if (Number.isInteger(numeric) && numeric > 0 && numeric < 1_000_000_000_000) return numeric * 1000
      return numeric
    }

    if (typeof val === 'string') {
      const normalized = val.trim()
      if (!normalized) continue

      const parsed = Number(normalized)
      if (Number.isFinite(parsed)) {
        if (Number.isInteger(parsed) && parsed > 0 && parsed < 1_000_000_000_000) return parsed * 1000
        return parsed
      }

      const asDate = Date.parse(normalized)
      if (!Number.isNaN(asDate)) return asDate
    }
  }
  return null
}

function pickString(...vals) {
  for (const val of vals) {
    if (typeof val === 'string' && val.trim()) return val
    if (val instanceof String && val.toString().trim()) return val.toString().trim()
  }
  return null
}

function isFreshTokenMarker(value) {
  if (value === false || value === 0) return false
  if (value === null || typeof value === 'undefined') return true
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return true
    if (['false', '0', 'no', 'off', 'stale'].includes(normalized)) return false
    if (['true', '1', 'yes', 'on', 'fresh'].includes(normalized)) return true
  }
  return Boolean(value)
}

function pickNestedTotalsTokens(candidate) {
  if (!candidate || typeof candidate !== 'object') return null

  const totalsRoot = candidate.totals || candidate.summary || candidate.usageTotals || candidate.usage?.totals || candidate.usage?.summary
  const usageTotals = candidate.usage || {}

  return pickNumber(
    totalsRoot?.totalTokens,
    totalsRoot?.total_tokens,
    totalsRoot?.total,
    totalsRoot?.tokens?.total,
    totalsRoot?.tokens?.sum,
    totalsRoot?.tokenCount,
    totalsRoot?.token_count,
    totalsRoot?.count,
    totalsRoot?.cumulativeTokens,
    totalsRoot?.usageTokens,
    totalsRoot?.cumulative,
    candidate.totalTokens,
    candidate.total_tokens,
    candidate.total_tokens_count,
    usageTotals.totalTokens,
    usageTotals.total_tokens,
    usageTotals.tokenCount,
    usageTotals.total,
    usageTotals.tokens?.total,
    usageTotals.tokens?.sum,
    usageTotals.inputTokens && usageTotals.outputTokens ? usageTotals.inputTokens + usageTotals.outputTokens : null,
    candidate.inputTokens && candidate.outputTokens ? candidate.inputTokens + candidate.outputTokens : null,
    candidate.tokenUsage?.total,
    candidate.token_usage?.total
  )
}

function deriveTokensPerMinute(session) {
  const totalTokens = pickNumber(session?.totalTokens, session?.total_tokens, pickNestedTotalsTokens(session))
  const ageMs = pickNumber(session?.ageMs, session?.age)
  if (totalTokens === null || ageMs === null || ageMs <= 0) return null

  const minutes = ageMs / 60000
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  return Number((totalTokens / minutes).toFixed(2))
}

function pickNewestSession(sessions = []) {
  return sessions.reduce((best, candidate) => {
    if (!best) return candidate

    const pickSessionTs = (item) => {
      const age = pickNumber(item?.age, item?.ageMs)
      const absolute = pickTimestamp(item?.updatedAt, item?.updated_at, item?.updatedAtMs, item?.createdAt, item?.created_at, item?.ts, item?.time)
      return absolute ?? (Number.isFinite(age) && age >= 0 ? Date.now() - age : null)
    }

    const bestTs = pickSessionTs(best)
    const candidateTs = pickSessionTs(candidate)

    if (candidateTs === null) return best
    if (bestTs === null || candidateTs > bestTs) return candidate
    return best
  }, null)
}

function pickBestRecentSession(recent = []) {
  if (!Array.isArray(recent) || recent.length === 0) return null

  const withFreshTokens = recent.filter((session) => {
    const totalTokens = pickNumber(session?.totalTokens, session?.total_tokens, pickNestedTotalsTokens(session))
    return totalTokens !== null && isFreshTokenMarker(session?.totalTokensFresh)
  })
  const freshestWithTokens = pickNewestSession(withFreshTokens)
  if (freshestWithTokens) return freshestWithTokens

  const anyWithTokens = recent.filter((session) => pickNumber(session?.totalTokens, session?.total_tokens, pickNestedTotalsTokens(session)) !== null)
  const newestWithTokens = pickNewestSession(anyWithTokens)
  if (newestWithTokens) return newestWithTokens

  return pickNewestSession(recent) || recent[0]
}

function extractJsonCandidates(raw) {
  const text = String(raw)
  const candidates = []

  for (let start = 0; start < text.length; start += 1) {
    const open = text[start]
    if (open !== '{' && open !== '[') continue

    const close = open === '{' ? '}' : ']'
    let depth = 0
    let inString = false
    let escaped = false
    let end = -1

    for (let i = start; i < text.length; i++) {
      const ch = text[i]

      if (inString) {
        if (escaped) {
          escaped = false
        } else if (ch === '\\') {
          escaped = true
        } else if (ch === '"') {
          inString = false
        }
        continue
      }

      if (ch === '"') {
        inString = true
        continue
      }

      if (ch === open) {
        depth += 1
        continue
      }

      if (ch === close) {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }

        if (depth < 0) {
          break
        }
      }
    }

    if (end > start) {
      candidates.push(text.slice(start, end + 1))
      start = end
    }
  }

  return candidates
}

function hasAnySessionSignal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const directSignals = [
    value.sessionId,
    value.session_id,
    value.id,
    value.agentId,
    value.agent_id,
    value.model,
    value.modelName,
    value.totalTokens,
    value.total_tokens,
    value.inputTokens,
    value.outputTokens,
    value.age,
    value.ageMs,
    value.updatedAt,
    value.updated_at,
    value.updatedAtMs,
    value.ts,
    value.time,
    value.timestamp,
    value.timestampMs,
    value.tsMs,
    value.usageTs
  ]

  if (directSignals.some((field) => Number.isFinite(Number(field)) || (typeof field === 'string' && field.trim().length > 0) || field === true || field === false)) {
    return true
  }

  return (
    hasAnySessionSignal(value?.usage) ||
    hasAnySessionSignal(value?.usageTotals) ||
    hasAnySessionSignal(value?.result) ||
    hasAnySessionSignal(value?.session)
  )
}

function coerceSessionCandidates(value, options = {}) {
  const skipKeys = new Set(options.skipKeys || [])

  if (Array.isArray(value)) {
    return value.length > 0 ? value : null
  }

  if (value && typeof value === 'object') {
    if (hasAnySessionSignal(value)) return [value]

    const fromObject = Object.entries(value)
      .filter(([key, entry]) => !skipKeys.has(key))
      .map((entry) => entry[1])
      .filter((entry) => {
        if (!entry || typeof entry !== 'object') return false
        if (Array.isArray(entry)) return entry.length > 0
        if (!hasAnySessionSignal(entry)) return false
        return true
      })

    if (fromObject.length > 0) return fromObject
  }

  return null
}

function collectStatusSessionCandidates(parsed) {
  const candidateRoots = [
    parsed?.sessions?.recent,
    parsed?.sessions?.recentSessions,
    parsed?.sessions?.activeSessions,
    parsed?.sessions?.active,
    parsed?.sessions?.session,
    parsed?.sessions?.activeSession,
    parsed?.sessions?.current,
    parsed?.sessions?.currentSession,
    parsed?.recentSessions,
    parsed?.activeSessions,
    parsed?.active,
    parsed?.recent,
    parsed?.session,
    parsed?.activeSession,
    parsed?.current,
    parsed?.currentSession,
    parsed?.result?.sessions?.recent,
    parsed?.result?.sessions?.recentSessions,
    parsed?.result?.sessions?.activeSessions,
    parsed?.result?.sessions?.active,
    parsed?.result?.sessions?.session,
    parsed?.result?.sessions?.activeSession,
    parsed?.result?.sessions?.current,
    parsed?.result?.sessions?.currentSession,
    parsed?.result?.sessions,
    parsed?.result?.recentSessions,
    parsed?.result?.activeSessions,
    parsed?.result?.active,
    parsed?.result?.activeSession,
    parsed?.result?.session,
    parsed?.result?.current,
    parsed?.result?.currentSession,
    parsed?.result?.data?.sessions?.recent,
    parsed?.result?.data?.sessions?.recentSessions,
    parsed?.result?.data?.sessions?.activeSessions,
    parsed?.result?.data?.sessions?.active,
    parsed?.result?.data?.sessions?.session,
    parsed?.result?.data?.sessions?.activeSession,
    parsed?.result?.data?.sessions?.current,
    parsed?.result?.data?.sessions?.currentSession,
    parsed?.result?.data?.recentSessions,
    parsed?.result?.data?.activeSessions,
    parsed?.result?.data?.active,
    parsed?.result?.data?.activeSession,
    parsed?.result?.data?.session,
    parsed?.result?.data?.current,
    parsed?.result?.data?.currentSession,
    parsed?.result?.data,
    parsed?.result,
    parsed?.data?.result?.session,
    parsed?.data?.result?.active,
    parsed?.data?.result?.activeSession,
    parsed?.data?.result?.current,
    parsed?.data?.result?.currentSession,
    parsed?.data?.result?.sessions?.recent,
    parsed?.data?.result?.sessions?.recentSessions,
    parsed?.data?.result?.sessions?.activeSessions,
    parsed?.data?.result?.sessions?.active,
    parsed?.data?.result?.sessions?.session,
    parsed?.data?.result?.sessions?.activeSession,
    parsed?.data?.result?.sessions?.current,
    parsed?.data?.result?.sessions?.currentSession,
    parsed?.data?.sessions?.recent,
    parsed?.data?.sessions?.recentSessions,
    parsed?.data?.sessions?.activeSessions,
    parsed?.data?.sessions?.active,
    parsed?.data?.sessions?.session,
    parsed?.data?.sessions?.activeSession,
    parsed?.data?.sessions?.current,
    parsed?.data?.sessions?.currentSession,
    parsed?.data?.recentSessions,
    parsed?.data?.activeSessions,
    parsed?.data?.active,
    parsed?.data?.recent,
    parsed?.data?.session,
    parsed?.data?.activeSession,
    parsed?.data?.current,
    parsed?.data?.currentSession,
    parsed?.data?.sessions,
    parsed?.sessions
  ]

  for (const root of candidateRoots) {
    const normalized = coerceSessionCandidates(root, { skipKeys: ['defaults', 'metadata', 'config'] })
    if (normalized && normalized.length > 0) return normalized
  }

  return null
}

function parseFromStatusJson(parsed) {
  const sessionsRoot = collectStatusSessionCandidates(parsed)
  const defaults = parsed?.sessions?.defaults || parsed?.defaults || parsed?.result?.defaults || parsed?.data?.defaults ||
    (parsed?.result?.defaultModel || parsed?.result?.default_model
      ? { model: parsed.result.defaultModel || parsed.result.default_model }
      : parsed?.result?.data?.defaultModel || parsed?.result?.data?.default_model
        ? { model: parsed.result.data.defaultModel || parsed.result.data.default_model }
        : parsed?.config?.defaultModel || parsed?.config?.default_model
          ? { model: parsed.config.defaultModel || parsed.config.default_model }
          : {})
  const session = pickBestRecentSession(sessionsRoot)

  if (!session) {
    if (parsed?.stats || parsed?.usage || parsed?.sessionUsage || parsed?.data?.stats || parsed?.data?.usage || parsed?.data?.sessionUsage) {
      return null
    }

    const defaultsModel = pickString(
      defaults.model,
      defaults.defaultModel,
      defaults?.default_model,
      parsed?.defaultModel,
      parsed?.default_model,
      parsed?.result?.defaultModel,
      parsed?.result?.default_model,
      parsed?.data?.defaultModel,
      parsed?.data?.default_model
    )
    if (!defaultsModel) return null
    return {
      model: defaultsModel,
      totalTokens: null,
      tokensPerMin: null,
      sessionId: null,
      agentId: null,
      usageTimestampMs: pickTimestamp(parsed?.ts, parsed?.time, parsed?.timestamp, parsed?.tsMs, parsed?.timestampMs, parsed?.usageTs, parsed?.usageTimestampMs, parsed?.usage_timestamp),
      integrationStatus: 'partial'
    }
  }

  const model = pickString(
    session.model,
    session.modelName,
    defaults.model,
    parsed?.default_model,
    session?.usage?.model,
    parsed?.defaultModel,
    parsed?.result?.defaultModel,
    parsed?.result?.default_model,
    parsed?.data?.defaultModel,
    parsed?.data?.default_model
  )
  const totalTokens = pickNumber(
    session.totalTokens,
    session.total_tokens,
    pickNestedTotalsTokens(session),
    session?.usage?.totalTokens,
    session?.usage?.total_tokens,
    session?.usage?.tokenCount,
    session?.usage?.token_count
  )
  const tokensPerMin = pickNumber(
    session.tokensPerMinute,
    session.tokens_per_minute,
    session.tpm,
    session.rate,
    session?.usage?.tokensPerMinute,
    session?.usage?.tokens_per_minute,
    session?.usage?.tpm,
    session?.usage?.tokenRate,
    deriveTokensPerMinute(session),
    pickNumber(session?.derived?.tokensPerMinute, session?.derived?.tpm)
  )
  const sessionAgeMs = pickNumber(session.age, session.ageMs)
  const usageTimestampMs =
    pickTimestamp(
      session.updatedAt,
      session.updated_at,
      session.updatedAtMs,
      session.timestamp,
      session.time,
      session.usageTs,
      session.tsMs,
      session?.usage?.updatedAt,
      session?.usage?.updated_at,
      session?.usage?.updatedAtMs,
      session?.usage?.timestamp,
      session?.usage?.ts,
      session?.usage?.tsMs,
      session?.usage?.time,
      session?.usage?.usageTs,
      parsed?.ts,
      parsed?.time,
      parsed?.timestamp,
      parsed?.tsMs,
      parsed?.timestampMs,
      parsed?.usageTs,
      parsed?.usage_timestamp,
      parsed?.updatedAt,
      parsed?.updated_at,
      parsed?.updatedAtMs
    ) ??
    (Number.isFinite(sessionAgeMs) && sessionAgeMs >= 0 ? Date.now() - sessionAgeMs : pickTimestamp(parsed?.ts, parsed?.time, parsed?.updatedAt, parsed?.updated_at, parsed?.updatedAtMs, parsed?.timestamp))

  const hasStrongUsage = model !== null || totalTokens !== null || tokensPerMin !== null

  return {
    model,
    totalTokens,
    tokensPerMin,
    sessionId: pickString(session.sessionId, session.id, session?.usage?.sessionId, session?.usage?.id, session?.session_id),
    agentId: pickString(session.agentId, session?.usage?.agentId, session?.agent_id),
    usageTimestampMs,
    integrationStatus: hasStrongUsage ? 'ok' : 'partial'
  }
}

function parseGenericUsage(parsed) {
  const usage = parsed?.usage || parsed?.sessionUsage || parsed?.stats || parsed?.data?.usage || parsed?.data?.sessionUsage || parsed?.data?.stats || parsed?.current || parsed?.session || parsed?.result?.current || parsed?.data?.current || parsed?.result?.session || parsed?.data?.session || parsed
  const usageTotals = usage?.totals || usage?.summary || usage?.usageTotals || usage?.usage?.totals || usage?.usage?.summary
  const model = pickString(parsed?.model, parsed?.default_model, parsed?.modelName, usage?.model, usage?.modelName, usageTotals?.model, usage?.modelName, parsed?.result?.model, parsed?.data?.model, parsed?.data?.defaultModel, parsed?.data?.default_model)
  const totalTokens = pickNumber(
    usage?.totalTokens,
    usage?.total_tokens,
    usage?.tokenCount,
    usage?.token_count,
    usage?.tokens,
    usage?.tokenUsage?.total,
    usage?.token_usage?.total,
    usage?.tokens?.total,
    usage?.tokens?.sum,
    usage?.inputTokens && usage?.outputTokens ? usage.inputTokens + usage.outputTokens : null,
    usage?.input_tokens && usage?.output_tokens ? usage.input_tokens + usage.output_tokens : null,
    usageTotals?.total,
    usageTotals?.totalTokens,
    usageTotals?.total_tokens,
    usageTotals?.tokenCount,
    usageTotals?.token_count,
    usageTotals?.tokens?.total,
    usageTotals?.tokens?.sum,
    usageTotals?.inputTokens && usageTotals?.outputTokens ? usageTotals.inputTokens + usageTotals.outputTokens : null,
    usageTotals?.input_tokens && usageTotals?.output_tokens ? usageTotals.input_tokens + usageTotals.output_tokens : null,
    parsed?.totals?.total,
    parsed?.totals?.tokenCount,
    parsed?.totals?.total_tokens
  )
  const tokensPerMin = pickNumber(
    usage?.tokensPerMinute,
    usage?.tokens_per_minute,
    usage?.tpm,
    usage?.tokenRate,
    usage?.requestsPerMinute,
    usage?.rps,
    usage?.tokens?.perMin,
    usage?.tokens?.perMinute,
    usageTotals?.tokensPerMinute,
    usageTotals?.tokens_per_minute,
    usageTotals?.rps,
    parsed?.rps,
    parsed?.requestsPerMinute
  )

  if (model === null && totalTokens === null && tokensPerMin === null) return null

  return {
    model,
    totalTokens,
    tokensPerMin,
    sessionId: pickString(parsed?.sessionId, parsed?.session_id, usage?.sessionId, usage?.session_id, usage?.id),
    agentId: pickString(parsed?.agentId, parsed?.agent_id, usage?.agentId, usage?.agent_id),
    usageTimestampMs: pickTimestamp(
      usage?.updatedAt,
      usage?.updated_at,
      usage?.updatedAtMs,
      usage?.ts,
      usage?.time,
      usage?.timestamp,
      usage?.tsMs,
      usage?.timestampMs,
      usage?.usageTs,
      usage?.usage_timestamp,
      usage?.usageTimestampMs,
      usageTotals?.updatedAt,
      usageTotals?.updated_at,
      usageTotals?.updatedAtMs,
      usageTotals?.ts,
      usageTotals?.time,
      usageTotals?.timestamp,
      usageTotals?.timestampMs,
      usageTotals?.tsMs,
      usageTotals?.usageTs,
      usageTotals?.usage_timestamp,
      parsed?.ts,
      parsed?.time,
      parsed?.timestamp,
      parsed?.tsMs,
      parsed?.timestampMs,
      parsed?.usageTs,
      parsed?.usage_timestamp,
      parsed?.updatedAt,
      parsed?.updated_at,
      parsed?.updatedAtMs
    ),
    integrationStatus: 'ok'
  }
}

export function parseOpenClawUsage(raw) {
  if (!raw) return null

  const candidates = extractJsonCandidates(raw)
  if (candidates.length === 0) return null

  for (const candidate of candidates) {
    let parsed
    try {
      parsed = JSON.parse(candidate)
    } catch {
      continue
    }

    const fromStatus = parseFromStatusJson(parsed)
    if (fromStatus) return fromStatus

    const fromGeneric = parseGenericUsage(parsed)
    if (fromGeneric) return fromGeneric
  }

  return null
}
