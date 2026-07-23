import { createDatabaseClient } from '../../src/server/db/client'
import {
  loadDatabaseEnvironment,
  requireDatabaseEnvironment,
} from '../../src/server/db/environment'
import { migrateDatabase } from '../../src/server/db/migrate'

loadDatabaseEnvironment()

const client = createDatabaseClient(requireDatabaseEnvironment('DATABASE_URL'))

try {
  await migrateDatabase(client.db)
  console.info('開発DBへmigrationを適用しました。')
} finally {
  await client.close()
}
