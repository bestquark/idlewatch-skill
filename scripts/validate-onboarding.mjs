import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const binPath = path.join(repoRoot, 'bin', 'idlewatch-agent.js')
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'idlewatch-onboarding-'))

try {
  const sourceCreds = path.join(tmpRoot, 'service-account.json')
  fs.writeFileSync(
    sourceCreds,
    JSON.stringify({
      type: 'service_account',
      project_id: 'idlewatch-test-project',
      private_key_id: 'abc123',
      private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
      client_email: 'idlewatch@idlewatch-test-project.iam.gserviceaccount.com',
      client_id: '123'
    })
  )

  const envOut = path.join(tmpRoot, 'generated.env')
  const configDir = path.join(tmpRoot, 'config')
  const run = spawnSync(process.execPath, [binPath, 'quickstart'], {
    env: {
      ...process.env,
      IDLEWATCH_ENROLL_NON_INTERACTIVE: '1',
      IDLEWATCH_ENROLL_MODE: 'production',
      IDLEWATCH_ENROLL_PROJECT_ID: 'idlewatch-test-project',
      IDLEWATCH_ENROLL_SERVICE_ACCOUNT_FILE: sourceCreds,
      IDLEWATCH_ENROLL_OUTPUT_ENV_FILE: envOut,
      IDLEWATCH_ENROLL_CONFIG_DIR: configDir
    },
    encoding: 'utf8'
  })

  if (run.status !== 0) {
    throw new Error(`quickstart failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`)
  }

  if (!fs.existsSync(envOut)) {
    throw new Error('quickstart did not create output env file')
  }

  const envContent = fs.readFileSync(envOut, 'utf8')
  if (!envContent.includes('FIREBASE_PROJECT_ID=idlewatch-test-project')) {
    throw new Error('env file missing FIREBASE_PROJECT_ID')
  }
  if (!envContent.includes('FIREBASE_SERVICE_ACCOUNT_FILE=')) {
    throw new Error('env file missing FIREBASE_SERVICE_ACCOUNT_FILE')
  }

  const copiedCreds = path.join(configDir, 'credentials', 'idlewatch-test-project-service-account.json')
  if (!fs.existsSync(copiedCreds)) {
    throw new Error('quickstart did not copy service account file to secure credentials path')
  }

  console.log('onboarding validation passed')
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true })
}
