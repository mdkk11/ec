import type { Pool } from 'pg'

import { assertConnectedTestDatabase } from './safety'

type TestDatabaseLifecycleOptions = {
  developmentDatabaseUrl?: string
  nodeEnv?: string
  testDatabaseUrl: string
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`
}

export async function resetTestDatabase(
  pool: Pool,
  options: TestDatabaseLifecycleOptions,
) {
  const client = await pool.connect()

  try {
    await client.query('begin')

    await assertConnectedTestDatabase(client, options)
    await client.query('drop schema if exists drizzle cascade')

    await assertConnectedTestDatabase(client, options)
    await client.query('drop schema if exists public cascade')
    await client.query('create schema public')

    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function truncateApplicationTables(
  pool: Pool,
  options: TestDatabaseLifecycleOptions,
) {
  const client = await pool.connect()

  try {
    const result = await client.query<{ tablename: string }>(
      `select tablename
         from pg_tables
        where schemaname = 'public'
        order by tablename`,
    )

    if (result.rows.length === 0) return

    await assertConnectedTestDatabase(client, options)
    const tableNames = result.rows.map(({ tablename }) => `public.${quoteIdentifier(tablename)}`)
    await client.query(`truncate table ${tableNames.join(', ')} restart identity cascade`)
  } finally {
    client.release()
  }
}
