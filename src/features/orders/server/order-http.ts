import type { NextRequest } from 'next/server'

import { orderListResponseSchema, orderResponseSchema } from '@/contracts/order'
import { requireCustomerRequest } from '@/server/auth/request-actor'
import { apiErrorResponse, noStoreJsonResponse } from '@/server/http/json'

import { OrderServiceError } from './order-service'

type AuthorizationResult = { ok: true; userId: string } | { ok: false; response: Response }

export async function authorizeOrderRequest(request: NextRequest): Promise<AuthorizationResult> {
  const authorization = await requireCustomerRequest(request)
  if (authorization.ok) {
    return { ok: true, userId: authorization.actor.id }
  }

  return {
    ok: false,
    response:
      authorization.code === 'UNAUTHENTICATED'
        ? apiErrorResponse(401, authorization.code, 'ログインが必要です。')
        : apiErrorResponse(403, authorization.code, '注文機能は購入者専用です。'),
  }
}

export function orderServiceErrorResponse(error: OrderServiceError) {
  if (error.code === 'EMPTY_CART') {
    return apiErrorResponse(400, error.code, error.message)
  }
  return apiErrorResponse(409, error.code, error.message)
}

export function orderRouteErrorResponse(
  error: unknown,
  {
    logMessage,
    responseMessage,
  }: {
    logMessage: string
    responseMessage: string
  },
) {
  if (error instanceof OrderServiceError) {
    return orderServiceErrorResponse(error)
  }

  console.error(logMessage, error)
  return apiErrorResponse(500, 'INTERNAL_ERROR', responseMessage)
}

export function orderSuccessResponse(order: unknown, status: 200 | 201 = 200) {
  const body = orderResponseSchema.parse({ order })
  return noStoreJsonResponse(body, status)
}

export function orderListSuccessResponse(items: unknown) {
  const body = orderListResponseSchema.parse({ items })
  return noStoreJsonResponse(body)
}
