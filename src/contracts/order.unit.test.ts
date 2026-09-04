import { describe, expect, it } from 'vitest'

import {
  createOrderRequestSchema,
  orderResponseSchema,
  updateAdminOrderStatusRequestSchema,
} from './order'

const validOrder = {
  couponCode: 'WELCOME15',
  createdAt: '2026-07-30T00:00:00Z',
  discountAmount: 1_500,
  discountPercent: 15,
  id: '70000000-0000-4000-8000-000000000001',
  items: [
    {
      lineTotal: 10_000,
      productId: '30000000-0000-4000-8000-000000000001',
      productName: '注文時の商品名',
      quantity: 1,
      unitPrice: 10_000,
    },
  ],
  status: 'received',
  subtotal: 10_000,
  total: 8_500,
  version: 1,
}

describe('注文API契約', () => {
  it('checkoutTokenは64文字の小文字hexだけを受け付ける', () => {
    expect(
      createOrderRequestSchema.safeParse({
        checkoutToken: 'a'.repeat(64),
      }).success,
    ).toBe(true)
    expect(
      createOrderRequestSchema.safeParse({
        checkoutToken: 'not-a-token',
      }).success,
    ).toBe(false)
  })

  it('注文スナップショットの正常値を受け付ける', () => {
    expect(orderResponseSchema.safeParse({ order: validOrder }).success).toBe(true)
  })

  it.each([
    ['負の合計', { total: -1 }],
    ['不正な状態', { status: 'refunded' }],
    ['不正な注文ID', { id: 'not-an-order-id' }],
    ['小数の数量', { items: [{ ...validOrder.items[0], quantity: 1.5 }] }],
    ['不正な商品ID', { items: [{ ...validOrder.items[0], productId: 'not-a-product-id' }] }],
    ['不正な日時', { createdAt: '2026/07/30' }],
    ['0以下のversion', { version: 0 }],
  ])('%sを拒否する', (_name, override) => {
    expect(
      orderResponseSchema.safeParse({
        order: { ...validOrder, ...override },
      }).success,
    ).toBe(false)
  })

  it('管理注文の状態更新requestは状態と正の整数versionを受け付ける', () => {
    expect(
      updateAdminOrderStatusRequestSchema.safeParse({
        expectedVersion: 1,
        status: 'processing',
      }).success,
    ).toBe(true)
  })

  it.each([
    ['不正な状態', { expectedVersion: 1, status: 'refunded' }],
    ['0以下のversion', { expectedVersion: 0, status: 'processing' }],
    ['小数のversion', { expectedVersion: 1.5, status: 'processing' }],
  ])('%sを管理注文更新requestで拒否する', (_name, input) => {
    expect(updateAdminOrderStatusRequestSchema.safeParse(input).success).toBe(false)
  })
})
