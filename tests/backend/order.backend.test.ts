import { asc, eq, sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  GET as getOrderDetailRoute,
} from '@/app/api/orders/[orderId]/route'
import {
  GET as listOrdersRoute,
  POST as createOrderRoute,
} from '@/app/api/orders/route'
import { PUT as applyCouponRoute } from '@/app/api/cart/coupon/route'
import { POST as addCartItemRoute } from '@/app/api/cart/items/route'
import { GET as getCartRoute } from '@/app/api/cart/route'
import { Temporal } from '@/lib/date-time/temporal'
import { hashSessionToken } from '@/server/auth/session-token'
import {
  cartItems,
  carts,
  coupons,
  orderItems,
  orders,
  products,
  sessions,
  users,
} from '@/server/db/schema'
import {
  seedAuthenticationUsers,
  seedCatalogProducts,
  seedCouponCodes,
  seedCouponFixtures,
} from '@/server/db/seed'
import { backendDatabase } from '@/test/backend/database'

const apiBaseUrl = 'http://localhost:3000/api'
const customerId = '10000000-0000-4000-8000-000000000001'
const adminId = '20000000-0000-4000-8000-000000000001'
const otherCustomerId = '10000000-0000-4000-8000-000000000099'
const productId = '30000000-0000-4000-8000-000000000001'
const secondProductId = '30000000-0000-4000-8000-000000000003'
const testNow = Temporal.Instant.from('2026-07-30T00:00:00Z')

async function prepareFixtures() {
  await seedAuthenticationUsers(backendDatabase.db)
  await seedCatalogProducts(backendDatabase.db)
  await seedCouponFixtures(backendDatabase.db)
}

async function createOtherCustomer() {
  await backendDatabase.db.insert(users).values({
    createdAt: testNow.toString(),
    email: 'order-other@example.test',
    id: otherCustomerId,
    passwordHash: 'test-password-hash',
    role: 'customer',
  })
}

async function createCookie(
  userId = customerId,
  { expired = false }: { expired?: boolean } = {},
) {
  const token = `order-session-${userId}-${expired ? 'expired' : 'active'}`
  await backendDatabase.db.insert(sessions).values({
    createdAt: expired ? '2020-01-01T00:00:00Z' : '2026-07-01T00:00:00Z',
    expiresAt: expired ? '2021-01-01T00:00:00Z' : '2030-07-01T00:00:00Z',
    tokenHash: hashSessionToken(token),
    userId,
  })
  return `mockshop_session=${token}`
}

function request(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  cookie = '',
  body?: unknown,
) {
  return new NextRequest(`${apiBaseUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    method,
  })
}

async function addItem(
  cookie: string,
  selectedProductId = productId,
  quantity = 1,
) {
  const response = await addCartItemRoute(
    request('POST', '/cart/items', cookie, {
      productId: selectedProductId,
      quantity,
    }),
  )
  expect(response.status).toBe(201)
}

async function applyCoupon(cookie: string) {
  const response = await applyCouponRoute(
    request('PUT', '/cart/coupon', cookie, {
      code: seedCouponCodes.welcome,
    }),
  )
  expect(response.status).toBe(200)
}

async function getCheckoutToken(cookie: string) {
  const response = await getCartRoute(request('GET', '/cart', cookie))
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body.cart.checkoutToken).toMatch(/^[0-9a-f]{64}$/u)
  return body.cart.checkoutToken as string
}

function submitOrder(cookie: string, checkoutToken: string) {
  return createOrderRoute(
    request('POST', '/orders', cookie, { checkoutToken }),
  )
}

beforeEach(() => {
  vi.spyOn(Temporal.Now, 'instant').mockReturnValue(testNow)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('注文確定API', () => {
  it('ORDER-001: 最新値をsnapshot保存し、在庫・version・cart clearをcommitする', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie, productId, 2)
    await applyCoupon(cookie)
    const checkoutToken = await getCheckoutToken(cookie)

    const response = await submitOrder(cookie, checkoutToken)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body.order).toMatchObject({
      couponCode: seedCouponCodes.welcome,
      discountAmount: 8_580,
      discountPercent: 15,
      items: [
        {
          lineTotal: 57_200,
          productId,
          productName: 'リネンブレンド オーバーシャツ',
          quantity: 2,
          unitPrice: 28_600,
        },
      ],
      status: 'received',
      subtotal: 57_200,
      total: 48_620,
      version: 1,
    })
    await expect(
      backendDatabase.db
        .select({ stock: products.stock, version: products.version })
        .from(products)
        .where(eq(products.id, productId)),
    ).resolves.toEqual([{ stock: 6, version: 2 }])
    await expect(backendDatabase.db.select().from(orders)).resolves.toHaveLength(
      1,
    )
    await expect(
      backendDatabase.db.select().from(orderItems),
    ).resolves.toMatchObject([
      {
        productName: 'リネンブレンド オーバーシャツ',
        quantity: 2,
        unitPrice: 28_600,
      },
    ])
    await expect(
      backendDatabase.db.select().from(cartItems),
    ).resolves.toHaveLength(0)
    await expect(
      backendDatabase.db
        .select({ couponId: carts.couponId, version: carts.version })
        .from(carts),
    ).resolves.toEqual([{ couponId: null, version: 4 }])
  })

  it('ORDER-001: 32-bit整数を超える安全な金額もsnapshot保存する', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await backendDatabase.db
      .update(products)
      .set({ price: 1_500_000_000 })
      .where(eq(products.id, productId))
    await addItem(cookie, productId, 2)
    const checkoutToken = await getCheckoutToken(cookie)

    const response = await submitOrder(cookie, checkoutToken)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.order).toMatchObject({
      items: [{ lineTotal: 3_000_000_000, unitPrice: 1_500_000_000 }],
      subtotal: 3_000_000_000,
      total: 3_000_000_000,
    })
    await expect(
      backendDatabase.db
        .select({ subtotal: orders.subtotal, total: orders.total })
        .from(orders),
    ).resolves.toEqual([
      { subtotal: 3_000_000_000, total: 3_000_000_000 },
    ])
  })

  it('ORDER-002: 空cartを400にして注文を作らない', async () => {
    await prepareFixtures()
    const cookie = await createCookie()

    const response = await submitOrder(cookie, 'a'.repeat(64))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'EMPTY_CART' })
    await expect(backendDatabase.db.select().from(orders)).resolves.toHaveLength(
      0,
    )
  })

  it('ORDER-006: 確認後の価格変更をCHECKOUT_CHANGEDにする', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie)
    const checkoutToken = await getCheckoutToken(cookie)
    await backendDatabase.db
      .update(products)
      .set({
        price: 29_000,
        version: sql`${products.version} + 1`,
      })
      .where(eq(products.id, productId))

    const response = await submitOrder(cookie, checkoutToken)

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: 'CHECKOUT_CHANGED',
    })
    await expect(backendDatabase.db.select().from(orders)).resolves.toHaveLength(
      0,
    )
  })

  it('COUPON-008: 確認後のcoupon無効化をCHECKOUT_CHANGEDにする', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie)
    await applyCoupon(cookie)
    const checkoutToken = await getCheckoutToken(cookie)
    await backendDatabase.db
      .update(coupons)
      .set({ isActive: false })
      .where(eq(coupons.code, seedCouponCodes.welcome))

    const response = await submitOrder(cookie, checkoutToken)

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: 'CHECKOUT_CHANGED',
    })
    await expect(backendDatabase.db.select().from(orders)).resolves.toHaveLength(
      0,
    )
  })

  it('ORDER-005: 複数商品の在庫不足で全更新をrollbackする', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie, productId)
    await addItem(cookie, secondProductId)
    const checkoutToken = await getCheckoutToken(cookie)
    await backendDatabase.db
      .update(products)
      .set({
        stock: 0,
        version: sql`${products.version} + 1`,
      })
      .where(eq(products.id, secondProductId))

    const response = await submitOrder(cookie, checkoutToken)

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: 'STOCK_CONFLICT',
    })
    await expect(
      backendDatabase.db
        .select({
          id: products.id,
          stock: products.stock,
          version: products.version,
        })
        .from(products)
        .where(eq(products.id, productId)),
    ).resolves.toEqual([{ id: productId, stock: 8, version: 1 }])
    await expect(backendDatabase.db.select().from(orders)).resolves.toHaveLength(
      0,
    )
    await expect(backendDatabase.db.select().from(cartItems)).resolves.toHaveLength(
      2,
    )
  })

  it('ORDER-004: 最後の在庫への別customer同時注文は1件だけ成功する', async () => {
    await prepareFixtures()
    await createOtherCustomer()
    await backendDatabase.db
      .update(products)
      .set({ stock: 1 })
      .where(eq(products.id, productId))
    const firstCookie = await createCookie(customerId)
    const secondCookie = await createCookie(otherCustomerId)
    await addItem(firstCookie)
    await addItem(secondCookie)
    const firstToken = await getCheckoutToken(firstCookie)
    const secondToken = await getCheckoutToken(secondCookie)

    const responses = await Promise.all([
      submitOrder(firstCookie, firstToken),
      submitOrder(secondCookie, secondToken),
    ])

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409])
    const failed = responses.find(({ status }) => status === 409)
    expect(await failed?.json()).toMatchObject({ code: 'STOCK_CONFLICT' })
    await expect(backendDatabase.db.select().from(orders)).resolves.toHaveLength(
      1,
    )
    await expect(
      backendDatabase.db
        .select({ stock: products.stock })
        .from(products)
        .where(eq(products.id, productId)),
    ).resolves.toEqual([{ stock: 0 }])
  })

  it('ORDER-012: 同じcartの同時送信は注文を1件だけ作成する', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie)
    const checkoutToken = await getCheckoutToken(cookie)

    const responses = await Promise.all([
      submitOrder(cookie, checkoutToken),
      submitOrder(cookie, checkoutToken),
    ])

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 400])
    const failed = responses.find(({ status }) => status === 400)
    expect(await failed?.json()).toMatchObject({ code: 'EMPTY_CART' })
    await expect(backendDatabase.db.select().from(orders)).resolves.toHaveLength(
      1,
    )
  })

  it('ORDER-013: 同額でも商品構成が変わったtokenを拒否する', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie)
    const checkoutToken = await getCheckoutToken(cookie)
    await backendDatabase.db
      .update(products)
      .set({ price: 28_600 })
      .where(eq(products.id, secondProductId))
    const [cart] = await backendDatabase.db
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.userId, customerId))
    await backendDatabase.db
      .delete(cartItems)
      .where(eq(cartItems.cartId, cart!.id))
    await backendDatabase.db.insert(cartItems).values({
      cartId: cart!.id,
      productId: secondProductId,
      quantity: 1,
    })
    await backendDatabase.db
      .update(carts)
      .set({ version: sql`${carts.version} + 1` })
      .where(eq(carts.id, cart!.id))

    const response = await submitOrder(cookie, checkoutToken)

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: 'CHECKOUT_CHANGED',
    })
    await expect(backendDatabase.db.select().from(orders)).resolves.toHaveLength(
      0,
    )
  })

  it('ORDER-014: 確認後の非公開化を拒否しcart明細を保持する', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie)
    const checkoutToken = await getCheckoutToken(cookie)
    await backendDatabase.db
      .update(products)
      .set({ isPublished: false })
      .where(eq(products.id, productId))

    const response = await submitOrder(cookie, checkoutToken)

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: 'CHECKOUT_CHANGED',
    })
    await expect(backendDatabase.db.select().from(cartItems)).resolves.toHaveLength(
      1,
    )
  })
})

describe('注文履歴・詳細API', () => {
  it('ORDER-008/009: 自分の注文を固定順・snapshotで返す', async () => {
    await prepareFixtures()
    const cookie = await createCookie()
    await addItem(cookie)
    const checkoutToken = await getCheckoutToken(cookie)
    const createdResponse = await submitOrder(cookie, checkoutToken)
    const createdOrder = (await createdResponse.json()).order
    await backendDatabase.db
      .update(products)
      .set({ name: '更新後の商品名', price: 99_999 })
      .where(eq(products.id, productId))
    await backendDatabase.db.insert(orders).values([
      {
        createdAt: testNow.toString(),
        discountAmount: 0,
        id: '70000000-0000-4000-8000-000000000010',
        status: 'received',
        subtotal: 0,
        total: 0,
        updatedAt: testNow.toString(),
        userId: customerId,
      },
      {
        createdAt: testNow.toString(),
        discountAmount: 0,
        id: '70000000-0000-4000-8000-000000000011',
        status: 'received',
        subtotal: 0,
        total: 0,
        updatedAt: testNow.toString(),
        userId: customerId,
      },
    ])

    const listResponse = await listOrdersRoute(
      request('GET', '/orders', cookie),
    )
    const listBody = await listResponse.json()
    const detailResponse = await getOrderDetailRoute(
      request('GET', `/orders/${createdOrder.id}`, cookie),
      { params: Promise.resolve({ orderId: createdOrder.id }) },
    )
    const detailBody = await detailResponse.json()

    expect(listResponse.status).toBe(200)
    expect(
      listBody.items
        .map(({ id }: { id: string }) => id)
        .filter((id: string) => id.startsWith('70000000-')),
    ).toEqual([
      '70000000-0000-4000-8000-000000000011',
      '70000000-0000-4000-8000-000000000010',
    ])
    expect(detailBody.order.items[0]).toMatchObject({
      productName: 'リネンブレンド オーバーシャツ',
      unitPrice: 28_600,
    })
    expect(detailBody.order.items[0].productName).not.toBe('更新後の商品名')
  })

  it('AUTH-009: 他customerの注文を未存在と同じ404にする', async () => {
    await prepareFixtures()
    await createOtherCustomer()
    const firstCookie = await createCookie()
    const otherCookie = await createCookie(otherCustomerId)
    await addItem(firstCookie)
    const checkoutToken = await getCheckoutToken(firstCookie)
    const created = await submitOrder(firstCookie, checkoutToken)
    const orderId = (await created.json()).order.id as string

    const response = await getOrderDetailRoute(
      request('GET', `/orders/${orderId}`, otherCookie),
      { params: Promise.resolve({ orderId }) },
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      code: 'ORDER_NOT_FOUND',
      message: '注文が見つかりませんでした。',
    })
  })
})

describe('注文APIの認証・入力境界', () => {
  it('AUTH-007: 期限切れsessionで履歴APIを401にする', async () => {
    await prepareFixtures()
    const cookie = await createCookie(customerId, { expired: true })

    const response = await listOrdersRoute(request('GET', '/orders', cookie))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('POST・履歴GET・詳細GETを未認証401、admin 403にする', async () => {
    await prepareFixtures()
    const adminCookie = await createCookie(adminId)
    const orderId = '70000000-0000-4000-8000-000000000001'
    const unauthenticated = [
      await submitOrder('', 'a'.repeat(64)),
      await listOrdersRoute(request('GET', '/orders')),
      await getOrderDetailRoute(request('GET', `/orders/${orderId}`), {
        params: Promise.resolve({ orderId }),
      }),
    ]
    const forbidden = [
      await submitOrder(adminCookie, 'a'.repeat(64)),
      await listOrdersRoute(request('GET', '/orders', adminCookie)),
      await getOrderDetailRoute(
        request('GET', `/orders/${orderId}`, adminCookie),
        { params: Promise.resolve({ orderId }) },
      ),
    ]

    for (const response of unauthenticated) {
      expect(response.status).toBe(401)
      expect(await response.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
    }
    for (const response of forbidden) {
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' })
    }
  })

  it('不正tokenを400、不正な注文IDを所有対象外と同じ404にする', async () => {
    await prepareFixtures()
    const cookie = await createCookie()

    const createResponse = await createOrderRoute(
      request('POST', '/orders', cookie, {
        checkoutToken: 'invalid',
      }),
    )
    const detailResponse = await getOrderDetailRoute(
      request('GET', '/orders/invalid', cookie),
      { params: Promise.resolve({ orderId: 'invalid' }) },
    )

    expect(createResponse.status).toBe(400)
    expect(await createResponse.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
    })
    expect(detailResponse.status).toBe(404)
    expect(await detailResponse.json()).toMatchObject({
      code: 'ORDER_NOT_FOUND',
    })
  })
})

describe('DB-002/DB-005: 注文DB制約', () => {
  it('注文・注文明細の金額、割引率、数量、version制約を拒否する', async () => {
    await prepareFixtures()

    await expect(
      backendDatabase.db.insert(orders).values({
        discountAmount: 0,
        subtotal: -1,
        total: 0,
        userId: customerId,
      }),
    ).rejects.toThrow()
    await expect(
      backendDatabase.db.insert(orders).values({
        discountAmount: 0,
        discountPercent: 101,
        subtotal: 0,
        total: 0,
        userId: customerId,
      }),
    ).rejects.toThrow()
    await expect(
      backendDatabase.db.insert(orders).values({
        discountAmount: 0,
        subtotal: 0,
        total: 0,
        userId: customerId,
        version: 0,
      }),
    ).rejects.toThrow()

    const [order] = await backendDatabase.db
      .insert(orders)
      .values({
        discountAmount: 0,
        subtotal: 0,
        total: 0,
        userId: customerId,
      })
      .returning({ id: orders.id })
    await expect(
      backendDatabase.db.insert(orderItems).values({
        lineTotal: 0,
        orderId: order!.id,
        productId,
        productName: '不正な明細',
        quantity: 0,
        unitPrice: 0,
      }),
    ).rejects.toThrow()
    await expect(
      backendDatabase.db.insert(orderItems).values({
        lineTotal: -1,
        orderId: order!.id,
        productId,
        productName: '不正な明細',
        quantity: 1,
        unitPrice: 0,
      }),
    ).rejects.toThrow()
  })

  it('存在しないuser・order・productの外部キーを拒否する', async () => {
    await prepareFixtures()
    const missingId = '99999999-9999-4999-8999-999999999999'

    await expect(
      backendDatabase.db.insert(orders).values({
        discountAmount: 0,
        subtotal: 0,
        total: 0,
        userId: missingId,
      }),
    ).rejects.toThrow()
    const [order] = await backendDatabase.db
      .insert(orders)
      .values({
        discountAmount: 0,
        subtotal: 0,
        total: 0,
        userId: customerId,
      })
      .returning({ id: orders.id })
    await expect(
      backendDatabase.db.insert(orderItems).values({
        lineTotal: 0,
        orderId: missingId,
        productId,
        productName: '外部キー不正',
        quantity: 1,
        unitPrice: 0,
      }),
    ).rejects.toThrow()
    await expect(
      backendDatabase.db.insert(orderItems).values({
        lineTotal: 0,
        orderId: order!.id,
        productId: missingId,
        productName: '外部キー不正',
        quantity: 1,
        unitPrice: 0,
      }),
    ).rejects.toThrow()
  })

  it('注文明細をproduct ID昇順で返す', async () => {
    await prepareFixtures()
    const [order] = await backendDatabase.db
      .insert(orders)
      .values({
        discountAmount: 0,
        subtotal: 50_600,
        total: 50_600,
        userId: customerId,
      })
      .returning({ id: orders.id })
    await backendDatabase.db.insert(orderItems).values([
      {
        lineTotal: 22_000,
        orderId: order!.id,
        productId: secondProductId,
        productName: '2番目',
        quantity: 1,
        unitPrice: 22_000,
      },
      {
        lineTotal: 28_600,
        orderId: order!.id,
        productId,
        productName: '1番目',
        quantity: 1,
        unitPrice: 28_600,
      },
    ])

    const items = await backendDatabase.db
      .select({ productId: orderItems.productId })
      .from(orderItems)
      .orderBy(asc(orderItems.productId))

    expect(items.map(({ productId: id }) => id)).toEqual([
      productId,
      secondProductId,
    ])
  })
})
