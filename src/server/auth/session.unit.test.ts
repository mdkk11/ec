import { describe, expect, it } from 'vitest'

import { Temporal } from '@/lib/date-time/temporal'

import { requireAdmin, requireCustomer } from './authorization'
import {
  createExpiredSessionCookieOptions,
  createSessionCookieOptions,
  createSessionExpiration,
  SESSION_DURATION_SECONDS,
} from './session-cookie'
import { createSessionToken, hashSessionToken } from './session-token'

const customer = {
  email: 'customer@example.test',
  id: '10000000-0000-4000-8000-000000000001',
  role: 'customer' as const,
}
const admin = {
  email: 'admin@example.test',
  id: '20000000-0000-4000-8000-000000000001',
  role: 'admin' as const,
}

describe('session tokenとCookie', () => {
  it('32 bytesのtokenを作り、DB保存用SHA-256 hashへ変換する', () => {
    const token = createSessionToken()

    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('7日後の有効期限とCookie属性を返す', () => {
    const now = Temporal.Instant.from('2026-07-24T00:00:00Z')

    expect(createSessionExpiration(now).toString()).toBe('2026-07-31T00:00:00Z')
    expect(createSessionCookieOptions('development')).toEqual({
      httpOnly: true,
      maxAge: SESSION_DURATION_SECONDS,
      path: '/',
      sameSite: 'lax',
      secure: false,
    })
    expect(createSessionCookieOptions('production').secure).toBe(true)
    expect(createExpiredSessionCookieOptions('production').maxAge).toBe(0)
  })

  it('専用dist・許可したE2E DBが一致するHTTP serverだけSecureを解除する', () => {
    const e2eDatabaseUrl = 'postgresql://mockshop:mockshop@127.0.0.1:5434/mockshop_e2e'

    expect(
      createSessionCookieOptions('production', {
        DATABASE_URL: e2eDatabaseUrl,
        E2E_DATABASE_URL: e2eDatabaseUrl,
        E2E_HTTP_SERVER: 'true',
        NEXT_DIST_DIR: '.next-e2e',
      }).secure,
    ).toBe(false)
    const ciDatabaseUrl = 'postgresql://mockshop:mockshop@postgres:5432/mockshop_e2e'
    expect(
      createSessionCookieOptions('production', {
        DATABASE_URL: ciDatabaseUrl,
        E2E_DATABASE_URL: ciDatabaseUrl,
        E2E_HTTP_SERVER: 'true',
        GITHUB_ACTIONS: 'true',
        NEXT_DIST_DIR: '.next-e2e',
      }).secure,
    ).toBe(false)
    expect(() =>
      createSessionCookieOptions('production', {
        DATABASE_URL: ciDatabaseUrl,
        E2E_DATABASE_URL: ciDatabaseUrl,
        E2E_HTTP_SERVER: 'true',
        NEXT_DIST_DIR: '.next-e2e',
      }),
    ).toThrow('許可した専用DB')
  })
})

describe('role helper', () => {
  it('customerとadminを別権限として扱う', () => {
    expect(requireCustomer(customer)).toEqual({ actor: customer, ok: true })
    expect(requireAdmin(customer)).toEqual({ code: 'FORBIDDEN', ok: false })
    expect(requireAdmin(admin)).toEqual({ actor: admin, ok: true })
    expect(requireCustomer(admin)).toEqual({ code: 'FORBIDDEN', ok: false })
    expect(requireCustomer(null)).toEqual({
      code: 'UNAUTHENTICATED',
      ok: false,
    })
  })
})
