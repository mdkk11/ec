import type { OrderDto } from '@/contracts/order'

export const adminOrderFixture: OrderDto = {
  couponCode: null,
  createdAt: '2026-08-01T00:00:00Z',
  discountAmount: 0,
  discountPercent: null,
  id: '70000000-0000-4000-8000-000000000010',
  items: [
    {
      lineTotal: 28_600,
      productId: '30000000-0000-4000-8000-000000000001',
      productName: '管理注文テスト商品',
      quantity: 1,
      unitPrice: 28_600,
    },
  ],
  status: 'received',
  subtotal: 28_600,
  total: 28_600,
  version: 1,
}
