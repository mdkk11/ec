import { createDatabaseClient } from '../../src/server/db/client'
import {
  loadDatabaseEnvironment,
  requireDatabaseEnvironment,
} from '../../src/server/db/environment'
import { migrateDatabase } from '../../src/server/db/migrate'
import { seedAuthenticationUsers } from '../../src/server/db/seed'
import { resetTestDatabase } from '../../src/server/db/test-lifecycle'

loadDatabaseEnvironment()

const e2eDatabaseUrl = requireDatabaseEnvironment('E2E_DATABASE_URL')
const developmentDatabaseUrl = process.env.DATABASE_URL
const client = createDatabaseClient(e2eDatabaseUrl)

try {
  await resetTestDatabase(client.pool, {
    developmentDatabaseUrl,
    expectedDatabase: 'mockshop_e2e',
    nodeEnv: process.env.NODE_ENV,
    targetDatabaseUrl: e2eDatabaseUrl,
  })
  await migrateDatabase(client.db)
  await seedAuthenticationUsers(client.db)
  console.info('E2E DBを初期化し、migrationとseedを適用しました。')
} finally {
  await client.close()
}
