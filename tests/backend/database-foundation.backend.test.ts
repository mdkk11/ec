import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { migrateDatabase } from '@/server/db/migrate'
import { backendDatabase } from '@/test/backend/database'

describe('DB基盤', () => {
  it('DB-001: 空のPostgreSQLへ全migrationを適用できる', async () => {
    const databaseResult = await backendDatabase.db.execute<{ currentDatabase: string }>(
      sql`select current_database() as "currentDatabase"`,
    )
    expect(databaseResult.rows[0]?.currentDatabase).toBe('mockshop_test')

    const migrationCountBefore = await backendDatabase.pool.query<{ count: string }>(
      'select count(*)::text as count from drizzle.__drizzle_migrations',
    )
    expect(migrationCountBefore.rows[0]?.count).toBe('1')

    await migrateDatabase(backendDatabase.db)

    const migrationCountAfter = await backendDatabase.pool.query<{ count: string }>(
      'select count(*)::text as count from drizzle.__drizzle_migrations',
    )
    expect(migrationCountAfter.rows[0]?.count).toBe('1')
  })
})
