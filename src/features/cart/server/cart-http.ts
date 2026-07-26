import { NextResponse } from 'next/server'

import type { ApiError } from '@/contracts/api-error'
import { cartResponseSchema } from '@/contracts/cart'

import { CartServiceError } from './cart-service'

export const cartResponseHeaders = {
  'Cache-Control': 'no-store',
}

export function cartErrorResponse(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
) {
  const body: ApiError = {
    code,
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  }
  return NextResponse.json(body, {
    headers: cartResponseHeaders,
    status,
  })
}

export function validationFieldErrors(error: {
  issues: { message: string; path: PropertyKey[] }[]
}) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field !== 'string') continue
    fieldErrors[field] ??= []
    fieldErrors[field].push(issue.message)
  }
  return fieldErrors
}

export function cartServiceErrorResponse(error: CartServiceError) {
  if (error.code === 'QUANTITY_EXCEEDS_STOCK') {
    return cartErrorResponse(400, error.code, error.message, {
      quantity: [error.message],
    })
  }
  if (error.code.startsWith('COUPON_')) {
    return cartErrorResponse(
      error.code === 'COUPON_NOT_FOUND' ? 404 : 400,
      error.code,
      error.message,
      { code: [error.message] },
    )
  }
  return cartErrorResponse(404, error.code, error.message)
}

export function cartSuccessResponse(
  cart: unknown,
  status: 200 | 201 = 200,
) {
  const body = cartResponseSchema.parse({ cart })
  return NextResponse.json(body, {
    headers: cartResponseHeaders,
    status,
  })
}
