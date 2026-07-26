import { resolve } from 'node:path'

import { config } from 'dotenv'

let databaseEnvironmentLoaded = false

export function loadDatabaseEnvironment() {
  if (databaseEnvironmentLoaded) return

  config({
    path: resolve(process.cwd(), '.env.local'),
    override: false,
    quiet: true,
  })
  databaseEnvironmentLoaded = true
}

export function requireDatabaseEnvironment(
  name: 'DATABASE_URL' | 'TEST_DATABASE_URL' | 'E2E_DATABASE_URL',
): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} を設定してください。`)
  }
  return value
}
