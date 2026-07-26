import { Client, type PoolClient } from 'pg'

type DatabaseTarget = {
  database: string
  host: string
  port: string
}

type DestructiveDatabaseGuardOptions = {
  developmentDatabaseUrl?: string
  expectedDatabase: 'mockshop_test' | 'mockshop_e2e'
  nodeEnv?: string
  targetDatabaseUrl: string
}

function normalizeHost(hostname: string) {
  const host = hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]'
  ) {
    return 'loopback'
  }
  return host
}

function parseDatabaseTarget(connectionString: string): DatabaseTarget {
  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    throw new Error('PostgreSQL接続URLの形式が不正です。')
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('PostgreSQL接続URLを指定してください。')
  }

  const explicitDatabase = decodeURIComponent(url.pathname.replace(/^\/+/u, ''))
  if (!explicitDatabase || explicitDatabase.includes('/')) {
    throw new Error('PostgreSQL接続URLにDB名を1つ指定してください。')
  }

  const client = new Client({ connectionString })
  const database = client.database
  if (!database) {
    throw new Error('PostgreSQL接続URLにDB名を1つ指定してください。')
  }

  return {
    database,
    host: normalizeHost(client.host),
    port: String(client.port),
  }
}

function targetKey(target: DatabaseTarget) {
  return `${target.host}:${target.port}/${target.database}`
}

export function assertSafeDatabaseUrl({
  developmentDatabaseUrl,
  expectedDatabase,
  nodeEnv,
  targetDatabaseUrl,
}: DestructiveDatabaseGuardOptions) {
  if (nodeEnv !== 'test') {
    throw new Error('テストDBの破壊操作はNODE_ENV=testでのみ実行できます。')
  }

  const target = parseDatabaseTarget(targetDatabaseUrl)
  if (target.database !== expectedDatabase) {
    throw new Error(`テストDB名は ${expectedDatabase} である必要があります。`)
  }

  if (developmentDatabaseUrl) {
    const developmentTarget = parseDatabaseTarget(developmentDatabaseUrl)
    if (targetKey(target) === targetKey(developmentTarget)) {
      throw new Error('破壊対象DBとDATABASE_URLに同じ接続先は指定できません。')
    }
  }

  return target
}

export async function assertConnectedDatabase(
  client: PoolClient,
  options: DestructiveDatabaseGuardOptions,
) {
  const expectedTarget = assertSafeDatabaseUrl(options)
  const result = await client.query<{ currentDatabase: string }>(
    'select current_database() as "currentDatabase"',
  )
  const currentDatabase = result.rows[0]?.currentDatabase

  if (currentDatabase !== expectedTarget.database) {
    throw new Error(
      `接続先DBが想定と異なります。expected=${expectedTarget.database}, actual=${currentDatabase ?? 'unknown'}`,
    )
  }
}
