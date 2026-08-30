import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PATCH as updateAdminProductRoute } from '@/app/api/admin/products/[productId]/route'
import { PATCH as updateAdminProductStockRoute } from '@/app/api/admin/products/[productId]/stock/route'
import {
  GET as listAdminProductsRoute,
  POST as createAdminProductRoute,
} from '@/app/api/admin/products/route'
import { POST as addCartItemRoute } from '@/app/api/cart/items/route'
import { GET as getCartRoute } from '@/app/api/cart/route'
import { POST as createOrderRoute } from '@/app/api/orders/route'
import { GET as getPublishedProductRoute } from '@/app/api/products/[productId]/route'
import { GET as listPublishedProductsRoute } from '@/app/api/products/route'
import { Temporal } from '@/lib/date-time/temporal'
import { categoryIds } from '@/features/categories/category-catalog'
import { hashSessionToken } from '@/server/auth/session-token'
import { products, sessions } from '@/server/db/schema'
import { seedAuthenticationUsers, seedCatalogProducts } from '@/server/db/seed'
import { backendDatabase } from '@/test/backend/database'

const apiBaseUrl = 'http://localhost:3000/api'
const adminId = '20000000-0000-4000-8000-000000000001'
const customerId = '10000000-0000-4000-8000-000000000001'
const productId = '30000000-0000-4000-8000-000000000001'
const testNow = Temporal.Instant.from('2026-08-03T00:00:00Z')

async function prepareFixtures() {
  await seedAuthenticationUsers(backendDatabase.db)
  await seedCatalogProducts(backendDatabase.db)
}

async function createCookie(userId: string) {
  const token = `admin-product-session-${userId}`
  await backendDatabase.db.insert(sessions).values({
    createdAt: '2026-08-01T00:00:00Z',
    expiresAt: '2030-08-01T00:00:00Z',
    tokenHash: hashSessionToken(token),
    userId,
  })
  return `mockshop_session=${token}`
}

function request(method: 'GET' | 'PATCH' | 'POST', path: string, cookie = '', body?: unknown) {
  return new NextRequest(`${apiBaseUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    method,
  })
}

function updateProduct(cookie: string, id: string, body: unknown) {
  return updateAdminProductRoute(request('PATCH', `/admin/products/${id}`, cookie, body), {
    params: Promise.resolve({ productId: id }),
  })
}

function updateStock(cookie: string, id: string, body: unknown) {
  return updateAdminProductStockRoute(
    request('PATCH', `/admin/products/${id}/stock`, cookie, body),
    { params: Promise.resolve({ productId: id }) },
  )
}

beforeEach(() => {
  vi.spyOn(Temporal.Now, 'instant').mockReturnValue(testNow)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('管理商品API', () => {
  it('ADMIN-001: version 1の商品を作成し、非公開商品を含む管理一覧の先頭へ返す', async () => {
    await prepareFixtures()
    const adminCookie = await createCookie(adminId)

    const createResponse = await createAdminProductRoute(
      request('POST', '/admin/products', adminCookie, {
        categoryId: categoryIds.other,
        description: '管理画面から作成した商品です。',
        imagePath: '/images/fixtures/product-placeholder.svg',
        isPublished: false,
        name: '管理作成商品',
        price: 15_400,
        stock: 2,
      }),
    )
    const createdBody = await createResponse.json()

    expect(createResponse.status).toBe(201)
    expect(createResponse.headers.get('cache-control')).toBe('no-store')
    expect(createdBody.product).toMatchObject({
      availability: 'in_stock',
      category: { name: 'その他', slug: 'other' },
      categoryId: categoryIds.other,
      isPublished: false,
      name: '管理作成商品',
      stock: 2,
      version: 1,
    })

    const listResponse = await listAdminProductsRoute(
      request('GET', '/admin/products', adminCookie),
    )
    const listBody = await listResponse.json()
    expect(listResponse.status).toBe(200)
    expect(listBody.items[0].id).toBe(createdBody.product.id)
    expect(listBody.items.some((item: { name: string }) => item.name === '非公開の商品')).toBe(true)
  })

  it('不明カテゴリの商品作成を400 field errorで拒否する', async () => {
    await prepareFixtures()
    const adminCookie = await createCookie(adminId)

    const response = await createAdminProductRoute(
      request('POST', '/admin/products', adminCookie, {
        categoryId: '49999999-9999-4999-8999-999999999999',
        description: '保存されない商品です。',
        imagePath: '/images/fixtures/product-placeholder.svg',
        isPublished: false,
        name: '不明カテゴリ商品',
        price: 1_000,
        stock: 1,
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { categoryId: ['選択したカテゴリが見つかりませんでした。'] },
    })
    await expect(
      backendDatabase.db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.name, '不明カテゴリ商品')),
    ).resolves.toEqual([])
  })

  it('AUTH-006: 未認証を401、customerを403にしDBを変更しない', async () => {
    await prepareFixtures()
    const customerCookie = await createCookie(customerId)
    const before = await backendDatabase.db.select().from(products)
    const createBody = {
      categoryId: categoryIds.other,
      description: '拒否される商品です。',
      imagePath: '/images/fixtures/product-placeholder.svg',
      isPublished: false,
      name: '拒否商品',
      price: 1_000,
      stock: 1,
    }

    const responses = [
      await listAdminProductsRoute(request('GET', '/admin/products')),
      await createAdminProductRoute(request('POST', '/admin/products', customerCookie, createBody)),
      await updateProduct(customerCookie, productId, {
        expectedVersion: 1,
        name: '不正更新',
      }),
      await updateStock(customerCookie, productId, {
        expectedVersion: 1,
        stock: 99,
      }),
    ]

    expect(responses.map((response) => response.status)).toEqual([401, 403, 403, 403])
    expect(await backendDatabase.db.select().from(products)).toEqual(before)
  })

  it('ADMIN-002: 負数・小数と変更fieldのないPATCHを400で拒否する', async () => {
    await prepareFixtures()
    const adminCookie = await createCookie(adminId)

    const negativePrice = await createAdminProductRoute(
      request('POST', '/admin/products', adminCookie, {
        categoryId: categoryIds.other,
        description: '不正価格です。',
        imagePath: '/images/fixtures/product-placeholder.svg',
        isPublished: false,
        name: '不正価格商品',
        price: -1,
        stock: 0,
      }),
    )
    const decimalStock = await updateStock(adminCookie, productId, {
      expectedVersion: 1,
      stock: 1.5,
    })
    const emptyPatch = await updateProduct(adminCookie, productId, {
      expectedVersion: 1,
    })

    expect(negativePrice.status).toBe(400)
    expect(decimalStock.status).toBe(400)
    expect(emptyPatch.status).toBe(400)
  })

  it('ADMIN-003: 非公開化すると購入者一覧・詳細から除外する', async () => {
    await prepareFixtures()
    const adminCookie = await createCookie(adminId)

    const updateResponse = await updateProduct(adminCookie, productId, {
      expectedVersion: 1,
      isPublished: false,
    })
    expect(updateResponse.status).toBe(200)
    expect(await updateResponse.json()).toMatchObject({
      product: { isPublished: false, version: 2 },
    })

    const publicList = await listPublishedProductsRoute()
    const publicListBody = await publicList.json()
    const publicDetail = await getPublishedProductRoute(
      new NextRequest(`${apiBaseUrl}/products/${productId}`),
      { params: Promise.resolve({ productId }) },
    )

    expect(publicListBody.items.some((item: { id: string }) => item.id === productId)).toBe(false)
    expect(publicDetail.status).toBe(404)
  })

  it('ADMIN-004: 同じversionからの商品更新は先行1件だけ成功する', async () => {
    await prepareFixtures()
    const adminCookie = await createCookie(adminId)

    const first = await updateProduct(adminCookie, productId, {
      expectedVersion: 1,
      name: '先行更新商品',
    })
    const second = await updateProduct(adminCookie, productId, {
      expectedVersion: 1,
      name: '後続更新商品',
    })

    expect(first.status).toBe(200)
    expect(second.status).toBe(409)
    expect(await second.json()).toMatchObject({ code: 'VERSION_CONFLICT' })
    await expect(
      backendDatabase.db
        .select({ name: products.name, version: products.version })
        .from(products)
        .where(eq(products.id, productId)),
    ).resolves.toEqual([{ name: '先行更新商品', version: 2 }])
  })

  it('カテゴリだけの更新でversionを進め、不明カテゴリをfield errorで拒否する', async () => {
    await prepareFixtures()
    const adminCookie = await createCookie(adminId)

    const updated = await updateProduct(adminCookie, productId, {
      categoryId: categoryIds['bags-accessories'],
      expectedVersion: 1,
    })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({
      product: {
        category: { name: 'バッグ・服飾小物', slug: 'bags-accessories' },
        categoryId: categoryIds['bags-accessories'],
        version: 2,
      },
    })

    const invalid = await updateProduct(adminCookie, productId, {
      categoryId: '49999999-9999-4999-8999-999999999999',
      expectedVersion: 2,
    })
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: {
        categoryId: ['選択したカテゴリが見つかりませんでした。'],
      },
    })
    await expect(
      backendDatabase.db
        .select({ categoryId: products.categoryId, version: products.version })
        .from(products)
        .where(eq(products.id, productId)),
    ).resolves.toEqual([
      {
        categoryId: categoryIds['bags-accessories'],
        version: 2,
      },
    ])
  })

  it('ADMIN-005: 他の在庫更新後に古いexpectedVersionを409にする', async () => {
    await prepareFixtures()
    const adminCookie = await createCookie(adminId)

    const first = await updateStock(adminCookie, productId, {
      expectedVersion: 1,
      stock: 7,
    })
    const stale = await updateStock(adminCookie, productId, {
      expectedVersion: 1,
      stock: 99,
    })

    expect(first.status).toBe(200)
    expect(stale.status).toBe(409)
    await expect(
      backendDatabase.db
        .select({ stock: products.stock, version: products.version })
        .from(products)
        .where(eq(products.id, productId)),
    ).resolves.toEqual([{ stock: 7, version: 2 }])
  })

  it('ADMIN-012: customerの注文減算後に古い在庫更新を409にする', async () => {
    await prepareFixtures()
    const adminCookie = await createCookie(adminId)
    const customerCookie = await createCookie(customerId)

    const addResponse = await addCartItemRoute(
      request('POST', '/cart/items', customerCookie, {
        productId,
        quantity: 1,
      }),
    )
    expect(addResponse.status).toBe(201)
    const cartResponse = await getCartRoute(request('GET', '/cart', customerCookie))
    const cartBody = await cartResponse.json()
    const orderResponse = await createOrderRoute(
      request('POST', '/orders', customerCookie, {
        checkoutToken: cartBody.cart.checkoutToken,
      }),
    )
    expect(orderResponse.status).toBe(201)

    const stale = await updateStock(adminCookie, productId, {
      expectedVersion: 1,
      stock: 20,
    })

    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({ code: 'VERSION_CONFLICT' })
    await expect(
      backendDatabase.db
        .select({ stock: products.stock, version: products.version })
        .from(products)
        .where(eq(products.id, productId)),
    ).resolves.toEqual([{ stock: 7, version: 2 }])
  })

  it('不正IDを400、存在しない商品を404にする', async () => {
    await prepareFixtures()
    const adminCookie = await createCookie(adminId)
    const invalid = await updateProduct(adminCookie, 'not-a-uuid', {
      expectedVersion: 1,
      name: '更新商品',
    })
    const missing = await updateProduct(adminCookie, '99999999-9999-4999-8999-999999999999', {
      expectedVersion: 1,
      name: '更新商品',
    })

    expect(invalid.status).toBe(400)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ code: 'PRODUCT_NOT_FOUND' })
  })
})
