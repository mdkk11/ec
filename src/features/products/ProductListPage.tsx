'use client'

import { useEffect, useState } from 'react'

import type { ProductDto } from '@/contracts/product'
import { getProducts } from '@/lib/api-client/products'
import { ApiClientError } from '@/lib/api-client/request-json'

import { ProductListView } from './ProductListView'

type ProductListState =
  | { status: 'loading' }
  | { items: ProductDto[]; status: 'success' }
  | { message: string; status: 'error' }

function productListErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && error.kind === 'invalid_response') {
    return '商品データを確認できませんでした。もう一度お試しください。'
  }
  if (error instanceof ApiClientError && error.kind === 'network') {
    return 'サーバーへ接続できませんでした。通信状況を確認してください。'
  }
  return '通信状況を確認して、もう一度お試しください。'
}

export function ProductListPage() {
  const [requestKey, setRequestKey] = useState(0)
  const [state, setState] = useState<ProductListState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    void getProducts(controller.signal)
      .then(({ items }) => {
        if (active) setState({ items, status: 'success' })
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted) {
          setState({
            message: productListErrorMessage(error),
            status: 'error',
          })
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [requestKey])

  if (state.status === 'success') {
    return <ProductListView items={state.items} status="success" />
  }
  if (state.status === 'error') {
    return (
      <ProductListView
        message={state.message}
        onRetry={() => {
          setState({ status: 'loading' })
          setRequestKey((key) => key + 1)
        }}
        status="error"
      />
    )
  }
  return <ProductListView status="loading" />
}
