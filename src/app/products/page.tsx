import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { productCategoryQuerySchema } from '@/contracts/category'
import { ProductListView } from '@/features/products/ProductListView'
import { loadProductListPageData } from '@/features/products/server/product-page-data'
import { ProductServiceError } from '@/features/products/server/product-service'

export const metadata: Metadata = {
  title: 'ALL ITEMS',
  description: 'MockShopで公開中の商品を、新しく届いた順にご覧いただけます。',
}

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const parsedQuery = productCategoryQuerySchema.safeParse(await searchParams)
  if (!parsedQuery.success) notFound()

  let data: Awaited<ReturnType<typeof loadProductListPageData>>
  try {
    data = await loadProductListPageData(parsedQuery.data.category)
  } catch (error) {
    if (error instanceof ProductServiceError) notFound()
    throw error
  }

  return <ProductListView {...data} status="success" />
}
