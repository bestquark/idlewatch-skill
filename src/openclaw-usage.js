function pickNumber(...vals) {
  for (const val of vals) {
    if (typeof val === 'number' && Number.isFinite(val)) return val
    if (typeof val === 'string') {
      const normalized = val.trim()
      if (!normalized) continue
      const parsed = Number(normalized)
      if (Number.isFinite(parsed)) return parsed
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

function deriveTokensPerMinute(session) {
  const totalTokens = pickNumber(session?.totalTokens, session?.total_tokens)
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
      const absolute = pickNumber(item?.updatedAt, item?.updated_at, item?.updatedAtMs, item?.createdAt, item?.created_at, item?.ts, item?.time)
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
    const totalTokens = pickNumber(session?.totalTokens, session?.total_tokens)
    return totalTokens !== null && isFreshTokenMarker(session?.totalTokensFresh)
  })
  const freshestWithTokens = pickNewestSession(withFreshTokens)
  if (freshestWithTokens) return freshestWithTokens

  const anyWithTokens = recent.filter((session) => pickNumber(session?.totalTokens, session?.total_tokens) !== null)
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

function parseFromStatusJson(parsed) {
  const sessionsRoot =
    parsed?.sessions?.recent ||
    parsed?.sessions?.recentSessions ||
    parsed?.sessions?.activeSessions ||
    parsed?.recentSessions ||
    parsed?.sessions?.active ||
    parsed?.activeSessions

  const defaults = parsed?.sessions?.defaults || parsed?.defaults || {}
  const session = pickBestRecentSession(sessionsRoot)

  if (!session) {
    const defaultsModel = pickString(defaults.model, defaults.defaultModel, parsed?.default_model, defaults?.default_model, parsed?.defaultModel)
    if (!defaultsModel) return null
    return {
      model: defaultsModel,
      totalTokens: null,
      tokensPerMin: null,
      sessionId: null,
      agentId: null,
      usageTimestampMs: pickNumber(parsed?.ts, parsed?.time),
      integrationStatus: 'partial'
    }
  }

  const model = pickString(session.model, session.modelName, defaults.model, parsed?.default_model)
  const totalTokens = pickNumber(session.totalTokens, session.total_tokens)
  const tokensPerMin = pickNumber(
    session.tokensPerMinute,
    session.tokens_per_minute,
    session.tpm,
    session.rate,
    deriveTokensPerMinute(session)
  )
  const sessionAgeMs = pickNumber(session.age, session.ageMs)
  const usageTimestampMs =
    pickNumber(session.updatedAt, session.updated_at, session.updatedAtMs, session.ts, session.time, session.timestamp) ??
    (Number.isFinite(sessionAgeMs) && sessionAgeMs >= 0 ? Date.now() - sessionAgeMs : pickNumber(parsed?.ts, parsed?.time, parsed?.updatedAt, parsed?.updated_at, parsed?.updatedAtMs))

  const hasStrongUsage = model !== null || totalTokens !== null || tokensPerMin !== null

  return {
    model,
    totalTokens,
    tokensPerMin,
    sessionId: pickString(session.sessionId, session.id),
    agentId: pickString(session.agentId),
    usageTimestampMs,
    integrationStatus: hasStrongUsage ? 'ok' : 'partial'
  }
}

function parseGenericUsage(parsed) {
  const usage = parsed?.usage || parsed?.sessionUsage || parsed?.stats || parsed
  const model = pickString(parsed?.model, usage?.model, usage?.modelName, parsed?.default_model)
  const totalTokens = pickNumber(
    usage?.totalTokens,
    usage?.total_tokens,
    usage?.tokens,
    usage?.tokenCount,
    usage?.inputTokens && usage?.outputTokens ? usage.inputTokens + usage.outputTokens : null
  )
  const tokensPerMin = pickNumber(
    usage?.tokensPerMinute,
    usage?.tokens_per_minute,
    usage?.tpm,
    usage?.tokenRate,
    usage?.requestsPerMinute
  )

  if (model === null && totalTokens === null && tokensPerMin === null) return null

  return {
    model,
    totalTokens,
    tokensPerMin,
    sessionId: pickString(parsed?.sessionId, usage?.sessionId, usage?.id),
    agentId: pickString(parsed?.agentId, usage?.agentId),
    usageTimestampMs: pickNumber(usage?.updatedAt, usage?.updated_at, usage?.updatedAtMs, usage?.ts, usage?.time, usage?.timestamp, parsed?.updatedAt, parsed?.updated_at, parsed?.updatedAtMs, parsed?.ts, parsed?.time),
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
