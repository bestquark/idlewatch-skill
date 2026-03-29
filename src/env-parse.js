/**
 * Shared .env file parsing utilities.
 * Used by both the main agent CLI and the enrollment/setup flow.
 */

export function parseEnvValue(rawValue) {
  const value = String(rawValue || '').trim()
  if (!value) return ''

  const quotedWithCommentMatch = value.match(/^(['"])([\s\S]*)\1(?:\s+#.*)?$/)
  if (quotedWithCommentMatch) {
    return quotedWithCommentMatch[2]
  }

  const inlineCommentIndex = value.search(/\s+#/)
  if (inlineCommentIndex >= 0) {
    return value.slice(0, inlineCommentIndex).trim()
  }

  return value
}

export function normalizeEnvKey(rawKey) {
  const key = String(rawKey || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^export\s+/, '')
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : ''
}
