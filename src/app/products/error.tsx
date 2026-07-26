'use client'

import { ProductListView } from '@/features/products/ProductListView'

type ProductListErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ reset }: ProductListErrorProps) {
  return (
    <ProductListView
      message="商品を取得できませんでした。時間をおいてもう一度お試しください。"
      onRetry={reset}
      status="error"
    />
  )
}
