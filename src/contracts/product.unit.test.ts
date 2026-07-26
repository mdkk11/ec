import { describe, expect, it } from 'vitest'

import {
  productDtoSchema,
  productIdSchema,
  productListResponseSchema,
  productResponseSchema,
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
})
