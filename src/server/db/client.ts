import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

export function createDatabaseClient(connectionString: string) {
  const pool = new Pool({ connectionString })
  const db = drizzle({ client: pool })

  return {
    db,
    pool,
    close: () => pool.end(),
  }
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>
