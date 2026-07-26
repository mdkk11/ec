import { describe, expect, it } from 'vitest'

import { calculateCart, createCheckoutToken } from './cart-calculation'

const firstItem = {
  id: '50000000-0000-4000-8000-000000000001',
  isPublished: true,
  name: 'テスト商品',
  productId: '30000000-0000-4000-8000-000000000001',
  quantity: 3,
  stock: 5,
  unitPrice: 1_200,
}

describe('カート計算', () => {
  it('UNIT-CART-001: 行小計と商品小計を整数円で計算する', () => {
    const cart = calculateCart({
      id: '40000000-0000-4000-8000-000000000001',
      items: [firstItem],
      version: 2,
    })

    expect(cart.items[0]?.lineTotal).toBe(3_600)
    expect(cart.subtotal).toBe(3_600)
    expect(cart.discountAmount).toBe(0)
    expect(cart.total).toBe(3_600)
    expect(cart.checkoutToken).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('商品ID順へ正規化し、item IDと在庫をtokenへ含めない', () => {
    const input = {
      discountAmount: 0,
      items: [
        {
          ...firstItem,
          id: '50000000-0000-4000-8000-000000000099',
          productId: '30000000-0000-4000-8000-000000000002',
          stock: 99,
        },
        firstItem,
      ],
      subtotal: 7_200,
      total: 7_200,
      version: 2,
    }
    const changedNonTokenFields = {
      ...input,
      items: input.items
        .toReversed()
        .map((item) => ({ ...item, id: crypto.randomUUID(), stock: 1_000 })),
    }

    expect(createCheckoutToken(input)).toBe(
      createCheckoutToken(changedNonTokenFields),
    )
  })

  it('非公開商品と在庫不足をissueにしtokenを返さない', () => {
    const cart = calculateCart({
      id: '40000000-0000-4000-8000-000000000001',
      items: [
        { ...firstItem, isPublished: false },
        {
          ...firstItem,
          id: '50000000-0000-4000-8000-000000000002',
          productId: '30000000-0000-4000-8000-000000000002',
          quantity: 4,
          stock: 3,
        },
      ],
      version: 3,
    })

    expect(cart.issues.map(({ code }) => code)).toEqual([
      'PRODUCT_UNAVAILABLE',
      'STOCK_CONFLICT',
    ])
    expect(cart.checkoutToken).toBeNull()
  })

  it('安全な整数範囲を超える行小計を拒否する', () => {
    expect(() =>
      calculateCart({
        id: '40000000-0000-4000-8000-000000000001',
        items: [
          {
            ...firstItem,
            quantity: 2_147_483_647,
            unitPrice: 2_147_483_647,
          },
        ],
        version: 1,
      }),
    ).toThrow('安全な整数範囲')
  })

  it('安全な整数範囲外の値からcheckoutTokenを生成しない', () => {
    expect(() =>
      createCheckoutToken({
        discountAmount: 0,
        items: [firstItem],
        subtotal: Number.MAX_SAFE_INTEGER + 1,
        total: Number.MAX_SAFE_INTEGER + 1,
        version: 1,
      }),
    ).toThrow('安全な整数範囲')
  })
})
