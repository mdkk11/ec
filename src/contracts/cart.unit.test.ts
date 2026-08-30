import { describe, expect, it } from 'vitest'

import {
  applyCouponRequestSchema,
  addCartItemRequestSchema,
  cartResponseSchema,
  updateCartItemRequestSchema,
} from './cart'

describe('カートAPI契約', () => {
  it('クーポンコードをtrimして大文字へ正規化する', () => {
    expect(applyCouponRequestSchema.parse({ code: '  welcome15  ' })).toEqual({ code: 'WELCOME15' })
    expect(applyCouponRequestSchema.safeParse({ code: '   ' }).success).toBe(false)
  })
  it.each([0, -1, 1.5])('UNIT-CART-002: 数量%sを拒否する', (quantity) => {
    expect(
      addCartItemRequestSchema.safeParse({
        productId: '30000000-0000-4000-8000-000000000001',
        quantity,
      }).success,
    ).toBe(false)
    expect(updateCartItemRequestSchema.safeParse({ quantity }).success).toBe(false)
  })

  it('数量1以上の整数を許可する', () => {
    expect(updateCartItemRequestSchema.safeParse({ quantity: 1 }).success).toBe(true)
  })

  it('不正なcheckoutTokenを成功レスポンスとして扱わない', () => {
    expect(
      cartResponseSchema.safeParse({
        cart: {
          checkoutToken: 'not-a-hash',
          coupon: null,
          discountAmount: 0,
          id: '40000000-0000-4000-8000-000000000001',
          issues: [],
          items: [],
          subtotal: 0,
          total: 0,
          version: 1,
        },
      }).success,
    ).toBe(false)
  })
})
