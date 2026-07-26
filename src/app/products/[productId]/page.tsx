import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { productIdSchema } from '@/contracts/product'
import { ProductCartAction } from '@/features/cart/ProductCartAction'
import { ProductDetailView } from '@/features/products/ProductDetailView'
import { loadProductDetailPageData } from '@/features/products/server/product-page-data'

export const metadata: Metadata = {
  title: '商品詳細',
}

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  const parsedProductId = productIdSchema.safeParse(productId)
  if (!parsedProductId.success) notFound()

  const product = await loadProductDetailPageData(parsedProductId.data)
  if (!product) notFound()

  return (
    <ProductDetailView
      product={product}
      purchaseAction={
        <ProductCartAction
          availability={product.availability}
          productId={product.id}
        />
      }
      status="success"
    />
  )
}
