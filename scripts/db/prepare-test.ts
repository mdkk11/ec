import { createDatabaseClient } from '../../src/server/db/client'
import {
  loadDatabaseEnvironment,
  requireDatabaseEnvironment,
} from '../../src/server/db/environment'
import { migrateDatabase } from '../../src/server/db/migrate'
import { resetTestDatabase } from '../../src/server/db/test-lifecycle'

loadDatabaseEnvironment()

const testDatabaseUrl = requireDatabaseEnvironment('TEST_DATABASE_URL')
const developmentDatabaseUrl = process.env.DATABASE_URL
const client = createDatabaseClient(testDatabaseUrl)

try {
  await resetTestDatabase(client.pool, {
    developmentDatabaseUrl,
    nodeEnv: process.env.NODE_ENV,
    testDatabaseUrl,
  })
  await migrateDatabase(client.db)
  console.info('テストDBを初期化し、migrationを適用しました。')
} finally {
  await client.close()
}
