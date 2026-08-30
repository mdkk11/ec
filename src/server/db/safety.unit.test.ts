import { describe, expect, it } from 'vitest'

import { assertSafeDatabaseUrl } from './safety'

const safeTestDatabaseUrl = 'postgresql://mockshop:mockshop_local@localhost:5433/mockshop_test'

describe('assertSafeDatabaseUrl', () => {
  it('専用のテストDB接続先を許可する', () => {
    expect(
      assertSafeDatabaseUrl({
        developmentDatabaseUrl: 'postgresql://mockshop:mockshop_local@localhost:5432/mockshop_dev',
        expectedDatabase: 'mockshop_test',
        nodeEnv: 'test',
        targetDatabaseUrl: safeTestDatabaseUrl,
      }),
    ).toEqual({
      database: 'mockshop_test',
      host: 'loopback',
      port: '5433',
    })
  })

  it.each([
    {
      name: 'test以外の環境',
      options: {
        expectedDatabase: 'mockshop_test' as const,
        nodeEnv: 'development',
        targetDatabaseUrl: safeTestDatabaseUrl,
      },
    },
    {
      name: '開発DB名',
      options: {
        expectedDatabase: 'mockshop_test' as const,
        nodeEnv: 'test',
        targetDatabaseUrl: 'postgresql://mockshop:mockshop_local@localhost:5432/mockshop_dev',
      },
    },
    {
      name: '開発DBと同じ接続先',
      options: {
        expectedDatabase: 'mockshop_test' as const,
        developmentDatabaseUrl: 'postgresql://other:password@127.0.0.1:5433/mockshop_test',
        nodeEnv: 'test',
        targetDatabaseUrl: safeTestDatabaseUrl,
      },
    },
    {
      name: 'query parameterで開発DBへ向けた接続先',
      options: {
        expectedDatabase: 'mockshop_test' as const,
        developmentDatabaseUrl: 'postgresql://mockshop:mockshop_local@localhost:5432/mockshop_test',
        nodeEnv: 'test',
        targetDatabaseUrl:
          'postgresql://mockshop:mockshop_local@localhost:5433/mockshop_test?host=localhost&port=5432',
      },
    },
    {
      name: 'query parameterでIPv6 loopbackへ向けた接続先',
      options: {
        expectedDatabase: 'mockshop_test' as const,
        developmentDatabaseUrl: 'postgresql://mockshop:mockshop_local@localhost:5433/mockshop_test',
        nodeEnv: 'test',
        targetDatabaseUrl:
          'postgresql://mockshop:mockshop_local@db.invalid:5433/mockshop_test?host=%3A%3A1',
      },
    },
    {
      name: 'PostgreSQL以外のURL',
      options: {
        expectedDatabase: 'mockshop_test' as const,
        nodeEnv: 'test',
        targetDatabaseUrl: 'https://localhost:5433/mockshop_test',
      },
    },
  ])('$nameを拒否する', ({ options }) => {
    expect(() => assertSafeDatabaseUrl(options)).toThrow()
  })

  it('専用のE2E DB接続先を許可する', () => {
    expect(
      assertSafeDatabaseUrl({
        developmentDatabaseUrl: 'postgresql://mockshop:mockshop_local@localhost:5432/mockshop_dev',
        expectedDatabase: 'mockshop_e2e',
        nodeEnv: 'test',
        targetDatabaseUrl: 'postgresql://mockshop:mockshop_local@localhost:5434/mockshop_e2e',
      }),
    ).toMatchObject({ database: 'mockshop_e2e', port: '5434' })
  })
})
