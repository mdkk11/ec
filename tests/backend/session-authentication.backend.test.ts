import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { DELETE, GET, POST } from '@/app/api/session/route'
import { sessions, users } from '@/server/db/schema'
import { seedAuthenticationUsers } from '@/server/db/seed'
import { hashSessionToken } from '@/server/auth/session-token'
import { backendDatabase } from '@/test/backend/database'

const sessionUrl = 'http://localhost:3000/api/session'

function postLogin(password = 'CustomerPass123!', email = '  CUSTOMER@EXAMPLE.TEST ') {
  return POST(
    new NextRequest(sessionUrl, {
      body: JSON.stringify({
        email,
        password,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }),
  )
}

function requestWithCookie(method: 'DELETE' | 'GET', cookie: string) {
  return new NextRequest(sessionUrl, {
    headers: {
      Cookie: cookie,
    },
    method,
  })
}

function sessionCookie(response: Response) {
  const setCookie = response.headers.get('set-cookie')
  const token = setCookie?.match(/mockshop_session=([^;]+)/u)?.[1]
  if (!setCookie || !token) throw new Error('session Cookieがありません。')
  return { cookie: `mockshop_session=${token}`, setCookie, token }
}

describe('session API', () => {
  it('AUTH-001: seed購入者を認証し、raw tokenはCookie、hashはDBだけへ保存する', async () => {
    await seedAuthenticationUsers(backendDatabase.db)

    const response = await postLogin()
    const body = await response.json()
    const { setCookie, token } = sessionCookie(response)

    expect(response.status).toBe(200)
    expect(body).toEqual({
      user: {
        email: 'customer@example.test',
        id: '10000000-0000-4000-8000-000000000001',
        role: 'customer',
      },
    })
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('SameSite=lax')
    expect(setCookie).toContain('Max-Age=604800')
    expect(setCookie).not.toContain('Secure')

    const records = await backendDatabase.db.select().from(sessions)
    expect(records).toHaveLength(1)
    expect(records[0]?.tokenHash).toBe(hashSessionToken(token))
    expect(records[0]?.tokenHash).not.toContain(token)

    const currentSessionResponse = await GET(requestWithCookie('GET', `mockshop_session=${token}`))
    expect(currentSessionResponse.status).toBe(200)
    expect(await currentSessionResponse.json()).toEqual(body)
  })

  it('AUTH-002: password違いと未知emailを同じ401にしてsessionを作らない', async () => {
    await seedAuthenticationUsers(backendDatabase.db)

    const wrongPasswordResponse = await postLogin('wrong-password')
    const unknownEmailResponse = await postLogin('wrong-password', 'unknown@example.test')

    expect(wrongPasswordResponse.status).toBe(401)
    expect(unknownEmailResponse.status).toBe(401)
    const wrongPasswordBody = await wrongPasswordResponse.json()
    expect(wrongPasswordBody).toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
    expect(await unknownEmailResponse.json()).toEqual(wrongPasswordBody)
    expect(wrongPasswordResponse.headers.get('set-cookie')).toBeNull()
    expect(unknownEmailResponse.headers.get('set-cookie')).toBeNull()
    await expect(backendDatabase.db.select().from(sessions)).resolves.toHaveLength(0)
  })

  it('null JSONをfieldErrorsなしの400にする', async () => {
    const response = await POST(
      new NextRequest(sessionUrl, {
        body: 'null',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      code: 'VALIDATION_ERROR',
      message: '入力内容を確認してください。',
    })
  })

  it('AUTH-005: Cookieがない場合は401を返す', async () => {
    const response = await GET(new NextRequest(sessionUrl))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('期限切れsessionを認証しない', async () => {
    await seedAuthenticationUsers(backendDatabase.db)
    const token = 'expired-session-token'
    await backendDatabase.db.insert(sessions).values({
      createdAt: '2020-01-01T00:00:00Z',
      expiresAt: '2020-01-08T00:00:00Z',
      tokenHash: hashSessionToken(token),
      userId: '10000000-0000-4000-8000-000000000001',
    })

    const response = await GET(requestWithCookie('GET', `mockshop_session=${token}`))

    expect(response.status).toBe(401)
  })

  it('期限切れsessionのlogoutは401でCookieだけを失効し、DB行を削除しない', async () => {
    await seedAuthenticationUsers(backendDatabase.db)
    const token = 'expired-logout-token'
    await backendDatabase.db.insert(sessions).values({
      createdAt: '2020-01-01T00:00:00Z',
      expiresAt: '2020-01-08T00:00:00Z',
      tokenHash: hashSessionToken(token),
      userId: '10000000-0000-4000-8000-000000000001',
    })

    const response = await DELETE(requestWithCookie('DELETE', `mockshop_session=${token}`))

    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    await expect(backendDatabase.db.select().from(sessions)).resolves.toHaveLength(1)
  })

  it('AUTH-008: logoutで当該sessionとCookieを失効し、再利用を401にする', async () => {
    await seedAuthenticationUsers(backendDatabase.db)
    const loginResponse = await postLogin()
    const { cookie } = sessionCookie(loginResponse)

    const logoutResponse = await DELETE(requestWithCookie('DELETE', cookie))

    expect(logoutResponse.status).toBe(204)
    expect(logoutResponse.headers.get('set-cookie')).toContain('Max-Age=0')
    await expect(backendDatabase.db.select().from(sessions)).resolves.toHaveLength(0)

    const currentSessionResponse = await GET(requestWithCookie('GET', cookie))
    expect(currentSessionResponse.status).toBe(401)
  })
})

describe('DB-005 / DB-007: usersとsessionsのDB制約', () => {
  it('固定の購入者・管理者seedを冪等に適用し、平文passwordを保存しない', async () => {
    await seedAuthenticationUsers(backendDatabase.db)
    await seedAuthenticationUsers(backendDatabase.db)

    const records = await backendDatabase.db
      .select({
        email: users.email,
        passwordHash: users.passwordHash,
        role: users.role,
      })
      .from(users)

    expect(records).toHaveLength(2)
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: 'customer@example.test',
          role: 'customer',
        }),
        expect.objectContaining({
          email: 'admin@example.test',
          role: 'admin',
        }),
      ]),
    )
    for (const record of records) {
      expect(record.passwordHash).toMatch(/^scrypt\$v1\$/u)
      expect(record.passwordHash).not.toContain('Pass123!')
    }
  })

  it('正規化されていないemailを拒否する', async () => {
    await expect(
      backendDatabase.db.insert(users).values({
        email: ' Customer@Example.Test ',
        passwordHash: 'hash',
        role: 'customer',
      }),
    ).rejects.toThrow()

    await expect(
      backendDatabase.db.insert(users).values({
        email: `${'a'.repeat(245)}@example.test`,
        passwordHash: 'hash',
        role: 'customer',
      }),
    ).rejects.toThrow()
  })

  it('emailの重複と不正roleを拒否する', async () => {
    await seedAuthenticationUsers(backendDatabase.db)

    await expect(
      backendDatabase.db.insert(users).values({
        email: 'customer@example.test',
        passwordHash: 'hash',
        role: 'customer',
      }),
    ).rejects.toThrow()

    await expect(
      backendDatabase.pool.query(
        `insert into users (email, password_hash, role)
         values ('invalid-role@example.test', 'hash', 'operator')`,
      ),
    ).rejects.toThrow()
  })

  it('sessionの不正token hash、重複token hash、存在しないuser FKを拒否する', async () => {
    await seedAuthenticationUsers(backendDatabase.db)
    const customerRows = await backendDatabase.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'customer@example.test'))
    const userId = customerRows[0]?.id
    if (!userId) throw new Error('seed customerがありません。')

    await expect(
      backendDatabase.db.insert(sessions).values({
        createdAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-01-08T00:00:00Z',
        tokenHash: 'not-a-sha256-hash',
        userId,
      }),
    ).rejects.toThrow()

    const tokenHash = 'a'.repeat(64)
    await backendDatabase.db.insert(sessions).values({
      createdAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-08T00:00:00Z',
      tokenHash,
      userId,
    })
    await expect(
      backendDatabase.db.insert(sessions).values({
        createdAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-01-08T00:00:00Z',
        tokenHash,
        userId,
      }),
    ).rejects.toThrow()

    await expect(
      backendDatabase.db.insert(sessions).values({
        createdAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-01-08T00:00:00Z',
        tokenHash: 'b'.repeat(64),
        userId: '99999999-9999-4999-8999-999999999999',
      }),
    ).rejects.toThrow()

    await expect(
      backendDatabase.db.insert(sessions).values({
        createdAt: '2026-01-08T00:00:00Z',
        expiresAt: '2026-01-08T00:00:00Z',
        tokenHash: 'c'.repeat(64),
        userId,
      }),
    ).rejects.toThrow()
  })
})
