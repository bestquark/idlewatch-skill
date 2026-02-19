import os from 'os'
import path from 'path'

/**
 * Parse and validate a numeric environment variable.
 * Returns the parsed value or the default.
 * Throws if the value is set but invalid per the constraint function.
 */
function parseNumericEnv(envName, defaultValue, constraint = null) {
  const raw = process.env[envName]
  if (raw === undefined || raw === '') return defaultValue
  const value = Number(raw)
  if (constraint && !constraint(value)) {
    throw new Error(`Invalid ${envName}: ${raw}`)
  }
  return value
}

const isPositiveFinite = (v) => Number.isFinite(v) && v > 0
const isNonNegFinite = (v) => Number.isFinite(v) && v >= 0
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0
const isBool01 = (v) => v === 0 || v === 1

/**
 * Build the full IdleWatch configuration from environment variables.
 * Throws on invalid values.
 */
export function buildConfig() {
  const HOST = process.env.IDLEWATCH_HOST || os.hostname()
  const SAFE_HOST = HOST.replace(/[^a-zA-Z0-9_.-]/g, '_')

  const INTERVAL_MS = parseNumericEnv('IDLEWATCH_INTERVAL_MS', 10000, isPositiveFinite)
  const OPENCLAW_PROBE_TIMEOUT_MS = parseNumericEnv('IDLEWATCH_OPENCLAW_PROBE_TIMEOUT_MS', 2500, isPositiveFinite)
  const OPENCLAW_PROBE_RETRIES = parseNumericEnv('IDLEWATCH_OPENCLAW_PROBE_RETRIES', 1, isNonNegInt)

  const USAGE_STALE_MS = parseNumericEnv(
    'IDLEWATCH_USAGE_STALE_MS',
    Math.max(INTERVAL_MS * 3, 60000),
    isPositiveFinite
  )

  const USAGE_STALE_GRACE_MS = parseNumericEnv(
    'IDLEWATCH_USAGE_STALE_GRACE_MS',
    Math.min(INTERVAL_MS, 10000),
    isNonNegFinite
  )

  const USAGE_NEAR_STALE_MS = parseNumericEnv(
    'IDLEWATCH_USAGE_NEAR_STALE_MS',
    Math.floor((USAGE_STALE_MS + USAGE_STALE_GRACE_MS) * 0.85),
    isNonNegFinite
  )

  const USAGE_REFRESH_REPROBES = parseNumericEnv('IDLEWATCH_USAGE_REFRESH_REPROBES', 1, isNonNegInt)
  const USAGE_REFRESH_DELAY_MS = parseNumericEnv('IDLEWATCH_USAGE_REFRESH_DELAY_MS', 250, isNonNegFinite)
  const USAGE_REFRESH_ON_NEAR_STALE = parseNumericEnv('IDLEWATCH_USAGE_REFRESH_ON_NEAR_STALE', 1, isBool01)
  const USAGE_IDLE_AFTER_MS = parseNumericEnv('IDLEWATCH_USAGE_IDLE_AFTER_MS', 21600000, isPositiveFinite)

  const OPENCLAW_LAST_GOOD_MAX_AGE_MS = process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS
    ? parseNumericEnv('IDLEWATCH_OPENCLAW_LAST_GOOD_MAX_AGE_MS', 0, isPositiveFinite)
    : Math.max(USAGE_STALE_MS + USAGE_STALE_GRACE_MS, 120000)

  const LOCAL_LOG_PATH = process.env.IDLEWATCH_LOCAL_LOG_PATH
    ? path.resolve(process.env.IDLEWATCH_LOCAL_LOG_PATH)
    : path.resolve(process.cwd(), 'logs', `${SAFE_HOST}-metrics.ndjson`)

  const OPENCLAW_LAST_GOOD_CACHE_PATH = process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH
    ? path.resolve(process.env.IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH)
    : path.join(os.tmpdir(), `idlewatch-openclaw-last-good-${SAFE_HOST}.json`)

  return Object.freeze({
    HOST,
    SAFE_HOST,
    INTERVAL_MS,
    OPENCLAW_USAGE_MODE: (process.env.IDLEWATCH_OPENCLAW_USAGE || 'auto').toLowerCase(),
    OPENCLAW_BIN_STRICT: process.env.IDLEWATCH_OPENCLAW_BIN_STRICT === '1',
    OPENCLAW_PROBE_TIMEOUT_MS,
    OPENCLAW_PROBE_RETRIES,
    USAGE_STALE_MS,
    USAGE_STALE_GRACE_MS,
    USAGE_NEAR_STALE_MS,
    USAGE_REFRESH_REPROBES,
    USAGE_REFRESH_DELAY_MS,
    USAGE_REFRESH_ON_NEAR_STALE,
    USAGE_IDLE_AFTER_MS,
    OPENCLAW_LAST_GOOD_MAX_AGE_MS,
    OPENCLAW_LAST_GOOD_CACHE_PATH,
    LOCAL_LOG_PATH,
    REQUIRE_FIREBASE_WRITES: process.env.IDLEWATCH_REQUIRE_FIREBASE_WRITES === '1',
    FIREBASE: {
      PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      CREDS_FILE: process.env.FIREBASE_SERVICE_ACCOUNT_FILE,
      CREDS_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      CREDS_B64: process.env.FIREBASE_SERVICE_ACCOUNT_B64,
      EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST
    }
  })
}
