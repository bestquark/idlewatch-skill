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

function isExplicitSessionEnvelope(value) {
  if (!value || typeof value !== 'object') return false
  return !!(
    value.sessions ||
    value.session ||
    value.activeSession ||
    value.currentSession ||
    value.current ||
    value.active ||
    value.recentSessions ||
    value.recent ||
    value.activeSessions ||
    value.result?.sessions ||
    value.result?.session ||
    value.result?.activeSession ||
    value.result?.currentSession ||
    value.result?.active ||
    value.result?.recentSessions ||
    value.result?.recent ||
    value.result?.activeSessions ||
    value.result?.data?.sessions ||
    value.result?.data?.recentSessions ||
    value.result?.data?.recent ||
    value.result?.data?.activeSessions ||
    value.result?.data?.active ||
    value.data?.sessions ||
    value.data?.session ||
    value.data?.activeSession ||
    value.data?.currentSession ||
    value.data?.current ||
    value.data?.active ||
    value.data?.recentSessions ||
    value.data?.recent ||
    value.data?.activeSessions ||
    value.data?.result?.sessions ||
    value.data?.result?.session ||
    value.data?.result?.activeSession ||
    value.data?.result?.currentSession ||
    value.data?.result?.active ||
    value.data?.result?.recentSessions ||
    value.data?.result?.recent ||
    value.data?.result?.activeSessions ||
    value.status?.sessions ||
    value.status?.session ||
    value.status?.activeSession ||
    value.status?.currentSession ||
    value.status?.current ||
    value.status?.active ||
    value.status?.recentSessions ||
    value.status?.recent ||
    value.status?.activeSessions ||
    value.status?.result?.sessions ||
    value.status?.result?.session ||
    value.status?.result?.activeSession ||
    value.status?.result?.currentSession ||
    value.status?.result?.active ||
    value.status?.result?.recentSessions ||
    value.status?.result?.recent ||
    value.status?.result?.activeSessions ||
    value.status?.result?.data?.sessions ||
    value.status?.result?.data?.recentSessions ||
    value.status?.result?.data?.recent ||
    value.status?.result?.data?.activeSessions ||
    value.status?.result?.data?.active ||
    value.payload?.sessions ||
    value.payload?.session ||
    value.payload?.activeSession ||
    value.payload?.currentSession ||
    value.payload?.current ||
    value.payload?.active ||
    value.payload?.recentSessions ||
    value.payload?.recent ||
    value.payload?.activeSessions ||
    value.payload?.result?.sessions ||
    value.payload?.result?.session ||
    value.payload?.result?.activeSession ||
    value.payload?.result?.currentSession ||
    value.payload?.result?.active ||
    value.payload?.result?.recentSessions ||
    value.payload?.result?.recent ||
    value.payload?.result?.activeSessions ||
    value.payload?.result?.data?.sessions ||
    value.payload?.result?.data?.recentSessions ||
    value.payload?.result?.data?.recent ||
    value.payload?.result?.data?.activeSessions ||
    value.payload?.result?.data?.active ||
    value.payload?.data?.sessions ||
    value.payload?.data?.session ||
    value.payload?.data?.activeSession ||
    value.payload?.data?.currentSession ||
    value.payload?.data?.current ||
    value.payload?.data?.active ||
    value.payload?.data?.recentSessions ||
    value.payload?.data?.recent ||
    value.payload?.data?.activeSessions ||
    value.payload?.data?.result?.sessions ||
    value.payload?.data?.result?.session ||
    value.payload?.data?.result?.activeSession ||
    value.payload?.data?.result?.currentSession ||
    value.payload?.data?.result?.active ||
    value.payload?.data?.result?.recentSessions ||
    value.payload?.data?.result?.recent ||
    value.payload?.data?.result?.activeSessions ||
    value.payload?.data?.result?.data?.sessions ||
    value.payload?.data?.result?.data?.recentSessions ||
    value.payload?.data?.result?.data?.recent ||
    value.payload?.data?.result?.data?.activeSessions ||
    value.payload?.data?.result?.data?.active ||
    value.payload?.status?.sessions ||
    value.payload?.status?.session ||
    value.payload?.status?.activeSession ||
    value.payload?.status?.currentSession ||
    value.payload?.status?.current ||
    value.payload?.status?.active ||
    value.payload?.status?.recentSessions ||
    value.payload?.status?.recent ||
    value.payload?.status?.activeSessions ||
    value.payload?.status?.result?.sessions ||
    value.payload?.status?.result?.session ||
    value.payload?.status?.result?.activeSession ||
    value.payload?.status?.result?.currentSession ||
    value.payload?.status?.result?.active ||
    value.payload?.status?.result?.recentSessions ||
    value.payload?.status?.result?.recent ||
    value.payload?.status?.result?.activeSessions ||
    value.payload?.status?.result?.data?.sessions ||
    value.payload?.status?.result?.data?.recentSessions ||
    value.payload?.status?.result?.data?.recent ||
    value.payload?.status?.result?.data?.activeSessions ||
    value.payload?.status?.result?.data?.active
  )
}

function looksLikeStatsOrCurrentPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return false

  return !!(
    parsed.stats ||
    parsed.sessionUsage ||
    parsed.usage ||
    parsed.current ||
    parsed.session ||
    parsed.result?.stats ||
    parsed.result?.sessionUsage ||
    parsed.result?.usage ||
    parsed.result?.current ||
    parsed.result?.session ||
    parsed.data?.stats ||
    parsed.data?.sessionUsage ||
    parsed.data?.usage ||
    parsed.data?.current ||
    parsed.data?.session ||
    parsed.data?.result?.stats ||
    parsed.data?.result?.sessionUsage ||
    parsed.data?.result?.usage ||
    parsed.data?.result?.current ||
    parsed.data?.result?.session ||
    parsed.status?.stats ||
    parsed.status?.sessionUsage ||
    parsed.status?.usage ||
    parsed.status?.current ||
    parsed.status?.session ||
    parsed.status?.result?.stats ||
    parsed.status?.result?.sessionUsage ||
    parsed.status?.result?.usage ||
    parsed.status?.result?.current ||
    parsed.status?.result?.session ||
    parsed.payload?.stats ||
    parsed.payload?.sessionUsage ||
    parsed.payload?.usage ||
    parsed.payload?.current ||
    parsed.payload?.session ||
    parsed.payload?.result?.stats ||
    parsed.payload?.result?.sessionUsage ||
    parsed.payload?.result?.usage ||
    parsed.payload?.result?.current ||
    parsed.payload?.result?.session ||
    parsed.payload?.data?.stats ||
    parsed.payload?.data?.sessionUsage ||
    parsed.payload?.data?.usage ||
    parsed.payload?.data?.current ||
    parsed.payload?.data?.session ||
    parsed.payload?.data?.result?.stats ||
    parsed.payload?.data?.result?.sessionUsage ||
    parsed.payload?.data?.result?.usage ||
    parsed.payload?.data?.result?.current ||
    parsed.payload?.data?.result?.session ||
    parsed.payload?.status?.stats ||
    parsed.payload?.status?.sessionUsage ||
    parsed.payload?.status?.usage ||
    parsed.payload?.status?.current ||
    parsed.payload?.status?.session ||
    parsed.payload?.status?.result?.stats ||
    parsed.payload?.status?.result?.sessionUsage ||
    parsed.payload?.status?.result?.usage ||
    parsed.payload?.status?.result?.current ||
    parsed.payload?.status?.result?.session
  )
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
    parsed?.data?.result?.sessions?.recent,
    parsed?.data?.result?.sessions?.recentSessions,
    parsed?.data?.result?.sessions?.activeSessions,
    parsed?.data?.result?.sessions?.active,
    parsed?.data?.result?.sessions?.session,
    parsed?.data?.result?.sessions?.activeSession,
    parsed?.data?.result?.sessions?.current,
    parsed?.data?.result?.sessions?.currentSession,
    parsed?.data?.result?.sessions,
    parsed?.data?.result?.recent,
    parsed?.data?.result?.recentSessions,
    parsed?.data?.result?.activeSessions,
    parsed?.data?.result?.active,
    parsed?.data?.result?.activeSession,
    parsed?.data?.result?.session,
    parsed?.data?.result?.current,
    parsed?.data?.result?.currentSession,
    parsed?.data?.result?.data,
    parsed?.data?.result,
    parsed?.data?.result?.data?.sessions?.recent,
    parsed?.data?.result?.data?.sessions?.recentSessions,
    parsed?.data?.result?.data?.sessions?.activeSessions,
    parsed?.data?.result?.data?.sessions?.active,
    parsed?.data?.result?.data?.sessions?.session,
    parsed?.data?.result?.data?.sessions?.activeSession,
    parsed?.data?.result?.data?.sessions?.current,
    parsed?.data?.result?.data?.sessions?.currentSession,
    parsed?.data?.result?.data?.sessions,
    parsed?.data?.result?.data?.recent,
    parsed?.data?.result?.data?.recentSessions,
    parsed?.data?.result?.data?.activeSessions,
    parsed?.data?.result?.data?.active,
    parsed?.data?.result?.data?.activeSession,
    parsed?.data?.result?.data?.session,
    parsed?.data?.result?.data?.current,
    parsed?.data?.result?.data?.currentSession,
    parsed?.data?.result?.data,
    parsed?.data?.result?.data,
    parsed?.data,
    parsed?.status?.sessions?.recent,
    parsed?.status?.sessions?.recentSessions,
    parsed?.status?.sessions?.activeSessions,
    parsed?.status?.sessions?.active,
    parsed?.status?.sessions?.session,
    parsed?.status?.sessions?.activeSession,
    parsed?.status?.sessions?.current,
    parsed?.status?.sessions?.currentSession,
    parsed?.status?.sessions,
    parsed?.status?.recentSessions,
    parsed?.status?.activeSessions,
    parsed?.status?.active,
    parsed?.status?.activeSession,
    parsed?.status?.session,
    parsed?.status?.active,
    parsed?.status?.recent,
    parsed?.status?.current,
    parsed?.status?.currentSession,
    parsed?.status?.result?.sessions?.recent,
    parsed?.status?.result?.sessions?.recentSessions,
    parsed?.status?.result?.sessions?.activeSessions,
    parsed?.status?.result?.sessions?.active,
    parsed?.status?.result?.sessions?.session,
    parsed?.status?.result?.sessions?.activeSession,
    parsed?.status?.result?.sessions?.current,
    parsed?.status?.result?.sessions?.currentSession,
    parsed?.status?.result?.sessions,
    parsed?.status?.result?.recentSessions,
    parsed?.status?.result?.activeSessions,
    parsed?.status?.result?.active,
    parsed?.status?.result?.activeSession,
    parsed?.status?.result?.session,
    parsed?.status?.result?.current,
    parsed?.status?.result?.currentSession,
    parsed?.status?.result?.data?.sessions?.recent,
    parsed?.status?.result?.data?.sessions?.recentSessions,
    parsed?.status?.result?.data?.sessions?.activeSessions,
    parsed?.status?.result?.data?.sessions?.active,
    parsed?.status?.result?.data?.sessions?.session,
    parsed?.status?.result?.data?.sessions?.activeSession,
    parsed?.status?.result?.data?.sessions?.current,
    parsed?.status?.result?.data?.sessions?.currentSession,
    parsed?.status?.result?.data?.recentSessions,
    parsed?.status?.result?.data?.activeSessions,
    parsed?.status?.result?.data?.active,
    parsed?.status?.result?.data?.activeSession,
    parsed?.status?.result?.data?.session,
    parsed?.status?.result?.data?.current,
    parsed?.status?.result?.data?.currentSession,
    parsed?.status?.result?.data,
    parsed?.status?.result,
    parsed?.status?.data?.sessions?.recent,
    parsed?.status?.data?.sessions?.recentSessions,
    parsed?.status?.data?.sessions?.activeSessions,
    parsed?.status?.data?.sessions?.active,
    parsed?.status?.data?.sessions?.session,
    parsed?.status?.data?.sessions?.activeSession,
    parsed?.status?.data?.sessions?.current,
    parsed?.status?.data?.sessions?.currentSession,
    parsed?.status?.data?.recentSessions,
    parsed?.status?.data?.activeSessions,
    parsed?.status?.data?.active,
    parsed?.status?.data?.recent,
    parsed?.status?.data?.session,
    parsed?.status?.data?.activeSession,
    parsed?.status?.data?.current,
    parsed?.status?.data?.currentSession,
    parsed?.status?.data?.sessions,
    parsed?.sessions,
    parsed?.data
  ]

  for (const root of candidateRoots) {
    const normalized = coerceSessionCandidates(root, { skipKeys: ['defaults', 'metadata', 'config'] })
    if (normalized && normalized.length > 0) return normalized
  }

  return null
}


function parseFromStatusJson(parsed) {
  if (!isExplicitSessionEnvelope(parsed) && looksLikeStatsOrCurrentPayload(parsed)) {
    return null
  }

  const sessionsRoot = collectStatusSessionCandidates(parsed)
  const defaults = parsed?.sessions?.defaults || parsed?.defaults || parsed?.result?.defaults || parsed?.data?.defaults || parsed?.status?.defaults ||
    (parsed?.result?.defaultModel || parsed?.result?.default_model
      ? { model: parsed.result.defaultModel || parsed.result.default_model }
      : parsed?.result?.data?.defaultModel || parsed?.result?.data?.default_model
        ? { model: parsed.result.data.defaultModel || parsed.result.data.default_model }
        : parsed?.status?.defaultModel || parsed?.status?.default_model
          ? { model: parsed.status.defaultModel || parsed.status.default_model }
          : parsed?.status?.data?.defaultModel || parsed?.status?.data?.default_model
            ? { model: parsed.status.data.defaultModel || parsed.status.data.default_model }
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
      parsed?.status?.defaultModel,
      parsed?.status?.default_model,
      parsed?.status?.data?.defaultModel,
      parsed?.status?.data?.default_model,
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
    parsed?.status?.model,
    parsed?.status?.modelName,
    parsed?.status?.defaultModel,
    parsed?.status?.default_model,
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
      parsed?.updatedAtMs,
      parsed?.status?.updatedAt,
      parsed?.status?.updated_at,
      parsed?.status?.updatedAtMs,
      parsed?.status?.timestamp,
      parsed?.status?.time,
      parsed?.status?.ts,
      parsed?.status?.tsMs
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
  const usage = parsed?.usage || parsed?.sessionUsage || parsed?.stats || parsed?.payload?.usage || parsed?.payload?.sessionUsage || parsed?.payload?.stats ||
    parsed?.data?.usage || parsed?.data?.sessionUsage || parsed?.data?.stats ||
    parsed?.current || parsed?.session || parsed?.result?.current || parsed?.data?.current || parsed?.result?.session || parsed?.data?.session ||
    parsed?.payload?.current || parsed?.payload?.session || parsed?.payload?.result?.current || parsed?.payload?.result?.session ||
    parsed?.data?.result?.current || parsed?.data?.result?.session || parsed?.data?.result?.currentSession ||
    parsed?.status?.current || parsed?.status?.data?.current || parsed?.status?.session || parsed?.status?.result?.current || parsed?.status?.result?.session || parsed
  const usageTotals = usage?.totals || usage?.summary || usage?.usageTotals || usage?.usage?.totals || usage?.usage?.summary
  const model = pickString(parsed?.model, parsed?.default_model, parsed?.modelName, parsed?.status?.model, parsed?.status?.default_model, parsed?.status?.modelName, usage?.model, usage?.modelName, usageTotals?.model, usage?.modelName, parsed?.result?.model, parsed?.data?.model, parsed?.data?.defaultModel, parsed?.data?.default_model, parsed?.payload?.model, parsed?.payload?.defaultModel, parsed?.payload?.default_model)
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
    sessionId: pickString(
      parsed?.sessionId,
      parsed?.session_id,
      parsed?.payload?.sessionId,
      parsed?.payload?.session_id,
      usage?.sessionId,
      usage?.session_id,
      usage?.id
    ),
    agentId: pickString(
      parsed?.agentId,
      parsed?.agent_id,
      parsed?.payload?.agentId,
      parsed?.payload?.agent_id,
      usage?.agentId,
      usage?.agent_id
    ),
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
      parsed?.payload?.updatedAt,
      parsed?.payload?.updated_at,
      parsed?.payload?.updatedAtMs,
      parsed?.payload?.ts,
      parsed?.payload?.time,
      parsed?.payload?.timestamp,
      parsed?.payload?.tsMs,
      parsed?.payload?.usageTs,
      parsed?.payload?.usage_timestamp,
      parsed?.payload?.usageTimestampMs,
      parsed?.ts,
      parsed?.time,
      parsed?.timestamp,
      parsed?.tsMs,
      parsed?.timestampMs,
      parsed?.usageTs,
      parsed?.usage_timestamp,
      parsed?.updatedAt,
      parsed?.updated_at,
      parsed?.updatedAtMs,
      parsed?.status?.updatedAt,
      parsed?.status?.updated_at,
      parsed?.status?.updatedAtMs,
      parsed?.status?.timestamp,
      parsed?.status?.time,
      parsed?.status?.ts,
      parsed?.status?.tsMs
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
