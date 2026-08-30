import { type CreateOrderRequest, orderResponseSchema } from '@/contracts/order'

import { requestJson } from './request-json'

export function createOrder(input: CreateOrderRequest, signal?: AbortSignal) {
  return requestJson('/api/orders', orderResponseSchema, {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    signal,
  })
}
