import { eq, sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  PATCH as updateAdminProductStockRoute,
} from '@/app/api/admin/products/[productId]/stock/route'
import {
  PATCH as updateAdminOrderStatusRoute,
} from '@/app/api/admin/orders/[orderId]/status/route'
import {
  GET as listAdminOrdersRoute,
} from '@/app/api/admin/orders/route'
import { Temporal } from '@/lib/date-time/temporal'
import { hashSessionToken } from '@/server/auth/session-token'
import {
  orderItems,
  orders,
  products,
  sessions,
} from '@/server/db/schema'
import {
  seedAuthenticationUsers,
  seedCatalogProducts,
} from '@/server/db/seed'
import { backendDatabase } from '@/test/backend/database'

const apiBaseUrl = 'http://localhost:3000/api'
const adminId = '20000000-0000-4000-8000-000000000001'
const customerId = '10000000-0000-4000-8000-000000000001'
const productId = '30000000-0000-4000-8000-000000000001'
const secondProductId = '30000000-0000-4000-8000-000000000003'
const orderId = '70000000-0000-4000-8000-000000000001'
const testNow = Temporal.Instant.from('2026-08-03T00:00:00Z')

async function prepareFixtures() {
  await seedAuthenticationUsers(backendDatabase.db)
  await seedCatalogProducts(backendDatabase.db)
}

async function createCookie(userId: string) {
  const token = `admin-order-session-${userId}`
  await backendDatabase.db.insert(sessions).values({
    createdAt: '2026-08-01T00:00:00Z',
    expiresAt: '2030-08-01T00:00:00Z',
    tokenHash: hashSessionToken(token),
    userId,
  })
  return `mockshop_session=${token}`
}

function request(
  method: 'GET' | 'PATCH',
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

function updateStatus(cookie: string, id: string, body: unknown) {
  return updateAdminOrderStatusRoute(
    request('PATCH', `/admin/orders/${id}/status`, cookie, body),
    { params: Promise.resolve({ orderId: id }) },
  )
}

async function createOrderFixture({
  id = orderId,
  status = 'received' as const,
  version = 1,
  itemProductIds = [productId],
  quantities = [1],
}: {
  id?: string
  status?: 'received' | 'processing' | 'shipped' | 'completed' | 'cancelled'
  version?: number
  itemProductIds?: string[]
  quantities?: number[]
} = {}) {
  await backendDatabase.db.insert(orders).values({
    createdAt: testNow.toString(),
    discountAmount: 0,
    id,
    status,
    subtotal: 28_600,
    total: 28_600,
    updatedAt: testNow.toString(),
    userId: customerId,
    version,
  })
  await backendDatabase.db.insert(orderItems).values(
    itemProductIds.map((itemProductId, index) => ({
      lineTotal: 28_600 * (quantities[index] ?? 1),
      orderId: id,
      productId: itemProductId,
      productName: `注文時の商品 ${index + 1}`,
      quantity: quantities[index] ?? 1,
      unitPrice: 28_600,
    })),
  )
}

beforeEach(() => {
  vi.spyOn(Temporal.Now, 'instant').mockReturnValue(testNow)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('管理注文API', () => {
  it('ADMIN-006/007: 管理者が一覧を取得し、許可された状態遷移を実行できる', async () => {
    await prepareFixtures()
    await createOrderFixture()
    const cookie = await createCookie(adminId)

    const listResponse = await listAdminOrdersRoute(
      request('GET', '/admin/orders', cookie),
    )
    expect(listResponse.status).toBe(200)
    expect(listResponse.headers.get('cache-control')).toBe('no-store')
    expect(await listResponse.json()).toMatchObject({
      items: [{ id: orderId, status: 'received', version: 1 }],
    })

    const processing = await updateStatus(cookie, orderId, {
      expectedVersion: 1,
      status: 'processing',
    })
    const shipped = await updateStatus(cookie, orderId, {
      expectedVersion: 2,
      status: 'shipped',
    })
    const completed = await updateStatus(cookie, orderId, {
      expectedVersion: 3,
      status: 'completed',
    })

    expect(processing.status).toBe(200)
    expect(shipped.status).toBe(200)
    expect(completed.status).toBe(200)
    expect(await completed.json()).toMatchObject({
      order: { id: orderId, status: 'completed', version: 4 },
    })
  })

  it('ADMIN-007: 処理中の注文を取消して在庫を復元できる', async () => {
    await prepareFixtures()
    await createOrderFixture({ status: 'processing' })
    const cookie = await createCookie(adminId)

    const response = await updateStatus(cookie, orderId, {
      expectedVersion: 1,
      status: 'cancelled',
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      order: { id: orderId, status: 'cancelled', version: 2 },
    })
    await expect(
      backendDatabase.db
        .select({ stock: products.stock, version: products.version })
        .from(products)
        .where(eq(products.id, productId)),
    ).resolves.toEqual([{ stock: 9, version: 2 }])
  })

  it('AUTH-006: 未認証を401、customerを403にする', async () => {
    await prepareFixtures()
    const customerCookie = await createCookie(customerId)

    const responses = [
      await listAdminOrdersRoute(request('GET', '/admin/orders')),
      await listAdminOrdersRoute(request('GET', '/admin/orders', customerCookie)),
    ]

    expect(responses.map((response) => response.status)).toEqual([401, 403])
  })

  it('ADMIN-008: 禁止遷移で状態・version・在庫を変更しない', async () => {
    await prepareFixtures()
    await createOrderFixture()
    const cookie = await createCookie(adminId)

    const response = await updateStatus(cookie, orderId, {
      expectedVersion: 1,
      status: 'shipped',
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
    })
    await expect(
      backendDatabase.db
        .select({ status: orders.status, version: orders.version })
        .from(orders),
    ).resolves.toEqual([{ status: 'received', version: 1 }])
    await expect(
      backendDatabase.db
        .select({ stock: products.stock, version: products.version })
        .from(products)
        .where(eq(products.id, productId)),
    ).resolves.toEqual([{ stock: 8, version: 1 }])
  })

  it('ADMIN-009: 取消で注文と全商品の在庫・versionを一度だけ更新する', async () => {
    await prepareFixtures()
    await createOrderFixture({
      itemProductIds: [productId, secondProductId],
      quantities: [2, 1],
    })
    const cookie = await createCookie(adminId)

    const response = await updateStatus(cookie, orderId, {
      expectedVersion: 1,
      status: 'cancelled',
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.order).toMatchObject({
      id: orderId,
      status: 'cancelled',
      version: 2,
    })
    const [cancelledOrder] = await backendDatabase.db
      .select({
        cancelledAt: orders.cancelledAt,
        status: orders.status,
        version: orders.version,
      })
      .from(orders)
    expect(cancelledOrder).toMatchObject({ status: 'cancelled', version: 2 })
    expect(
      cancelledOrder?.cancelledAt
        ? Temporal.Instant.from(cancelledOrder.cancelledAt).toString()
        : null,
    ).toBe(testNow.toString())
    await expect(
      backendDatabase.db
        .select({ id: products.id, stock: products.stock, version: products.version })
        .from(products)
        .where(sql`${products.id} in (${productId}, ${secondProductId})`)
        .orderBy(products.id),
    ).resolves.toEqual([
      { id: productId, stock: 10, version: 2 },
      { id: secondProductId, stock: 6, version: 2 },
    ])
  })

  it('ADMIN-010: 同じ注文の同時取消は1件だけ成功し、在庫を一度だけ戻す', async () => {
    await prepareFixtures()
    await createOrderFixture()
    const cookie = await createCookie(adminId)

    const responses = await Promise.all([
      updateStatus(cookie, orderId, { expectedVersion: 1, status: 'cancelled' }),
      updateStatus(cookie, orderId, { expectedVersion: 1, status: 'cancelled' }),
    ])
    const statuses = responses.map((response) => response.status).sort()

    expect(statuses).toEqual([200, 409])
    await expect(
      backendDatabase.db
        .select({ stock: products.stock, version: products.version })
        .from(products)
        .where(eq(products.id, productId)),
    ).resolves.toEqual([{ stock: 9, version: 2 }])
  })

  it('ADMIN-013: 取消後の商品versionに対する古い在庫更新を409にする', async () => {
    await prepareFixtures()
    await createOrderFixture()
    const adminCookie = await createCookie(adminId)

    const cancellation = await updateStatus(adminCookie, orderId, {
      expectedVersion: 1,
      status: 'cancelled',
    })
    const stale = await updateAdminProductStockRoute(
      request('PATCH', `/admin/products/${productId}/stock`, adminCookie, {
        expectedVersion: 1,
        stock: 20,
      }),
      { params: Promise.resolve({ productId }) },
    )

    expect(cancellation.status).toBe(200)
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({ code: 'VERSION_CONFLICT' })
  })

  it('途中の在庫復元失敗で注文と先行商品の更新をrollbackする', async () => {
    await prepareFixtures()
    await createOrderFixture({
      itemProductIds: [productId, secondProductId],
      quantities: [1, 1],
    })
    await backendDatabase.db
      .update(products)
      .set({ stock: 2_147_483_647 })
      .where(eq(products.id, secondProductId))
    const cookie = await createCookie(adminId)

    const response = await updateStatus(cookie, orderId, {
      expectedVersion: 1,
      status: 'cancelled',
    })

    expect(response.status).toBe(500)
    await expect(
      backendDatabase.db
        .select({ status: orders.status, version: orders.version })
        .from(orders),
    ).resolves.toEqual([{ status: 'received', version: 1 }])
    await expect(
      backendDatabase.db
        .select({ id: products.id, stock: products.stock, version: products.version })
        .from(products)
        .where(sql`${products.id} in (${productId}, ${secondProductId})`)
        .orderBy(products.id),
    ).resolves.toEqual([
      { id: productId, stock: 8, version: 1 },
      { id: secondProductId, stock: 2_147_483_647, version: 1 },
    ])
  })

  it('古いversion・不正ID・不正bodyを規定の409・404・400にする', async () => {
    await prepareFixtures()
    await createOrderFixture()
    const cookie = await createCookie(adminId)

    const stale = await updateStatus(cookie, orderId, {
      expectedVersion: 2,
      status: 'processing',
    })
    const invalidId = await updateStatus(cookie, 'not-an-order-id', {
      expectedVersion: 1,
      status: 'processing',
    })
    const invalidBody = await updateStatus(cookie, orderId, {
      expectedVersion: 0,
      status: 'processing',
    })

    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({ code: 'VERSION_CONFLICT' })
    expect(invalidId.status).toBe(404)
    expect(invalidBody.status).toBe(400)
  })
})
