import {
  orderListResponseSchema,
  orderResponseSchema,
  type UpdateAdminOrderStatusRequest,
} from '@/contracts/order'

import { requestJson } from './request-json'

const jsonHeaders = { 'Content-Type': 'application/json' }

export function getAdminOrders(signal?: AbortSignal) {
  return requestJson('/api/admin/orders', orderListResponseSchema, { signal })
}

export function updateAdminOrderStatus(
  orderId: string,
  input: UpdateAdminOrderStatusRequest,
  signal?: AbortSignal,
) {
  return requestJson(
    `/api/admin/orders/${orderId}/status`,
    orderResponseSchema,
    {
      body: JSON.stringify(input),
      headers: jsonHeaders,
      method: 'PATCH',
      signal,
    },
  )
}
