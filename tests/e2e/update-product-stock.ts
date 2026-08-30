import { createDatabaseClient } from '@/server/db/client'
import { loadDatabaseEnvironment, requireDatabaseEnvironment } from '@/server/db/environment'
import { assertConnectedDatabase } from '@/server/db/safety'

export async function updateE2EProductStock(productId: string, stock: number) {
  loadDatabaseEnvironment()
  const e2eDatabaseUrl = requireDatabaseEnvironment('E2E_DATABASE_URL')
  const client = createDatabaseClient(e2eDatabaseUrl)
  const connection = await client.pool.connect()

  try {
    await assertConnectedDatabase(connection, {
      developmentDatabaseUrl: process.env.DATABASE_URL,
      expectedDatabase: 'mockshop_e2e',
      nodeEnv: process.env.NODE_ENV,
      targetDatabaseUrl: e2eDatabaseUrl,
    })
    const result = await connection.query(
      `update products
          set stock = $1,
              version = version + 1,
              updated_at = $2
        where id = $3`,
      [stock, '2026-07-30T00:00:00Z', productId],
    )
    if (result.rowCount !== 1) {
      throw new Error('E2E商品在庫を更新できませんでした。')
    }
  } finally {
    connection.release()
    await client.close()
  }
}
