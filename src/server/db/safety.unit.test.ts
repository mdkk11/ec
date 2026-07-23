import { describe, expect, it } from 'vitest'

import { assertSafeTestDatabaseUrl } from './safety'

const safeTestDatabaseUrl =
  'postgresql://mockshop:mockshop_local@localhost:5433/mockshop_test'

describe('assertSafeTestDatabaseUrl', () => {
  it('専用のテストDB接続先を許可する', () => {
    expect(
      assertSafeTestDatabaseUrl({
        developmentDatabaseUrl:
          'postgresql://mockshop:mockshop_local@localhost:5432/mockshop_dev',
        nodeEnv: 'test',
        testDatabaseUrl: safeTestDatabaseUrl,
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
      options: { nodeEnv: 'development', testDatabaseUrl: safeTestDatabaseUrl },
    },
    {
      name: '開発DB名',
      options: {
        nodeEnv: 'test',
        testDatabaseUrl:
          'postgresql://mockshop:mockshop_local@localhost:5432/mockshop_dev',
      },
    },
    {
      name: '開発DBと同じ接続先',
      options: {
        developmentDatabaseUrl:
          'postgresql://other:password@127.0.0.1:5433/mockshop_test',
        nodeEnv: 'test',
        testDatabaseUrl: safeTestDatabaseUrl,
      },
    },
    {
      name: 'query parameterで開発DBへ向けた接続先',
      options: {
        developmentDatabaseUrl:
          'postgresql://mockshop:mockshop_local@localhost:5432/mockshop_test',
        nodeEnv: 'test',
        testDatabaseUrl:
          'postgresql://mockshop:mockshop_local@localhost:5433/mockshop_test?host=localhost&port=5432',
      },
    },
    {
      name: 'query parameterでIPv6 loopbackへ向けた接続先',
      options: {
        developmentDatabaseUrl:
          'postgresql://mockshop:mockshop_local@localhost:5433/mockshop_test',
        nodeEnv: 'test',
        testDatabaseUrl:
          'postgresql://mockshop:mockshop_local@db.invalid:5433/mockshop_test?host=%3A%3A1',
      },
    },
    {
      name: 'PostgreSQL以外のURL',
      options: {
        nodeEnv: 'test',
        testDatabaseUrl: 'https://localhost:5433/mockshop_test',
      },
    },
  ])('$nameを拒否する', ({ options }) => {
    expect(() => assertSafeTestDatabaseUrl(options)).toThrow()
  })
})
