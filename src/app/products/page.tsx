import type { Metadata } from 'next'

import { ProductListView } from '@/features/products/ProductListView'
import { loadProductListPageData } from '@/features/products/server/product-page-data'

export const metadata: Metadata = {
  title: 'ALL ITEMS',
  description: 'MockShopで公開中の商品を、新しく届いた順にご覧いただけます。',
}

export const dynamic = 'force-dynamic'

export default async function Page() {
  const items = await loadProductListPageData()
  return <ProductListView items={items} status="success" />
}
