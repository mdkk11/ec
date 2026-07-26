import {
  productListResponseSchema,
  productResponseSchema,
} from '@/contracts/product'

import { requestJson } from './request-json'

export function getProducts(signal?: AbortSignal) {
  return requestJson('/api/products', productListResponseSchema, { signal })
}

export async function getProduct(productId: string, signal?: AbortSignal) {
  const response = await requestJson(
    `/api/products/${encodeURIComponent(productId)}`,
    productResponseSchema,
    { signal },
  )
  return response.product
}
