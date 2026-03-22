export function stripControlNoise(raw) {
  return String(raw)
    .replace(/\x1b\][^\x07\x1b]*\x07/g, '')
    .replace(/\x1b\][^\x07\x1b]*\x1b\\/g, '')
    .replace(/\x9b\][^\x07\x1b]*\x07/g, '')
    .replace(/\x9b[^\x07\x1b]*\x1b\\/g, '')
    .replace(/\x1b[PXZ^_].*?(?:\x1b\\|\x9c)/gs, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(new RegExp(`\x1b[^m]*m`, 'g'), '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/\r/g, '')
}

export function extractJsonCandidates(raw) {
  const text = stripControlNoise(raw)
  const candidates = []

  for (let start = 0; start < text.length; start += 1) {
    const open = text[start]
    if (open !== '{' && open !== '[') continue
    if (open === '[') {
      const rest = text.slice(start + 1)
      const firstToken = rest.match(/^\s*([\[{])/)
      if (!firstToken) continue
    }

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
          continue
        }
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === '"') {
          inString = false
          continue
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

export function readTelemetryJsonRow(raw) {
  const candidates = extractJsonCandidates(raw)
  let lastErr

  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(candidates[i])
    } catch (err) {
      lastErr = err
    }
  }

  const message = `No telemetry JSON row found in command output (${candidates.length} JSON candidates)`
  const error = new Error(message)
  if (lastErr) error.cause = lastErr
  throw error
}
