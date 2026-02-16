function pickNumber(...vals) {
  for (const val of vals) {
    if (typeof val === 'number' && Number.isFinite(val)) return val
  }
  return null
}

function pickString(...vals) {
  for (const val of vals) {
    if (typeof val === 'string' && val.trim()) return val
  }
  return null
}

function deriveTokensPerMinute(session) {
  const totalTokens = pickNumber(session?.totalTokens, session?.total_tokens)
  const ageMs = pickNumber(session?.ageMs, session?.age)
  if (totalTokens === null || ageMs === null || ageMs <= 0) return null

  const minutes = ageMs / 60000
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  return Number((totalTokens / minutes).toFixed(2))
}

function pickBestRecentSession(recent = []) {
  if (!Array.isArray(recent) || recent.length === 0) return null

  const freshWithTokens = recent.find((session) => {
    const totalTokens = pickNumber(session?.totalTokens, session?.total_tokens)
    return totalTokens !== null && session?.totalTokensFresh !== false
  })
  if (freshWithTokens) return freshWithTokens

  const anyWithTokens = recent.find((session) => pickNumber(session?.totalTokens, session?.total_tokens) !== null)
  if (anyWithTokens) return anyWithTokens

  return recent[0]
}

function parseFromStatusJson(parsed) {
  const recent = parsed?.sessions?.recent
  const defaults = parsed?.sessions?.defaults || {}
  const session = pickBestRecentSession(recent)

  if (!session) {
    const defaultsModel = pickString(defaults.model, parsed?.default_model)
    if (!defaultsModel) return null
    return {
      model: defaultsModel,
      totalTokens: null,
      tokensPerMin: null,
      sessionId: null,
      agentId: null,
      usageTimestampMs: null,
      integrationStatus: 'partial'
    }
  }

  const model = pickString(session.model, defaults.model, parsed?.default_model)
  const totalTokens = pickNumber(session.totalTokens, session.total_tokens)
  const tokensPerMin = pickNumber(
    session.tokensPerMinute,
    session.tokens_per_minute,
    session.tpm,
    deriveTokensPerMinute(session)
  )

  const hasStrongUsage = model !== null || totalTokens !== null || tokensPerMin !== null

  return {
    model,
    totalTokens,
    tokensPerMin,
    sessionId: pickString(session.sessionId, session.id),
    agentId: pickString(session.agentId),
    usageTimestampMs: pickNumber(session.updatedAt, parsed?.ts),
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
  const tokensPerMin = pickNumber(usage?.tokensPerMinute, usage?.tokens_per_minute, usage?.tpm, usage?.tokenRate)

  if (model === null && totalTokens === null && tokensPerMin === null) return null

  return {
    model,
    totalTokens,
    tokensPerMin,
    sessionId: pickString(parsed?.sessionId, usage?.sessionId),
    agentId: pickString(parsed?.agentId, usage?.agentId),
    usageTimestampMs: pickNumber(parsed?.updatedAt, usage?.updatedAt, parsed?.ts),
    integrationStatus: 'ok'
  }
}

export function parseOpenClawUsage(raw) {
  if (!raw) return null

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (parsed?.sessions?.recent) {
    return parseFromStatusJson(parsed)
  }

  return parseGenericUsage(parsed)
}
