import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { GET as getCartRoute } from '@/app/api/cart/route'
import {
  DELETE as deleteCartItemRoute,
  PATCH as updateCartItemRoute,
} from '@/app/api/cart/items/[itemId]/route'
import { POST as addCartItemRoute } from '@/app/api/cart/items/route'
import { addCartItem } from '@/features/cart/server/cart-service'
import { Temporal } from '@/lib/date-time/temporal'
import { hashSessionToken } from '@/server/auth/session-token'
import {
  cartItems,
  carts,
  products,
  sessions,
  users,
} from '@/server/db/schema'
import {
  seedAuthenticationUsers,
  seedCatalogProducts,
} from '@/server/db/seed'
import { backendDatabase } from '@/test/backend/database'

const cartUrl = 'http://localhost:3000/api/cart'
const customerId = '10000000-0000-4000-8000-000000000001'
const adminId = '20000000-0000-4000-8000-000000000001'
const productId = '30000000-0000-4000-8000-000000000001'
const unpublishedProductId = '30000000-0000-4000-8000-000000000005'
const testNow = '2026-07-26T00:00:00Z'

async function prepareCatalogAndUsers() {
  await seedAuthenticationUsers(backendDatabase.db)
  await seedCatalogProducts(backendDatabase.db)
}

async function createCookie(userId = customerId) {
  const token = `cart-session-${userId}`
  await backendDatabase.db.insert(sessions).values({
    createdAt: '2026-07-01T00:00:00Z',
    expiresAt: '2030-07-01T00:00:00Z',
    tokenHash: hashSessionToken(token),
    userId,
  })
  return `mockshop_session=${token}`
}

function request(
  method: 'DELETE' | 'GET' | 'PATCH' | 'POST',
  path: string,
  cookie: string,
  body?: unknown,
) {
  return new NextRequest(`${cartUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    method,
  })
}

function addItem(cookie: string, quantity = 1, id = productId) {
  return addCartItemRoute(
    request('POST', '/items', cookie, {
      productId: id,
      quantity,
    }),
  )
}

function updateItem(cookie: string, itemId: string, quantity: number) {
  return updateCartItemRoute(
    request('PATCH', `/items/${itemId}`, cookie, { quantity }),
    { params: Promise.resolve({ itemId }) },
  )
}

function deleteItem(cookie: string, itemId: string) {
  return deleteCartItemRoute(
    request('DELETE', `/items/${itemId}`, cookie),
    { params: Promise.resolve({ itemId }) },
  )
}

describe('カートAPI', () => {
  it('CART-001: 商品を追加して件数・小計・version・tokenを返す', async () => {
    await prepareCatalogAndUsers()
    const cookie = await createCookie()

    const response = await addItem(cookie)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body.cart).toMatchObject({
      coupon: null,
      discountAmount: 0,
      items: [
        {
          productId,
          quantity: 1,
          unitPrice: 28_600,
        },
      ],
      subtotal: 28_600,
      total: 28_600,
      version: 2,
    })
    expect(body.cart.checkoutToken).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('CART-002: 同じ商品を追加して1行へ集約する', async () => {
    await prepareCatalogAndUsers()
    const cookie = await createCookie()
    await addItem(cookie)

    const response = await addItem(cookie, 2)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.cart.items).toHaveLength(1)
    expect(body.cart.items[0]).toMatchObject({ quantity: 3 })
    await expect(backendDatabase.db.select().from(cartItems)).resolves.toHaveLength(1)
  })

  it('CART-003: 在庫超過を400にして数量とversionを維持する', async () => {
    await prepareCatalogAndUsers()
    await backendDatabase.db
      .update(products)
      .set({ stock: 3 })
      .where(eq(products.id, productId))
    const cookie = await createCookie()
    const added = await addItem(cookie, 2)
    const itemId = (await added.json()).cart.items[0].id as string

    const response = await updateItem(cookie, itemId, 4)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      code: 'QUANTITY_EXCEEDS_STOCK',
    })
    await expect(backendDatabase.db.select().from(cartItems)).resolves.toMatchObject([
      { quantity: 2 },
    ])
    await expect(backendDatabase.db.select().from(carts)).resolves.toMatchObject([
      { version: 2 },
    ])
  })

  it('CART-004/CART-010: 非公開中は明細を保持してissueを返し、再公開後にtokenを返す', async () => {
    await prepareCatalogAndUsers()
    const cookie = await createCookie()
    await addItem(cookie)
    await backendDatabase.db
      .update(products)
      .set({ isPublished: false })
      .where(eq(products.id, productId))

    const unavailableResponse = await getCartRoute(
      request('GET', '', cookie),
    )
    const unavailableCart = (await unavailableResponse.json()).cart

    expect(unavailableCart.items).toHaveLength(1)
    expect(unavailableCart.items[0].availability).toBe('unpublished')
    expect(unavailableCart.issues).toEqual([
      {
        code: 'PRODUCT_UNAVAILABLE',
        itemId: unavailableCart.items[0].id,
      },
    ])
    expect(unavailableCart.checkoutToken).toBeNull()

    await backendDatabase.db
      .update(products)
      .set({ isPublished: true })
      .where(eq(products.id, productId))
    const availableResponse = await getCartRoute(request('GET', '', cookie))
    const availableCart = (await availableResponse.json()).cart

    expect(availableCart.issues).toEqual([])
    expect(availableCart.checkoutToken).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('CART-011: 他customerの明細更新・削除を同じ404にする', async () => {
    await prepareCatalogAndUsers()
    const otherUserId = '10000000-0000-4000-8000-000000000002'
    await backendDatabase.db.insert(users).values({
      createdAt: testNow,
      email: 'other@example.test',
      id: otherUserId,
      passwordHash: 'test-hash',
      role: 'customer',
    })
    const [otherCart] = await backendDatabase.db
      .insert(carts)
      .values({ createdAt: testNow, updatedAt: testNow, userId: otherUserId })
      .returning({ id: carts.id })
    const [otherItem] = await backendDatabase.db
      .insert(cartItems)
      .values({
        cartId: otherCart!.id,
        productId,
        quantity: 1,
      })
      .returning({ id: cartItems.id })
    const cookie = await createCookie()

    const updateResponse = await updateItem(cookie, otherItem!.id, 2)
    const deleteResponse = await deleteItem(cookie, otherItem!.id)

    expect(updateResponse.status).toBe(404)
    expect(deleteResponse.status).toBe(404)
    expect(await updateResponse.json()).toMatchObject({
      code: 'CART_ITEM_NOT_FOUND',
    })
    expect(await deleteResponse.json()).toMatchObject({
      code: 'CART_ITEM_NOT_FOUND',
    })
    await expect(
      backendDatabase.db
        .select()
        .from(cartItems)
        .where(eq(cartItems.id, otherItem!.id)),
    ).resolves.toMatchObject([{ quantity: 1 }])
  })

  it('CART-012: 非公開・未存在商品を404にして空カートも残さない', async () => {
    await prepareCatalogAndUsers()
    const cookie = await createCookie()

    const unpublishedResponse = await addItem(
      cookie,
      1,
      unpublishedProductId,
    )
    const missingResponse = await addItem(
      cookie,
      1,
      '99999999-9999-4999-8999-999999999999',
    )

    expect(unpublishedResponse.status).toBe(404)
    expect(missingResponse.status).toBe(404)
    expect(await unpublishedResponse.json()).toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
    })
    expect(await missingResponse.json()).toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
    })
    await expect(backendDatabase.db.select().from(carts)).resolves.toHaveLength(0)
  })

  it('CART-013: 削除でDB行を消しversionを1増やす', async () => {
    await prepareCatalogAndUsers()
    const cookie = await createCookie()
    const added = await addItem(cookie)
    const itemId = (await added.json()).cart.items[0].id as string

    const response = await deleteItem(cookie, itemId)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.cart.items).toEqual([])
    expect(body.cart.version).toBe(3)
    expect(body.cart.checkoutToken).toBeNull()
    await expect(backendDatabase.db.select().from(cartItems)).resolves.toHaveLength(0)
  })

  it('未認証の全カートAPIを401にする', async () => {
    const responses = [
      await getCartRoute(request('GET', '', '')),
      await addItem(''),
      await updateItem('', productId, 1),
      await deleteItem('', productId),
    ]

    for (const response of responses) {
      expect(response.status).toBe(401)
      expect(await response.json()).toMatchObject({
        code: 'UNAUTHENTICATED',
      })
    }
    await expect(backendDatabase.db.select().from(carts)).resolves.toHaveLength(0)
  })

  it('不正JSON、null、schema違反を400の入力エラーにする', async () => {
    await prepareCatalogAndUsers()
    const cookie = await createCookie()
    const malformedResponse = await addCartItemRoute(
      new NextRequest(`${cartUrl}/items`, {
        body: '{',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    )
    const nullResponse = await addCartItemRoute(
      request('POST', '/items', cookie, null),
    )
    const schemaResponse = await addItem(cookie, 0)

    expect(malformedResponse.status).toBe(400)
    expect(malformedResponse.headers.get('cache-control')).toBe('no-store')
    expect(await malformedResponse.json()).toEqual({
      code: 'VALIDATION_ERROR',
      message: '入力内容を確認してください。',
    })
    expect(nullResponse.status).toBe(400)
    expect(nullResponse.headers.get('cache-control')).toBe('no-store')
    expect(await nullResponse.json()).toEqual({
      code: 'VALIDATION_ERROR',
      message: '入力内容を確認してください。',
    })
    expect(schemaResponse.status).toBe(400)
    expect(schemaResponse.headers.get('cache-control')).toBe('no-store')
    expect(await schemaResponse.json()).toEqual({
      code: 'VALIDATION_ERROR',
      fieldErrors: {
        quantity: ['数量は1以上で入力してください。'],
      },
      message: '入力内容を確認してください。',
    })
    await expect(backendDatabase.db.select().from(carts)).resolves.toHaveLength(0)
  })

  it('不正なカート明細IDを更新・削除とも400にする', async () => {
    await prepareCatalogAndUsers()
    const cookie = await createCookie()

    const updateResponse = await updateItem(cookie, 'invalid-item-id', 1)
    const deleteResponse = await deleteItem(cookie, 'invalid-item-id')

    expect(updateResponse.status).toBe(400)
    expect(deleteResponse.status).toBe(400)
    expect(await updateResponse.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
    })
    expect(await deleteResponse.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
    })
    await expect(backendDatabase.db.select().from(carts)).resolves.toHaveLength(0)
  })

  it('AUTH-010: adminの全カートAPIを403にする', async () => {
    await prepareCatalogAndUsers()
    const cookie = await createCookie(adminId)

    const responses = [
      await getCartRoute(request('GET', '', cookie)),
      await addItem(cookie),
      await updateItem(cookie, productId, 1),
      await deleteItem(cookie, productId),
    ]

    for (const response of responses) {
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' })
    }
    await expect(backendDatabase.db.select().from(carts)).resolves.toHaveLength(0)
  })

  it('同時追加をcart行ロックで直列化し数量・versionを失わない', async () => {
    await prepareCatalogAndUsers()

    const dependencies = {
      db: backendDatabase.db,
      now: Temporal.Instant.from(testNow),
      userId: customerId,
    }
    await Promise.all([
      addCartItem({ productId, quantity: 1 }, dependencies),
      addCartItem({ productId, quantity: 1 }, dependencies),
    ])

    await expect(backendDatabase.db.select().from(cartItems)).resolves.toMatchObject([
      { productId, quantity: 2 },
    ])
    await expect(backendDatabase.db.select().from(carts)).resolves.toMatchObject([
      { userId: customerId, version: 3 },
    ])
  })
})

describe('DB-002〜DB-005: カートDB制約', () => {
  it('cart version、利用者一意、数量、明細複合一意を拒否する', async () => {
    await prepareCatalogAndUsers()
    const [cart] = await backendDatabase.db
      .insert(carts)
      .values({ createdAt: testNow, updatedAt: testNow, userId: customerId })
      .returning({ id: carts.id })

    await expect(
      backendDatabase.db.insert(carts).values({
        createdAt: testNow,
        updatedAt: testNow,
        userId: adminId,
        version: 0,
      }),
    ).rejects.toThrow()
    await expect(
      backendDatabase.db.insert(carts).values({
        createdAt: testNow,
        updatedAt: testNow,
        userId: customerId,
      }),
    ).rejects.toThrow()
    await expect(
      backendDatabase.db.insert(cartItems).values({
        cartId: cart!.id,
        productId,
        quantity: 0,
      }),
    ).rejects.toThrow()

    await backendDatabase.db.insert(cartItems).values({
      cartId: cart!.id,
      productId,
      quantity: 1,
    })
    await expect(
      backendDatabase.db.insert(cartItems).values({
        cartId: cart!.id,
        productId,
        quantity: 2,
      }),
    ).rejects.toThrow()
  })

  it('存在しないuser、cart、productの外部キーを拒否する', async () => {
    await prepareCatalogAndUsers()
    await expect(
      backendDatabase.db.insert(carts).values({
        createdAt: testNow,
        updatedAt: testNow,
        userId: '99999999-9999-4999-8999-999999999999',
      }),
    ).rejects.toThrow()

    const [cart] = await backendDatabase.db
      .insert(carts)
      .values({ createdAt: testNow, updatedAt: testNow, userId: customerId })
      .returning({ id: carts.id })
    await expect(
      backendDatabase.db.insert(cartItems).values({
        cartId: '99999999-9999-4999-8999-999999999999',
        productId,
        quantity: 1,
      }),
    ).rejects.toThrow()
    await expect(
      backendDatabase.db.insert(cartItems).values({
        cartId: cart!.id,
        productId: '99999999-9999-4999-8999-999999999999',
        quantity: 1,
      }),
    ).rejects.toThrow()
  })
})
