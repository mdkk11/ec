'use client'

import { ProductDetailView } from '@/features/products/ProductDetailView'

type ProductDetailErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ reset }: ProductDetailErrorProps) {
  return (
    <ProductDetailView
      message="商品を取得できませんでした。時間をおいてもう一度お試しください。"
      onRetry={reset}
      status="error"
    />
  )
}
