import type { AdminProductDto } from '@/contracts/product'

export const adminProductFixture: AdminProductDto = {
  availability: 'in_stock',
  category: { name: '衣類', slug: 'clothing' },
  categoryId: '40000000-0000-4000-8000-000000000001',
  description:
    '軽やかなリネン混素材を使い、羽織りとしても一枚でも着られるよう仕立てたオーバーシャツです。',
  id: '30000000-0000-4000-8000-000000000001',
  imagePath: '/images/home/linen-overshirt.jpg',
  isPublished: true,
  name: 'リネンブレンド オーバーシャツ',
  price: 28_600,
  stock: 8,
  version: 3,
}
