import { createDatabaseClient } from '../../src/server/db/client'
import {
  loadDatabaseEnvironment,
  requireDatabaseEnvironment,
} from '../../src/server/db/environment'
import { seedAuthenticationUsers } from '../../src/server/db/seed'

loadDatabaseEnvironment()

const client = createDatabaseClient(requireDatabaseEnvironment('DATABASE_URL'))

try {
  await seedAuthenticationUsers(client.db)
  console.info('開発DBへ認証用seedを適用しました。')
} finally {
  await client.close()
}
