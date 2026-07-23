import { Client, type PoolClient } from 'pg'

const EXPECTED_TEST_DATABASE = 'mockshop_test'

type DatabaseTarget = {
  database: string
  host: string
  port: string
}

type TestDatabaseGuardOptions = {
  developmentDatabaseUrl?: string
  nodeEnv?: string
  testDatabaseUrl: string
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

export function assertSafeTestDatabaseUrl({
  developmentDatabaseUrl,
  nodeEnv,
  testDatabaseUrl,
}: TestDatabaseGuardOptions) {
  if (nodeEnv !== 'test') {
    throw new Error('テストDBの破壊操作はNODE_ENV=testでのみ実行できます。')
  }

  const testTarget = parseDatabaseTarget(testDatabaseUrl)
  if (testTarget.database !== EXPECTED_TEST_DATABASE) {
    throw new Error(`テストDB名は ${EXPECTED_TEST_DATABASE} である必要があります。`)
  }

  if (developmentDatabaseUrl) {
    const developmentTarget = parseDatabaseTarget(developmentDatabaseUrl)
    if (targetKey(testTarget) === targetKey(developmentTarget)) {
      throw new Error('TEST_DATABASE_URLとDATABASE_URLに同じ接続先は指定できません。')
    }
  }

  return testTarget
}

export async function assertConnectedTestDatabase(
  client: PoolClient,
  options: TestDatabaseGuardOptions,
) {
  const expectedTarget = assertSafeTestDatabaseUrl(options)
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
