import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import {
  categoryCatalog,
  categoryIds,
} from '@/features/categories/category-catalog'
import { createDatabaseClient } from '@/server/db/client'
import { migrateDatabase, migrationsFolder } from '@/server/db/migrate'
import {
  backendDatabase,
  testDatabaseUrl,
} from '@/test/backend/database'

const upgradeDatabaseName = 'mockshop_category_migration_test'

describe('DB基盤', () => {
  it('DB-001: 空のPostgreSQLへ全migrationを適用できる', async () => {
    const databaseResult = await backendDatabase.db.execute<{ currentDatabase: string }>(
      sql`select current_database() as "currentDatabase"`,
    )
    expect(databaseResult.rows[0]?.currentDatabase).toBe('mockshop_test')

    const journal = JSON.parse(
      await readFile(resolve(migrationsFolder, 'meta/_journal.json'), 'utf8'),
    ) as { entries: unknown[] }
    const expectedMigrationCount = String(journal.entries.length)

    const migrationCountBefore = await backendDatabase.pool.query<{ count: string }>(
      'select count(*)::text as count from drizzle.__drizzle_migrations',
    )
    expect(migrationCountBefore.rows[0]?.count).toBe(expectedMigrationCount)

    await migrateDatabase(backendDatabase.db)

    const migrationCountAfter = await backendDatabase.pool.query<{ count: string }>(
      'select count(*)::text as count from drizzle.__drizzle_migrations',
    )
    expect(migrationCountAfter.rows[0]?.count).toBe(expectedMigrationCount)
  })

  it('既存商品を持つ0005 DBをotherへbackfillして0006へ移行できる', async () => {
    const testUrl = new URL(testDatabaseUrl)
    expect(['127.0.0.1', 'localhost']).toContain(testUrl.hostname)
    expect(testUrl.pathname).toBe('/mockshop_test')

    const temporaryFolder = await mkdtemp(
      resolve(tmpdir(), 'mockshop-category-migration-'),
    )
    const oldMigrationsFolder = resolve(temporaryFolder, 'drizzle')
    const oldMetaFolder = resolve(oldMigrationsFolder, 'meta')
    const upgradeUrl = new URL(testDatabaseUrl)
    upgradeUrl.pathname = `/${upgradeDatabaseName}`
    let upgradeDatabase: ReturnType<typeof createDatabaseClient> | undefined

    try {
      await backendDatabase.pool.query(
        `drop database if exists "${upgradeDatabaseName}"`,
      )
      await backendDatabase.pool.query(`create database "${upgradeDatabaseName}"`)

      await mkdir(oldMetaFolder, { recursive: true })
      const journal = JSON.parse(
        await readFile(resolve(migrationsFolder, 'meta/_journal.json'), 'utf8'),
      ) as { entries: { tag: string }[]; version: string; dialect: string }
      const oldEntries = journal.entries.filter(({ tag }) =>
        /^000[0-5]_/u.test(tag),
      )
      for (const { tag } of oldEntries) {
        await copyFile(
          resolve(migrationsFolder, `${tag}.sql`),
          resolve(oldMigrationsFolder, `${tag}.sql`),
        )
      }
      await writeFile(
        resolve(oldMetaFolder, '_journal.json'),
        JSON.stringify({ ...journal, entries: oldEntries }),
      )

      upgradeDatabase = createDatabaseClient(upgradeUrl.toString())
      const { migrate } = await import('drizzle-orm/node-postgres/migrator')
      await migrate(upgradeDatabase.db, { migrationsFolder: oldMigrationsFolder })
      const productId = '39999999-9999-4999-8999-999999999999'
      await upgradeDatabase.pool.query(
        `insert into products
          (id, name, description, price, image_path, is_published, stock, version)
         values ($1, '移行確認商品', '0005の商品です。', 1000, '/images/fixtures/product-placeholder.svg', true, 1, 1)`,
        [productId],
      )

      await migrateDatabase(upgradeDatabase.db)

      const categories = await upgradeDatabase.pool.query<{
        id: string
        name: string
        slug: string
        display_order: number
      }>('select id, name, slug, display_order from categories order by display_order')
      expect(categories.rows).toEqual(
        categoryCatalog.map(({ displayOrder, id, name, slug }) => ({
          display_order: displayOrder,
          id,
          name,
          slug,
        })),
      )
      const product = await upgradeDatabase.pool.query<{ category_id: string }>(
        'select category_id from products where id = $1',
        [productId],
      )
      expect(product.rows).toEqual([{ category_id: categoryIds.other }])
      await expect(
        upgradeDatabase.pool.query(
          'update products set category_id = null where id = $1',
          [productId],
        ),
      ).rejects.toThrow()
      await expect(
        upgradeDatabase.pool.query('delete from categories where id = $1', [categoryIds.other]),
      ).rejects.toThrow()
    } finally {
      await upgradeDatabase?.close()
      await backendDatabase.pool.query(
        'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1',
        [upgradeDatabaseName],
      )
      await backendDatabase.pool.query(
        `drop database if exists "${upgradeDatabaseName}"`,
      )
      await rm(temporaryFolder, { force: true, recursive: true })
    }
  })
})
