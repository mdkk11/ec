'use client'

import { useEffect, useState } from 'react'

import type { ProductDto } from '@/contracts/product'
import { getProduct } from '@/lib/api-client/products'
import { ApiClientError } from '@/lib/api-client/request-json'

import { ProductDetailView } from './ProductDetailView'

type ProductDetailState =
  | { status: 'loading' }
  | { product: ProductDto; status: 'success' }
  | { status: 'not_found' }
  | { message: string; status: 'error' }

function productDetailErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && error.kind === 'invalid_response') {
    return '商品データを確認できませんでした。もう一度お試しください。'
  }
  if (error instanceof ApiClientError && error.kind === 'network') {
    return 'サーバーへ接続できませんでした。通信状況を確認してください。'
  }
  return '通信状況を確認して、もう一度お試しください。'
}

export function ProductDetailPage({ productId }: { productId: string }) {
  const [requestKey, setRequestKey] = useState(0)
  const [state, setState] = useState<ProductDetailState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    void getProduct(productId, controller.signal)
      .then((product) => {
        if (active) setState({ product, status: 'success' })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return
        if (
          error instanceof ApiClientError &&
          error.status === 404 &&
          error.code === 'PRODUCT_NOT_FOUND'
        ) {
          setState({ status: 'not_found' })
          return
        }
        setState({
          message: productDetailErrorMessage(error),
          status: 'error',
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [productId, requestKey])

  if (state.status === 'success') {
    return <ProductDetailView product={state.product} status="success" />
  }
  if (state.status === 'not_found') {
    return <ProductDetailView status="not_found" />
  }
  if (state.status === 'error') {
    return (
      <ProductDetailView
        message={state.message}
        onRetry={() => {
          setState({ status: 'loading' })
          setRequestKey((key) => key + 1)
        }}
        status="error"
      />
    )
  }
  return <ProductDetailView status="loading" />
}
