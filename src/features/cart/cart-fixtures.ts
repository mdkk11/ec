import type { CartDto } from '@/contracts/cart'

export const cartFixture: CartDto = {
  checkoutToken: 'a'.repeat(64),
  coupon: null,
  discountAmount: 0,
  id: '40000000-0000-4000-8000-000000000001',
  issues: [],
  items: [
    {
      availability: 'available',
      id: '50000000-0000-4000-8000-000000000001',
      lineTotal: 57_200,
      name: 'リネンブレンド オーバーシャツ',
      productId: '30000000-0000-4000-8000-000000000001',
      quantity: 2,
      unitPrice: 28_600,
    },
    {
      availability: 'available',
      id: '50000000-0000-4000-8000-000000000002',
      lineTotal: 22_000,
      name: 'スエード コートスニーカー',
      productId: '30000000-0000-4000-8000-000000000003',
      quantity: 1,
      unitPrice: 22_000,
    },
  ],
  subtotal: 79_200,
  total: 79_200,
  version: 3,
}

export const emptyCartFixture: CartDto = {
  ...cartFixture,
  checkoutToken: null,
  items: [],
  subtotal: 0,
  total: 0,
  version: 1,
}

export const stockConflictCartFixture: CartDto = {
  ...cartFixture,
  checkoutToken: null,
  issues: [
    {
      code: 'STOCK_CONFLICT',
      itemId: cartFixture.items[0]!.id,
    },
  ],
  items: [
    {
      ...cartFixture.items[0]!,
      availability: 'available',
      lineTotal: 85_800,
      quantity: 3,
    },
  ],
  subtotal: 85_800,
  total: 85_800,
  version: 4,
}

export const appliedCouponFixture: CartDto = {
  ...cartFixture,
  checkoutToken: 'b'.repeat(64),
  coupon: {
    code: 'WELCOME15',
    discountPercent: 15,
    endsAt: '2099-01-01T00:00:00Z',
    minimumSubtotal: 10_000,
    startsAt: '2020-01-01T00:00:00Z',
  },
  discountAmount: 11_880,
  total: 67_320,
  version: 4,
}

export const expiredCouponFixture: CartDto = {
  ...appliedCouponFixture,
  checkoutToken: null,
  discountAmount: 0,
  issues: [{ code: 'COUPON_EXPIRED' }],
  total: appliedCouponFixture.subtotal,
}
