import type { Metadata } from 'next'

import { ProductListPage } from '@/features/products/ProductListPage'

export const metadata: Metadata = {
  title: '商品一覧',
  description: 'MockShopで公開中の商品を、新しく届いた順にご覧いただけます。',
}

export default function Page() {
  return <ProductListPage />
}
