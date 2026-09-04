import { createDatabaseClient } from '@/server/db/client'
import { loadDatabaseEnvironment, requireDatabaseEnvironment } from '@/server/db/environment'
import { migrateDatabase } from '@/server/db/migrate'
import { seedE2EFixtures } from '@/server/db/seed'
import { resetTestDatabase } from '@/server/db/test-lifecycle'

export default async function globalSetup() {
  loadDatabaseEnvironment()

  const e2eDatabaseUrl = requireDatabaseEnvironment('E2E_DATABASE_URL')
  const client = createDatabaseClient(e2eDatabaseUrl)

  try {
    await resetTestDatabase(client.pool, {
      developmentDatabaseUrl: process.env.DATABASE_URL,
      expectedDatabase: 'mockshop_e2e',
      nodeEnv: process.env.NODE_ENV,
      targetDatabaseUrl: e2eDatabaseUrl,
    })
    await migrateDatabase(client.db)
    await seedE2EFixtures(client.db)
  } finally {
    await client.close()
  }
}
