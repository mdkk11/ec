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
