import { describe, expect, it } from 'vitest'

import {
  adminProductDtoSchema,
  adminProductListResponseSchema,
  adminProductResponseSchema,
  createAdminProductRequestSchema,
  productDtoSchema,
  productIdSchema,
  productListResponseSchema,
  productResponseSchema,
  updateAdminProductRequestSchema,
  updateAdminProductStockRequestSchema,
} from './product'

const product = {
  availability: 'in_stock',
  description: '軽やかな素材の商品です。',
  id: '30000000-0000-4000-8000-000000000001',
  imagePath: '/images/fixtures/product-placeholder.svg',
  name: 'テスト商品',
  price: 12_100,
} as const

describe('product contract', () => {
  it('公開商品DTOと一覧・詳細envelopeを受け入れる', () => {
    expect(productDtoSchema.parse(product)).toEqual(product)
    expect(productListResponseSchema.parse({ items: [product] })).toEqual({
      items: [product],
    })
    expect(productResponseSchema.parse({ product })).toEqual({ product })
  })

  it('UUID形式、必須field、整数かつ非負の価格を検証する', () => {
    expect(productIdSchema.safeParse('not-a-uuid').success).toBe(false)
    expect(
      productDtoSchema.safeParse({
        ...product,
        availability: 'out_of_stock',
        price: 0,
      }).success,
    ).toBe(true)
    expect(
      productDtoSchema.safeParse({ ...product, description: undefined }).success,
    ).toBe(false)
    expect(productDtoSchema.safeParse({ ...product, price: -1 }).success).toBe(false)
    expect(productDtoSchema.safeParse({ ...product, price: 1.5 }).success).toBe(false)
  })

  it('不正な在庫状態と外部画像URLを拒否する', () => {
    expect(
      productDtoSchema.safeParse({ ...product, availability: 'available' }).success,
    ).toBe(false)
    expect(
      productDtoSchema.safeParse({
        ...product,
        imagePath: 'https://example.com/product.jpg',
      }).success,
    ).toBe(false)
  })

  it('公開DTOから管理用fieldを除外する', () => {
    expect(
      productDtoSchema.parse({
        ...product,
        isPublished: true,
        stock: 10,
        version: 1,
      }),
    ).toEqual(product)
  })

  it('UNIT-PRODUCT-001: 管理商品DTOと一覧・単体envelopeを受け入れる', () => {
    const adminProduct = {
      ...product,
      isPublished: true,
      stock: 0,
      version: 1,
    }

    expect(adminProductDtoSchema.parse(adminProduct)).toEqual(adminProduct)
    expect(adminProductListResponseSchema.parse({ items: [adminProduct] }))
      .toEqual({ items: [adminProduct] })
    expect(adminProductResponseSchema.parse({ product: adminProduct }))
      .toEqual({ product: adminProduct })
  })

  it('UNIT-PRODUCT-001: 価格・在庫は0、expectedVersionは1を許可する', () => {
    const input = {
      description: product.description,
      imagePath: product.imagePath,
      isPublished: false,
      name: product.name,
      price: 0,
      stock: 0,
    }

    expect(createAdminProductRequestSchema.safeParse(input).success).toBe(true)
    expect(
      updateAdminProductRequestSchema.safeParse({
        expectedVersion: 1,
        price: 0,
      }).success,
    ).toBe(true)
    expect(
      updateAdminProductStockRequestSchema.safeParse({
        expectedVersion: 1,
        stock: 0,
      }).success,
    ).toBe(true)
  })

  it.each([
    ['負の価格', { price: -1 }],
    ['小数の価格', { price: 1.5 }],
    ['負の在庫', { stock: -1 }],
    ['小数の在庫', { stock: 1.5 }],
  ])('UNIT-PRODUCT-001: %sを拒否する', (_label, overrides) => {
    expect(
      createAdminProductRequestSchema.safeParse({
        description: product.description,
        imagePath: product.imagePath,
        isPublished: false,
        name: product.name,
        price: 0,
        stock: 0,
        ...overrides,
      }).success,
    ).toBe(false)
  })

  it('UNIT-PRODUCT-001: 不正versionと変更fieldのないPATCHを拒否する', () => {
    expect(
      updateAdminProductRequestSchema.safeParse({ expectedVersion: 0 }).success,
    ).toBe(false)
    expect(
      updateAdminProductRequestSchema.safeParse({ expectedVersion: 1 }).success,
    ).toBe(false)
    expect(
      updateAdminProductStockRequestSchema.safeParse({
        expectedVersion: 1.5,
        stock: 1,
      }).success,
    ).toBe(false)
  })

  it('管理入力で空の必須fieldと外部画像URLを拒否する', () => {
    const base = {
      description: product.description,
      imagePath: product.imagePath,
      isPublished: false,
      name: product.name,
      price: 0,
      stock: 0,
    }

    expect(
      createAdminProductRequestSchema.safeParse({ ...base, name: '' }).success,
    ).toBe(false)
    expect(
      createAdminProductRequestSchema.safeParse({
        ...base,
        imagePath: 'https://example.com/image.jpg',
      }).success,
    ).toBe(false)
  })
})
