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

function extractOpenClawNoise(raw) {
  const esc = String.fromCharCode(0x1b)
  return String(raw)
    .replace(/\x1b\][^\x07\x1b]*\x07/g, '')
    .replace(/\x1b\][^\x07\x1b]*\x1b\\/g, '')
    .replace(/\x9b\][^\x07\x1b]*\x07/g, '')
    .replace(/\x9b[^\x07\x1b]*\x1b\\/g, '')
    .replace(/\x1b[PXZ^_].*?(?:\x1b\\|\x9c)/gs, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(new RegExp(`${esc}\[[0-9;?]*[ -/]*[@-~]`, 'g'), '')
    .replace(new RegExp(`${esc}[^m]*m`, 'g'), '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/\r/g, '')
}


function extractJsonCandidates(raw) {
  const text = extractOpenClawNoise(raw)
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

const OPENCLAW_ALIAS_KEY_MAP = {
  current_session: 'currentSession',
  active_session: 'activeSession',
  recent_sessions: 'recentSessions',
  active_sessions: 'activeSessions',
  default_model: 'defaultModel',
  model_name: 'modelName',
  session_id: 'sessionId',
  agent_id: 'agentId',
  usage_ts: 'usageTs',
  usage_ts_ms: 'usageTsMs',
  usage_timestamp: 'usageTimestamp',
  usage_timestamp_ms: 'usageTsMs',
  updated_at_ms: 'updatedAtMs',
  ts_ms: 'tsMs'
}

function normalizeOpenClawAliases(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeOpenClawAliases(item))
  if (!value || typeof value !== 'object') return value

  const normalized = {}
  for (const [key, rawValue] of Object.entries(value)) {
    const child = normalizeOpenClawAliases(rawValue)
    const alias = OPENCLAW_ALIAS_KEY_MAP[key]

    if (alias && typeof normalized[alias] === 'undefined') {
      normalized[alias] = child
      continue
    }

    if (typeof normalized[key] === 'undefined') {
      normalized[key] = child
    }
  }

  return normalized
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
    value.model_name,
    value.totalTokens,
    value.total_tokens,
    value.inputTokens,
    value.outputTokens,
    value.age,
    value.ageMs,
    value.updatedAt,
    value.updated_at,
    value.updatedAtMs,
    value.updated_at_ms,
    value.ts,
    value.time,
    value.timestamp,
    value.timestampMs,
    value.tsMs,
    value.usageTs,
    value.usageTsMs,
    value.usage_timestamp,
    value.usage_timestamp_ms,
    value.usageTimestamp,
    value.usageTimestampMs
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

function extractUsageEnvelope(value, depth = 0) {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) return value.length > 0 ? value : null
  if (depth > 6) return null

  const nextKeys = [
    'current',
    'currentSession',
    'activeSession',
    'session',
    'active',
    'recent',
    'recentSessions',
    'activeSessions',
    'sessions',
    'stats',
    'sessionUsage',
    'usage',
    'data',
    'result',
    'status',
    'payload',
    'defaultModel',
    'default_model',
    'session_id',
    'agent_id'
  ]

  for (const key of nextKeys) {
    const next = value[key]
    const normalized = extractUsageEnvelope(next, depth + 1)
    if (normalized) return normalized
  }

  if (hasAnySessionSignal(value)) return value

  return null
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

    if (fromObject.length > 0) {
      // Flatten nested arrays (e.g. when a sessions array is a value in an object map)
      const flattened = fromObject.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      return flattened.length > 0 ? flattened : fromObject
    }
  }

  return null
}

/**
 * Resolve a dot-separated path on an object, returning undefined if any
 * segment is nullish.  E.g. deepGet(obj, 'a.b.c') === obj?.a?.b?.c
 */
function deepGet(obj, path) {
  let cur = obj
  const segments = path.split('.')
  for (let i = 0; i < segments.length; i++) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[segments[i]]
  }
  return cur
}

/**
 * Check whether any combination of wrapper-prefix + leaf-key is truthy on
 * `value`.  `prefixes` are dot-separated paths (empty string = root).
 */
function hasTruthyAtAnyPath(value, prefixes, leafKeys) {
  for (const prefix of prefixes) {
    const base = prefix ? deepGet(value, prefix) : value
    if (base == null || typeof base !== 'object') continue
    for (const leaf of leafKeys) {
      if (base[leaf]) return true
    }
  }
  return false
}

// Wrapper prefixes used for envelope detection (up to 4 levels deep).
const SESSION_ENVELOPE_PREFIXES = [
  '', 'result', 'result.data', 'data', 'data.result',
  'status', 'status.result', 'status.result.data', 'status.data',
  'payload', 'payload.result', 'payload.result.data', 'payload.data',
  'payload.data.result', 'payload.data.result.data',
  'payload.status', 'payload.status.result', 'payload.status.result.data'
]

const SESSION_LEAF_KEYS = ['sessions', 'session', 'activeSession', 'currentSession', 'current', 'active', 'recentSessions', 'recent', 'activeSessions']

function isExplicitSessionEnvelope(value) {
  if (!value || typeof value !== 'object') return false
  return hasTruthyAtAnyPath(value, SESSION_ENVELOPE_PREFIXES, SESSION_LEAF_KEYS)
}

const STATS_PREFIXES = [
  '', 'result', 'data', 'data.result', 'status', 'status.result',
  'payload', 'payload.result', 'payload.data', 'payload.data.result',
  'payload.status', 'payload.status.result'
]

const STATS_LEAF_KEYS = ['stats', 'sessionUsage', 'usage', 'current', 'session']

function looksLikeStatsOrCurrentPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return false
  return hasTruthyAtAnyPath(parsed, STATS_PREFIXES, STATS_LEAF_KEYS)
}

// Wrapper prefixes for session candidate collection (ordered by priority).
const COLLECT_PREFIXES = [
  'sessions', '', 'result.sessions', 'result', 'result.data.sessions', 'result.data',
  'data.result.sessions', 'data.result', 'data.result.data.sessions', 'data.result.data',
  'data', 'status.sessions', 'status', 'status.result.sessions', 'status.result',
  'status.result.data', 'status.data.sessions', 'status.data'
]

// Session leaf keys to probe under each prefix.
const COLLECT_LEAVES = ['recent', 'recentSessions', 'activeSessions', 'active', 'session', 'activeSession', 'current', 'currentSession']

// Additional fallback paths checked as raw roots (no leaf expansion).
const COLLECT_FALLBACK_ROOTS = [
  'result.data', 'result', 'data.result.data', 'data.result', 'data',
  'status.result.data', 'status.result', 'sessions', 'data'
]

function collectStatusSessionCandidates(parsed) {
  const coerceOpts = { skipKeys: ['defaults', 'metadata', 'config'] }

  // First pass: prefix + leaf combinations (specific paths only).
  for (const prefix of COLLECT_PREFIXES) {
    const base = prefix ? deepGet(parsed, prefix) : parsed
    if (base == null || typeof base !== 'object') continue
    for (const leaf of COLLECT_LEAVES) {
      const candidate = base[leaf]
      if (candidate == null) continue
      const normalized = coerceSessionCandidates(candidate, coerceOpts)
      if (normalized && normalized.length > 0) return normalized
    }
  }

  // Second pass: try wrapper roots themselves as session containers (fallback).
  const fallbackRoots = [
    'result.data', 'result', 'data.result.data', 'data.result',
    'data', 'status.result.data', 'status.result', 'status.data',
    'sessions', 'data'
  ]
  for (const path of fallbackRoots) {
    const candidate = deepGet(parsed, path)
    if (candidate == null) continue
    const normalized = coerceSessionCandidates(candidate, coerceOpts)
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
      defaults.modelName,
      defaults.defaultModel,
      defaults?.default_model,
      defaults?.model_name,
      parsed?.defaultModel,
      parsed?.default_model,
      parsed?.modelName,
      parsed?.model_name,
      parsed?.status?.defaultModel,
      parsed?.status?.default_model,
      parsed?.status?.modelName,
      parsed?.status?.model_name,
      parsed?.status?.data?.defaultModel,
      parsed?.status?.data?.default_model,
      parsed?.result?.defaultModel,
      parsed?.result?.default_model,
      parsed?.result?.modelName,
      parsed?.result?.model_name,
      parsed?.data?.defaultModel,
      parsed?.data?.default_model,
      parsed?.data?.modelName,
      parsed?.data?.model_name
    )
    if (!defaultsModel) return null
    return {
      model: defaultsModel,
      totalTokens: null,
      tokensPerMin: null,
      sessionId: null,
      agentId: null,
      usageTimestampMs: pickTimestamp(
        parsed?.ts,
        parsed?.time,
        parsed?.timestamp,
        parsed?.tsMs,
        parsed?.timestampMs,
        parsed?.usageTs,
        parsed?.usageTsMs,
        parsed?.usageTimestamp,
        parsed?.usageTimestampMs,
        parsed?.usage_timestamp,
        parsed?.usage_timestamp_ms,
        parsed?.updatedAt,
        parsed?.updated_at,
        parsed?.updatedAtMs,
        parsed?.updated_at_ms
      ),
      integrationStatus: 'partial'
    }
  }

  const model = pickString(
    session.model,
    session.modelName,
    session.model_name,
    session?.usage?.model,
    session?.usage?.modelName,
    session?.usage?.model_name,
    session?.defaultModel,
    session?.default_model,
    defaults.model,
    defaults.modelName,
    defaults?.model_name,
    parsed?.defaultModel,
    parsed?.default_model,
    parsed?.modelName,
    parsed?.model_name,
    parsed?.status?.model,
    parsed?.status?.modelName,
    parsed?.status?.model_name,
    parsed?.status?.defaultModel,
    parsed?.status?.default_model,
    parsed?.result?.defaultModel,
    parsed?.result?.default_model,
    parsed?.result?.modelName,
    parsed?.result?.model_name,
    parsed?.data?.defaultModel,
    parsed?.data?.default_model,
    parsed?.data?.modelName,
    parsed?.data?.model_name
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
      session.updated_at_ms,
      session.timestamp,
      session.time,
      session.usageTs,
      session.usageTimestamp,
      session.usage_timestamp,
      session.usage_timestamp_ms,
      session.tsMs,
      session?.usage?.updatedAt,
      session?.usage?.updated_at,
      session?.usage?.updatedAtMs,
      session?.usage?.timestamp,
      session?.usage?.ts,
      session?.usage?.tsMs,
      session?.usage?.time,
      session?.usage?.usageTs,
      session?.usage?.usageTimestamp,
      session?.usage?.usage_timestamp,
      session?.usage?.usage_timestamp_ms,
      session?.usage?.usageTsMs,
      parsed?.ts,
      parsed?.time,
      parsed?.timestamp,
      parsed?.tsMs,
      parsed?.timestampMs,
      parsed?.usageTs,
      parsed?.usageTimestamp,
      parsed?.usage_timestamp,
      parsed?.usage_timestamp_ms,
      parsed?.updatedAt,
      parsed?.updated_at,
      parsed?.updatedAtMs,
      parsed?.updated_at_ms,
      parsed?.status?.updatedAt,
      parsed?.status?.updated_at,
      parsed?.status?.updatedAtMs,
      parsed?.status?.updated_at_ms,
      parsed?.status?.timestamp,
      parsed?.status?.time,
      parsed?.status?.ts,
      parsed?.status?.tsMs,
      parsed?.status?.usageTs,
      parsed?.status?.usageTimestamp,
      parsed?.status?.usage_timestamp,
      parsed?.status?.usage_timestamp_ms,
      parsed?.status?.usageTsMs
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
  const usageCandidates = [
    parsed?.usage,
    parsed?.sessionUsage,
    parsed?.stats,
    parsed?.stats?.current,
    parsed?.payload?.usage,
    parsed?.payload?.sessionUsage,
    parsed?.payload?.stats,
    parsed?.payload?.stats?.current,
    parsed?.payload?.stats?.session,
    parsed?.data?.usage,
    parsed?.data?.sessionUsage,
    parsed?.data?.stats,
    parsed?.data?.stats?.current,
    parsed?.data?.stats?.session,
    parsed?.result?.usage,
    parsed?.result?.sessionUsage,
    parsed?.result?.stats,
    parsed?.result?.stats?.current,
    parsed?.result?.stats?.session,
    parsed?.payload?.result?.usage,
    parsed?.payload?.result?.sessionUsage,
    parsed?.payload?.result?.stats,
    parsed?.payload?.result?.stats?.current,
    parsed?.payload?.result?.stats?.session,
    parsed?.data?.result?.usage,
    parsed?.data?.result?.sessionUsage,
    parsed?.data?.result?.stats,
    parsed?.data?.result?.stats?.current,
    parsed?.data?.result?.stats?.session,
    parsed?.status?.usage,
    parsed?.status?.sessionUsage,
    parsed?.status?.stats,
    parsed?.status?.stats?.current,
    parsed?.status?.stats?.session,
    parsed?.status?.result?.usage,
    parsed?.status?.result?.sessionUsage,
    parsed?.status?.result?.stats,
    parsed?.status?.result?.stats?.current,
    parsed?.status?.result?.stats?.session,
    parsed?.current,
    parsed?.session,
    parsed?.result?.current,
    parsed?.result?.session,
    parsed?.result?.data?.current,
    parsed?.result?.data?.session,
    parsed?.result?.data?.stats,
    parsed?.data?.current,
    parsed?.data?.session,
    parsed?.data?.result?.current,
    parsed?.data?.result?.session,
    parsed?.data?.stats,
    parsed?.payload?.current,
    parsed?.payload?.session,
    parsed?.payload?.result?.current,
    parsed?.payload?.result?.session,
    parsed?.payload?.data?.current,
    parsed?.payload?.data?.session,
    parsed?.payload?.data?.stats,
    parsed?.status?.current,
    parsed?.status?.session,
    parsed?.status?.result?.current,
    parsed?.status?.result?.session,
    parsed?.status?.data?.current,
    parsed?.status?.data?.session,
    parsed?.status?.data?.stats,
    parsed
  ]

  const usage = usageCandidates.reduce((found, candidate) => {
    if (found) return found
    const envelope = extractUsageEnvelope(candidate)
    return envelope && typeof envelope === 'object' ? envelope : null
  }, null)

  const usageRecord = Array.isArray(usage) ? pickBestRecentSession(usage) : usage

  const usageTotals = usageRecord?.totals || usageRecord?.summary || usageRecord?.usageTotals || usageRecord?.usage?.totals || usageRecord?.usage?.summary
  const model = pickString(
    parsed?.model,
    parsed?.default_model,
    parsed?.modelName,
    parsed?.model_name,
    parsed?.status?.model,
    parsed?.status?.default_model,
    parsed?.status?.modelName,
    parsed?.status?.model_name,
    usageRecord?.model,
    usageRecord?.modelName,
    usageRecord?.model_name,
    usageRecord?.defaultModel,
    usageRecord?.default_model,
    usageTotals?.model,
    usageTotals?.modelName,
    usageTotals?.model_name,
    usageTotals?.defaultModel,
    usageTotals?.default_model,
    parsed?.result?.model,
    parsed?.result?.modelName,
    parsed?.result?.model_name,
    parsed?.data?.model,
    parsed?.data?.modelName,
    parsed?.data?.model_name,
    parsed?.data?.defaultModel,
    parsed?.data?.default_model,
    parsed?.payload?.model,
    parsed?.payload?.modelName,
    parsed?.payload?.model_name,
    parsed?.payload?.defaultModel,
    parsed?.payload?.default_model
  )
  const totalTokens = pickNumber(
    usageRecord?.totalTokens,
    usageRecord?.total_tokens,
    usageRecord?.tokenCount,
    usageRecord?.token_count,
    usageRecord?.tokens,
    usageRecord?.tokenUsage?.total,
    usageRecord?.token_usage?.total,
    usageRecord?.tokens?.total,
    usageRecord?.tokens?.sum,
    usageRecord?.inputTokens && usageRecord?.outputTokens ? usageRecord.inputTokens + usageRecord.outputTokens : null,
    usageRecord?.input_tokens && usageRecord?.output_tokens ? usageRecord.input_tokens + usageRecord.output_tokens : null,
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
    usageRecord?.tokensPerMinute,
    usageRecord?.tokens_per_minute,
    usageRecord?.tpm,
    usageRecord?.tokenRate,
    usageRecord?.requestsPerMinute,
    usageRecord?.rps,
    usageRecord?.tokens?.perMin,
    usageRecord?.tokens?.perMinute,
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
      usageRecord?.sessionId,
      usageRecord?.session_id,
      usageRecord?.id
    ),
    agentId: pickString(
      parsed?.agentId,
      parsed?.agent_id,
      parsed?.payload?.agentId,
      parsed?.payload?.agent_id,
      usageRecord?.agentId,
      usageRecord?.agent_id
    ),
    usageTimestampMs: pickTimestamp(
      usageRecord?.updatedAt,
      usageRecord?.updated_at,
      usageRecord?.updatedAtMs,
      usageRecord?.ts,
      usageRecord?.time,
      usageRecord?.timestamp,
      usageRecord?.tsMs,
      usageRecord?.timestampMs,
      usageRecord?.usageTs,
      usageRecord?.usageTsMs,
      usageRecord?.usageTimestamp,
      usageRecord?.usage_timestamp,
      usageRecord?.usage_timestamp_ms,
      usageRecord?.usageTimestampMs,
      usageTotals?.updatedAt,
      usageTotals?.updated_at,
      usageTotals?.updatedAtMs,
      usageTotals?.updated_at_ms,
      usageTotals?.ts,
      usageTotals?.time,
      usageTotals?.timestamp,
      usageTotals?.timestampMs,
      usageTotals?.tsMs,
      usageTotals?.usageTs,
      usageTotals?.usageTsMs,
      usageTotals?.usageTimestamp,
      usageTotals?.usage_timestamp,
      usageTotals?.usage_timestamp_ms,
      parsed?.payload?.updatedAt,
      parsed?.payload?.updated_at,
      parsed?.payload?.updatedAtMs,
      parsed?.payload?.ts,
      parsed?.payload?.time,
      parsed?.payload?.timestamp,
      parsed?.payload?.tsMs,
      parsed?.payload?.usageTs,
      parsed?.payload?.usageTsMs,
      parsed?.payload?.usageTimestamp,
      parsed?.payload?.usage_timestamp,
      parsed?.payload?.usage_timestamp_ms,
      parsed?.payload?.usageTimestampMs,
      parsed?.ts,
      parsed?.time,
      parsed?.timestamp,
      parsed?.tsMs,
      parsed?.timestampMs,
      parsed?.usageTs,
      parsed?.usageTimestamp,
      parsed?.usage_timestamp,
      parsed?.usage_timestamp_ms,
      parsed?.updatedAt,
      parsed?.updated_at,
      parsed?.updatedAtMs,
      parsed?.updated_at_ms,
      parsed?.status?.updatedAt,
      parsed?.status?.updated_at,
      parsed?.status?.updatedAtMs,
      parsed?.status?.updated_at_ms,
      parsed?.status?.timestamp,
      parsed?.status?.time,
      parsed?.status?.ts,
      parsed?.status?.tsMs,
      parsed?.status?.usageTs,
      parsed?.status?.usageTimestamp,
      parsed?.status?.usage_timestamp,
      parsed?.status?.usage_timestamp_ms,
      parsed?.status?.usageTsMs
    ),
    integrationStatus: 'ok'
  }
}

function usageCandidateScore(usage) {
  if (!usage) return -1

  let score = usage.integrationStatus === 'ok' ? 8 : 1

  if (usage.model !== null) score += 2
  if (usage.totalTokens !== null) score += 2
  if (usage.tokensPerMin !== null) score += 1
  if (usage.sessionId !== null) score += 1
  if (usage.agentId !== null) score += 1
  if (usage.usageTimestampMs !== null) score += 1

  return score
}

export function parseOpenClawUsage(raw) {
  if (!raw) return null

  const candidates = extractJsonCandidates(raw)
  if (candidates.length === 0) return null

  let bestMatch = null
  let bestScore = -1
  let bestSource = null
  let hasError = false

  const compareByRecency = (a, b) => {
    if (!a || !b) return 0
    const aTs = a.usageTimestampMs
    const bTs = b.usageTimestampMs
    if (aTs === null && bTs === null) return 0
    if (aTs === null) return -1
    if (bTs === null) return 1
    if (aTs === bTs) return 0
    return aTs > bTs ? 1 : -1
  }

  for (const candidate of candidates) {
    let parsed
    try {
      parsed = JSON.parse(candidate)
    } catch {
      hasError = true
      continue
    }

    const normalized = normalizeOpenClawAliases(parsed)
    const fromStatus = parseFromStatusJson(normalized)
    if (fromStatus) {
      const score = usageCandidateScore(fromStatus)
      if (
        score > bestScore ||
        (score === bestScore && compareByRecency(fromStatus, bestMatch) > 0) ||
        (score === bestScore && bestSource === 'generic' && compareByRecency(fromStatus, bestMatch) === 0)
      ) {
        bestMatch = fromStatus
        bestScore = score
        bestSource = 'status'
      }
    }

    const fromGeneric = parseGenericUsage(normalized)
    if (fromGeneric) {
      const score = usageCandidateScore(fromGeneric)
      if (
        score > bestScore ||
        (score === bestScore && compareByRecency(fromGeneric, bestMatch) > 0) ||
        (score === bestScore && compareByRecency(fromGeneric, bestMatch) === 0 && bestSource !== 'generic')
      ) {
        bestMatch = fromGeneric
        bestScore = score
        bestSource = 'generic'
      }
    }

  }

  return hasError && bestMatch === null ? null : bestMatch
}
