import {
  type ApplyCouponRequest,
  type AddCartItemRequest,
  cartResponseSchema,
  type UpdateCartItemRequest,
} from '@/contracts/cart'

import { requestJson } from './request-json'

const jsonHeaders = {
  'Content-Type': 'application/json',
}

export function getCart(signal?: AbortSignal) {
  return requestJson('/api/cart', cartResponseSchema, { signal })
}

export function addCartItem(input: AddCartItemRequest, signal?: AbortSignal) {
  return requestJson('/api/cart/items', cartResponseSchema, {
    body: JSON.stringify(input),
    headers: jsonHeaders,
    method: 'POST',
    signal,
  })
}

export function updateCartItem(itemId: string, input: UpdateCartItemRequest, signal?: AbortSignal) {
  return requestJson(`/api/cart/items/${itemId}`, cartResponseSchema, {
    body: JSON.stringify(input),
    headers: jsonHeaders,
    method: 'PATCH',
    signal,
  })
}

export function deleteCartItem(itemId: string, signal?: AbortSignal) {
  return requestJson(`/api/cart/items/${itemId}`, cartResponseSchema, {
    method: 'DELETE',
    signal,
  })
}

export function applyCartCoupon(input: ApplyCouponRequest, signal?: AbortSignal) {
  return requestJson('/api/cart/coupon', cartResponseSchema, {
    body: JSON.stringify(input),
    headers: jsonHeaders,
    method: 'PUT',
    signal,
  })
}

export function removeCartCoupon(signal?: AbortSignal) {
  return requestJson('/api/cart/coupon', cartResponseSchema, {
    method: 'DELETE',
    signal,
  })
}
