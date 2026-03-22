#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const [, , targetRoot] = process.argv
const ROOT = targetRoot || path.join(process.cwd(), 'dist', 'IdleWatch.app', 'Contents', 'Resources', 'payload', 'package')

function* walkJsFiles(startDir) {
  const entries = fs.readdirSync(startDir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(startDir, entry.name)
    if (entry.isDirectory()) {
      yield* walkJsFiles(fullPath)
      continue
    }

    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.js')) continue
    yield fullPath
  }
}

function extractSourceMapRef(contents) {
  const match = String(contents).match(/\/\/#[\s]*sourceMappingURL=([^\n\r]+)\s*$/m)
  return match ? match[1].trim() : null
}

function validateSourceMaps(rootDir) {
  const missing = []
  let nodeModuleMissing = 0

  for (const jsPath of walkJsFiles(rootDir)) {
    const contents = fs.readFileSync(jsPath, 'utf8')
    const ref = extractSourceMapRef(contents)
    if (!ref) continue

    if (ref.startsWith('data:')) continue
    if (ref.startsWith('http:') || ref.startsWith('https:')) continue

    const candidate = path.resolve(path.dirname(jsPath), ref)
    const isNodeModule = jsPath.includes(`${path.sep}node_modules${path.sep}`)

    if (!fs.existsSync(candidate)) {
      if (isNodeModule) {
        nodeModuleMissing += 1
      } else {
        missing.push({ jsPath, ref })
      }
    }
  }

  if (nodeModuleMissing > 0) {
    console.warn(`packaged sourcemap check skipped ${nodeModuleMissing} external-map references in node_modules (not validated by design).`)
  }

  if (missing.length > 0) {
    console.error('packaged source maps validation failed: missing external map files')
    for (const item of missing.slice(0, 40)) {
      console.error(`- ${item.jsPath} -> ${item.ref}`)
    }

    if (missing.length > 40) {
      console.error(`...and ${missing.length - 40} more`)
    }

    process.exit(1)
  }

  console.log('packaged sourcemaps validation passed')
}

if (!fs.existsSync(ROOT)) {
  console.error(`packaged payload directory not found: ${ROOT}`)
  process.exit(1)
}

try {
  validateSourceMaps(ROOT)
} catch (error) {
  console.error(`packaged sourcemap validation error: ${error.message}`)
  process.exit(1)
}
