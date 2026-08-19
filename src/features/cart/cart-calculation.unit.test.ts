import { describe, expect, it } from 'vitest'

import { createTestNow } from '@/test/fixtures/time'

import { calculateCart, createCheckoutToken } from './cart-calculation'

const firstItem = {
  id: '50000000-0000-4000-8000-000000000001',
  imagePath: '/images/home/linen-overshirt.jpg',
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
      coupon: null,
      id: '40000000-0000-4000-8000-000000000001',
      items: [firstItem],
      version: 2,
    }, createTestNow())

    expect(cart.items[0]?.lineTotal).toBe(3_600)
    expect(cart.items[0]).toMatchObject({
      availableStock: 5,
      imagePath: '/images/home/linen-overshirt.jpg',
    })
    expect(cart.subtotal).toBe(3_600)
    expect(cart.discountAmount).toBe(0)
    expect(cart.total).toBe(3_600)
    expect(cart.checkoutToken).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('商品ID順へ正規化し、item ID・画像・在庫をtokenへ含めない', () => {
    const input = {
      discountAmount: 0,
      coupon: null,
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
        .map((item) => ({
          ...item,
          id: crypto.randomUUID(),
          imagePath: '/images/home/suede-sneakers.jpg',
          stock: 1_000,
        })),
    }

    expect(createCheckoutToken(input)).toBe(
      createCheckoutToken(changedNonTokenFields),
    )
  })

  it('非公開商品と在庫不足をissueにしtokenを返さない', () => {
    const cart = calculateCart({
      coupon: null,
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
    }, createTestNow())

    expect(cart.issues.map(({ code }) => code)).toEqual([
      'PRODUCT_UNAVAILABLE',
      'STOCK_CONFLICT',
    ])
    expect(cart.checkoutToken).toBeNull()
  })

  it('有効クーポンを計算し、全条件をcheckoutTokenへ含める', () => {
    const coupon = {
      code: 'SAVE15',
      discountPercent: 15,
      endsAt: '2027-01-01T00:00:00Z',
      isActive: true,
      minimumSubtotal: 1_000,
      startsAt: '2026-01-01T00:00:00Z',
    }
    const cart = calculateCart(
      {
        coupon,
        id: '40000000-0000-4000-8000-000000000001',
        items: [firstItem],
        version: 2,
      },
      createTestNow(),
    )
    const changedTerms = createCheckoutToken({
      coupon: { ...coupon, minimumSubtotal: 2_000 },
      discountAmount: cart.discountAmount,
      items: [firstItem],
      subtotal: cart.subtotal,
      total: cart.total,
      version: cart.version,
    })

    expect(cart.discountAmount).toBe(540)
    expect(cart.total).toBe(3_060)
    expect(cart.coupon?.code).toBe('SAVE15')
    expect(changedTerms).not.toBe(cart.checkoutToken)
  })

  it('安全な整数範囲を超える行小計を拒否する', () => {
    expect(() =>
      calculateCart({
        coupon: null,
        id: '40000000-0000-4000-8000-000000000001',
        items: [
          {
            ...firstItem,
            quantity: 2_147_483_647,
            unitPrice: 2_147_483_647,
          },
        ],
        version: 1,
      }, createTestNow()),
    ).toThrow('安全な整数範囲')
  })

  it('安全な整数範囲外の値からcheckoutTokenを生成しない', () => {
    expect(() =>
      createCheckoutToken({
        discountAmount: 0,
        coupon: null,
        items: [firstItem],
        subtotal: Number.MAX_SAFE_INTEGER + 1,
        total: Number.MAX_SAFE_INTEGER + 1,
        version: 1,
      }),
    ).toThrow('安全な整数範囲')
  })
})
