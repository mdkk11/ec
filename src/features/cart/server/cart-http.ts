import type { NextRequest } from 'next/server'

import { cartResponseSchema } from '@/contracts/cart'
import { requireCustomerRequest } from '@/server/auth/request-actor'
import { apiErrorResponse, noStoreJsonResponse } from '@/server/http/json'

import { CartServiceError } from './cart-service'

type CartAuthorizationResult = { ok: true; userId: string } | { ok: false; response: Response }

export async function authorizeCartRequest(
  request: NextRequest,
  now?: Parameters<typeof requireCustomerRequest>[1],
): Promise<CartAuthorizationResult> {
  const authorization = await requireCustomerRequest(request, now)
  if (authorization.ok) {
    return { ok: true, userId: authorization.actor.id }
  }

  return {
    ok: false,
    response:
      authorization.code === 'UNAUTHENTICATED'
        ? apiErrorResponse(401, authorization.code, 'ログインが必要です。')
        : apiErrorResponse(403, authorization.code, 'カートは購入者専用です。'),
  }
}

function cartServiceErrorResponse(error: CartServiceError) {
  if (error.code === 'QUANTITY_EXCEEDS_STOCK') {
    return apiErrorResponse(400, error.code, error.message, {
      quantity: [error.message],
    })
  }
  if (error.code.startsWith('COUPON_')) {
    return apiErrorResponse(
      error.code === 'COUPON_NOT_FOUND' ? 404 : 400,
      error.code,
      error.message,
      { code: [error.message] },
    )
  }
  return apiErrorResponse(404, error.code, error.message)
}

export function cartRouteErrorResponse(
  error: unknown,
  {
    logMessage,
    responseMessage,
  }: {
    logMessage: string
    responseMessage: string
  },
) {
  if (error instanceof CartServiceError) {
    return cartServiceErrorResponse(error)
  }

  console.error(logMessage, error)
  return apiErrorResponse(500, 'INTERNAL_ERROR', responseMessage)
}

export function cartSuccessResponse(cart: unknown, status: 200 | 201 = 200) {
  const body = cartResponseSchema.parse({ cart })
  return noStoreJsonResponse(body, status)
}
