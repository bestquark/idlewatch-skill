import fs from 'fs'
import path from 'path'

const pkgPath = new URL('../package.json', import.meta.url)
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

if (!pkg.bin || typeof pkg.bin !== 'object') {
  console.error('package.json is missing a valid "bin" object')
  process.exit(1)
}

let errors = 0
for (const [name, rel] of Object.entries(pkg.bin)) {
  const abs = path.resolve(path.dirname(pkgPath.pathname), rel)
  if (!fs.existsSync(abs)) {
    console.error(`bin entry "${name}" points to missing file: ${rel}`)
    errors++
  }
}

if (errors > 0) {
  process.exit(1)
}

console.log(`Validated ${Object.keys(pkg.bin).length} bin entries.`)
