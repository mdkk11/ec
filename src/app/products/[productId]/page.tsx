import type { Metadata } from 'next'

import { ProductDetailPage } from '@/features/products/ProductDetailPage'

export const metadata: Metadata = {
  title: '商品詳細',
}

export default async function Page({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  return <ProductDetailPage key={productId} productId={productId} />
}
