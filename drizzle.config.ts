import { defineConfig } from 'drizzle-kit'

import { loadDatabaseEnvironment, requireDatabaseEnvironment } from './src/server/db/environment'

loadDatabaseEnvironment()

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: requireDatabaseEnvironment('DATABASE_URL'),
  },
  strict: true,
  verbose: true,
})
