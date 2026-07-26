import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DELETE as removeCouponRoute,
  PUT as applyCouponRoute,
} from '@/app/api/cart/coupon/route'
import { POST as addCartItemRoute } from '@/app/api/cart/items/route'
import { GET as getCartRoute } from '@/app/api/cart/route'
import { Temporal } from '@/lib/date-time/temporal'
import { hashSessionToken } from '@/server/auth/session-token'
import {
  carts,
  coupons,
  sessions,
} from '@/server/db/schema'
import {
  seedAuthenticationUsers,
  seedCatalogProducts,
  seedCouponCodes,
  seedCouponFixtures,
} from '@/server/db/seed'
import { backendDatabase } from '@/test/backend/database'

const baseUrl = 'http://localhost:3000/api/cart'
const customerId = '10000000-0000-4000-8000-000000000001'
const adminId = '20000000-0000-4000-8000-000000000001'
const productId = '30000000-0000-4000-8000-000000000001'
const testNow = Temporal.Instant.from('2026-07-26T00:00:00Z')

async function prepareFixtures() {
  await seedAuthenticationUsers(backendDatabase.db)
  await seedCatalogProducts(backendDatabase.db)
  await seedCouponFixtures(backendDatabase.db)
}

async function createCookie(userId = customerId) {
  const token = `coupon-session-${userId}`
  await backendDatabase.db.insert(sessions).values({
    createdAt: '2026-07-01T00:00:00Z',
    expiresAt: '2030-07-01T00:00:00Z',
    tokenHash: hashSessionToken(token),
    userId,
  })
  return `mockshop_session=${token}`
}

function request(
  method: 'DELETE' | 'GET' | 'POST' | 'PUT',
  path: string,
  cookie: string,
  body?: unknown,
) {
  return new NextRequest(`${baseUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    method,
  })
}

function addItem(cookie: string) {
  return addCartItemRoute(
    request('POST', '/items', cookie, { productId, quantity: 1 }),
  )
}

function applyCoupon(cookie: string, code: string) {
  return applyCouponRoute(request('PUT', '/coupon', cookie, { code }))
}

function removeCoupon(cookie: string) {
  return removeCouponRoute(request('DELETE', '/coupon', cookie))
}

beforeEach(() => {
  vi.spyOn(Temporal.Now, 'instant').mockReturnValue(testNow)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('クーポンAPI', () => {
  it('COUPON-001: 小文字・前後空白を正規化して割引を適用する', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie)

    const response = await applyCoupon(cookie, '  welcome15  ')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.cart).toMatchObject({
      coupon: {
        code: 'WELCOME15',
        discountPercent: 15,
        minimumSubtotal: 10_000,
      },
      discountAmount: 4_290,
      subtotal: 28_600,
      total: 24_310,
      version: 3,
    })
    expect(body.cart.checkoutToken).toMatch(/^[0-9a-f]{64}$/u)
  })

  it.each([
    ['COUPON-002', 'MISSING', 404, 'COUPON_NOT_FOUND'],
    ['COUPON-003', seedCouponCodes.inactive, 400, 'COUPON_INACTIVE'],
    ['COUPON-004', seedCouponCodes.future, 400, 'COUPON_NOT_STARTED'],
    ['COUPON-005', seedCouponCodes.expired, 400, 'COUPON_EXPIRED'],
    [
      'COUPON-006',
      seedCouponCodes.minimum,
      400,
      'COUPON_MINIMUM_NOT_MET',
    ],
  ])('%s: 条件不成立を原因別エラーにしてカートを変更しない', async (
    _scenario,
    code,
    status,
    expectedCode,
  ) => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie)

    const response = await applyCoupon(cookie, code)
    const body = await response.json()

    expect(response.status).toBe(status)
    expect(body).toMatchObject({
      code: expectedCode,
      fieldErrors: { code: [expect.any(String)] },
    })
    await expect(backendDatabase.db.select().from(carts)).resolves.toMatchObject([
      { couponId: null, version: 2 },
    ])
  })

  it('失敗した新コードで適用済みクーポンを上書きしない', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie)
    const applied = await applyCoupon(cookie, seedCouponCodes.welcome)
    const before = (await applied.json()).cart

    const failed = await applyCoupon(cookie, seedCouponCodes.inactive)
    expect(failed.status).toBe(400)
    const current = await getCartRoute(request('GET', '', cookie))
    const after = (await current.json()).cart

    expect(after.coupon.code).toBe(seedCouponCodes.welcome)
    expect(after.version).toBe(before.version)
    expect(after.checkoutToken).toBe(before.checkoutToken)
  })

  it('COUPON-007/010: 解除してcoupon_idと割引を消しversionを1増やす', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie)
    await applyCoupon(cookie, seedCouponCodes.welcome)

    const response = await removeCoupon(cookie)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.cart).toMatchObject({
      coupon: null,
      discountAmount: 0,
      subtotal: 28_600,
      total: 28_600,
      version: 4,
    })
  })

  it('COUPON-009: 適用済みクーポンの期限切れをissueにしてtokenを返さない', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie)
    const [expiredCoupon] = await backendDatabase.db
      .select({ id: coupons.id })
      .from(coupons)
      .where(eq(coupons.code, seedCouponCodes.expired))
    await backendDatabase.db
      .update(carts)
      .set({ couponId: expiredCoupon!.id })
      .where(eq(carts.userId, customerId))

    const response = await getCartRoute(request('GET', '', cookie))
    const body = await response.json()

    expect(body.cart).toMatchObject({
      checkoutToken: null,
      coupon: { code: seedCouponCodes.expired },
      discountAmount: 0,
      issues: [{ code: 'COUPON_EXPIRED' }],
      total: 28_600,
    })
  })

  it('COUPON-011: 同じ有効コードの再適用はversionとtokenを変えない', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie)
    const first = (await (
      await applyCoupon(cookie, seedCouponCodes.welcome)
    ).json()).cart

    const secondResponse = await applyCoupon(
      cookie,
      ` ${seedCouponCodes.welcome.toLowerCase()} `,
    )
    const second = (await secondResponse.json()).cart

    expect(secondResponse.status).toBe(200)
    expect(second.version).toBe(first.version)
    expect(second.checkoutToken).toBe(first.checkoutToken)
  })

  it('空カートを小計0円として通常の最低購入額判定に渡す', async () => {
    await prepareFixtures()
    const cookie = await createCookie()

    const response = await applyCoupon(cookie, seedCouponCodes.welcome)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      code: 'COUPON_MINIMUM_NOT_MET',
    })
  })

  it('AUTH-010: adminのクーポン適用・解除を403にする', async () => {
    await prepareFixtures()
    const cookie = await createCookie(adminId)

    const applyResponse = await applyCoupon(cookie, seedCouponCodes.welcome)
    const removeResponse = await removeCoupon(cookie)

    expect(applyResponse.status).toBe(403)
    expect(removeResponse.status).toBe(403)
    await expect(backendDatabase.db.select().from(carts)).resolves.toHaveLength(0)
  })
})

describe('DB-006: クーポンDB制約', () => {
  const validCoupon = {
    code: 'VALID10',
    discountPercent: 10,
    endsAt: '2027-01-01T00:00:00Z',
    isActive: true,
    minimumSubtotal: 0,
    startsAt: '2026-01-01T00:00:00Z',
  }

  it.each([
    { label: '空コード', override: { code: '' } },
    { label: '非正規化コード', override: { code: ' lower10 ' } },
    { label: '割引率0', override: { discountPercent: 0 } },
    { label: '割引率101', override: { discountPercent: 101 } },
    { label: '負の最低購入額', override: { minimumSubtotal: -1 } },
    {
      label: '不正期間',
      override: {
        endsAt: '2026-01-01T00:00:00Z',
        startsAt: '2026-01-01T00:00:00Z',
      },
    },
  ])('$labelを拒否する', async ({ override }) => {
    await expect(
      backendDatabase.db
        .insert(coupons)
        .values({ ...validCoupon, ...override }),
    ).rejects.toThrow()
  })

  it('重複コードと存在しないcoupon_idを拒否する', async () => {
    await prepareFixtures()
    await backendDatabase.db.insert(coupons).values(validCoupon)
    await expect(
      backendDatabase.db.insert(coupons).values(validCoupon),
    ).rejects.toThrow()

    await expect(
      backendDatabase.db.insert(carts).values({
        couponId: '99999999-9999-4999-8999-999999999999',
        userId: customerId,
      }),
    ).rejects.toThrow()
  })
})
