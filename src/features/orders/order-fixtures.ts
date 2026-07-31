import type { OrderDto } from '@/contracts/order'

export const orderFixture: OrderDto = {
  couponCode: 'WELCOME15',
  createdAt: '2026-07-30T00:00:00Z',
  discountAmount: 11_880,
  discountPercent: 15,
  id: '70000000-0000-4000-8000-000000000001',
  items: [
    {
      lineTotal: 57_200,
      productId: '30000000-0000-4000-8000-000000000001',
      productName: '注文時のリネンブレンド オーバーシャツ',
      quantity: 2,
      unitPrice: 28_600,
    },
    {
      lineTotal: 22_000,
      productId: '30000000-0000-4000-8000-000000000003',
      productName: '注文時のスエード コートスニーカー',
      quantity: 1,
      unitPrice: 22_000,
    },
  ],
  status: 'received',
  subtotal: 79_200,
  total: 67_320,
  version: 1,
}
