import { createDatabaseClient } from '../../src/server/db/client'
import {
  loadDatabaseEnvironment,
  requireDatabaseEnvironment,
} from '../../src/server/db/environment'
import {
  seedAuthenticationUsers,
  seedCatalogProducts,
  seedCouponFixtures,
} from '../../src/server/db/seed'

loadDatabaseEnvironment()

const client = createDatabaseClient(requireDatabaseEnvironment('DATABASE_URL'))

try {
  await seedAuthenticationUsers(client.db)
  await seedCatalogProducts(client.db)
  await seedCouponFixtures(client.db)
  console.info('開発DBへ認証・商品・クーポンseedを適用しました。')
} finally {
  await client.close()
}
