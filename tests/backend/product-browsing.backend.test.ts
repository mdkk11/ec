import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

import { GET as getProduct } from '@/app/api/products/[productId]/route'
import { GET as listProducts } from '@/app/api/products/route'
import { categoryIds } from '@/features/categories/category-catalog'
import { categories, products } from '@/server/db/schema'
import { seedCategories } from '@/server/db/seed'
import { backendDatabase } from '@/test/backend/database'

const productUrl = 'http://localhost:3000/api/products'

async function insertProduct(
  overrides: Partial<typeof products.$inferInsert> = {},
) {
  const id = overrides.id ?? crypto.randomUUID()
  const createdAt = overrides.createdAt ?? '2026-03-01T00:00:00Z'
  const { categoryId = categoryIds.other, ...changes } = overrides

  await seedCategories(backendDatabase.db)
  await backendDatabase.db.insert(products).values({
    categoryId,
    createdAt,
    description: 'Backend結合テストの商品説明です。',
    id,
    imagePath: '/images/fixtures/product-placeholder.svg',
    isPublished: true,
    name: `商品 ${id}`,
    price: 12_100,
    stock: 1,
    updatedAt: createdAt,
    version: 1,
    ...changes,
  })

  return id
}

function productRequest(id: string) {
  return getProduct(
    new NextRequest(`${productUrl}/${id}`),
    { params: Promise.resolve({ productId: id }) },
  )
}

describe('公開商品API', () => {
  it('PRODUCT-001: 公開商品だけをcreatedAt降順・同時刻id昇順で返す', async () => {
    const olderId = '30000000-0000-4000-8000-000000000003'
    const tieLaterId = '30000000-0000-4000-8000-000000000002'
    const tieEarlierId = '30000000-0000-4000-8000-000000000001'

    await insertProduct({ id: olderId, createdAt: '2026-03-01T00:00:00Z' })
    await insertProduct({ id: tieLaterId, createdAt: '2026-03-02T00:00:00Z' })
    await insertProduct({
      id: tieEarlierId,
      createdAt: '2026-03-02T00:00:00Z',
      stock: 0,
    })
    await insertProduct({
      id: '30000000-0000-4000-8000-000000000004',
      createdAt: '2026-03-03T00:00:00Z',
      isPublished: false,
    })

    const response = await listProducts()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body.items.map((item: { id: string }) => item.id)).toEqual([
      tieEarlierId,
      tieLaterId,
      olderId,
    ])
    expect(body.items[0]).toMatchObject({
      availability: 'out_of_stock',
      id: tieEarlierId,
    })
    for (const item of body.items) {
      expect(item).not.toHaveProperty('stock')
      expect(item).not.toHaveProperty('version')
      expect(item).not.toHaveProperty('isPublished')
    }
  })

  it('公開商品詳細をproduct envelopeで返し、管理用fieldを含めない', async () => {
    const id = await insertProduct({ stock: 0 })

    const response = await productRequest(id)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toMatchObject({
      product: {
        availability: 'out_of_stock',
        id,
        price: 12_100,
      },
    })
    expect(body.product).not.toHaveProperty('stock')
    expect(body.product).not.toHaveProperty('version')
    expect(body.product).not.toHaveProperty('isPublished')
  })

  it('PRODUCT-006: 非公開商品と存在しない商品を同じ404にする', async () => {
    const unpublishedId = await insertProduct({ isPublished: false })
    const missingId = '99999999-9999-4999-8999-999999999999'

    const unpublishedResponse = await productRequest(unpublishedId)
    const missingResponse = await productRequest(missingId)

    expect(unpublishedResponse.status).toBe(404)
    expect(missingResponse.status).toBe(404)
    expect(await unpublishedResponse.json()).toEqual(
      await missingResponse.json(),
    )
    expect(await productRequest(unpublishedId).then((response) => response.json()))
      .toMatchObject({ code: 'PRODUCT_NOT_FOUND' })
  })

  it('UUID形式が不正な商品IDを400で拒否する', async () => {
    const response = await productRequest('not-a-uuid')

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })

  it('API-001: DB上の商品が公開DTO契約に違反する場合は500にする', async () => {
    const id = await insertProduct({ name: '' })
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    try {
      const listResponse = await listProducts()
      const detailResponse = await productRequest(id)

      expect(listResponse.status).toBe(500)
      expect(detailResponse.status).toBe(500)
      expect(await listResponse.json()).toMatchObject({
        code: 'INTERNAL_ERROR',
      })
      expect(await detailResponse.json()).toMatchObject({
        code: 'INTERNAL_ERROR',
      })
    } finally {
      consoleError.mockRestore()
    }
  })
})

describe('DB-002: productsのDB制約', () => {
  it('価格・在庫は0、versionは1を許可する', async () => {
    const id = await insertProduct({
      price: 0,
      stock: 0,
      version: 1,
    })

    await expect(productRequest(id)).resolves.toMatchObject({
      status: 200,
    })
  })

  it.each([
    ['負の価格', { price: -1 }],
    ['負の在庫', { stock: -1 }],
    ['0のversion', { version: 0 }],
  ])('%sを拒否する', async (_label, overrides) => {
    await expect(insertProduct(overrides)).rejects.toThrow()
  })
})

describe('カテゴリのDB制約', () => {
  it('固定masterと商品categoryのNOT NULL・外部キー・RESTRICTを保証する', async () => {
    await seedCategories(backendDatabase.db)
    const categoryId = categoryIds.other
    const productId = await insertProduct({ categoryId })

    await expect(
      backendDatabase.db.insert(categories).values({
        displayOrder: 6,
        id: '40000000-0000-4000-8000-000000000099',
        name: '重複slug',
        slug: 'other',
      }),
    ).rejects.toThrow()
    await expect(
      backendDatabase.db.insert(categories).values({
        displayOrder: 0,
        id: '40000000-0000-4000-8000-000000000098',
        name: '不正表示順',
        slug: 'invalid-order',
      }),
    ).rejects.toThrow()
    await expect(
      backendDatabase.db.insert(categories).values({
        displayOrder: 6,
        id: '40000000-0000-4000-8000-000000000097',
        name: '不正slug',
        slug: 'Invalid_Slug',
      }),
    ).rejects.toThrow()
    await expect(
      backendDatabase.db
        .update(products)
        .set({ categoryId: '49999999-9999-4999-8999-999999999999' })
        .where(eq(products.id, productId)),
    ).rejects.toThrow()
    await expect(
      backendDatabase.db.delete(categories).where(eq(categories.id, categoryId)),
    ).rejects.toThrow()
  })
})
