import {
  adminProductListResponseSchema,
  adminProductResponseSchema,
  type CreateAdminProductRequest,
  type UpdateAdminProductRequest,
  type UpdateAdminProductStockRequest,
} from '@/contracts/product'

import { requestJson } from './request-json'

const jsonHeaders = { 'Content-Type': 'application/json' }

export function getAdminProducts(signal?: AbortSignal) {
  return requestJson('/api/admin/products', adminProductListResponseSchema, {
    signal,
  })
}

export function createAdminProduct(input: CreateAdminProductRequest, signal?: AbortSignal) {
  return requestJson('/api/admin/products', adminProductResponseSchema, {
    body: JSON.stringify(input),
    headers: jsonHeaders,
    method: 'POST',
    signal,
  })
}

export function updateAdminProduct(
  productId: string,
  input: UpdateAdminProductRequest,
  signal?: AbortSignal,
) {
  return requestJson(`/api/admin/products/${productId}`, adminProductResponseSchema, {
    body: JSON.stringify(input),
    headers: jsonHeaders,
    method: 'PATCH',
    signal,
  })
}

export function updateAdminProductStock(
  productId: string,
  input: UpdateAdminProductStockRequest,
  signal?: AbortSignal,
) {
  return requestJson(`/api/admin/products/${productId}/stock`, adminProductResponseSchema, {
    body: JSON.stringify(input),
    headers: jsonHeaders,
    method: 'PATCH',
    signal,
  })
}
