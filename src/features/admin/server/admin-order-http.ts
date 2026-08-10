import type { NextRequest } from 'next/server'

import {
  orderListResponseSchema,
  orderResponseSchema,
} from '@/contracts/order'
import { requireAdminRequest } from '@/server/auth/request-actor'
import {
  apiErrorResponse,
  noStoreJsonResponse,
} from '@/server/http/json'

import { AdminOrderServiceError } from './admin-order-service'

type AuthorizationResult =
  | { ok: true }
  | { ok: false; response: Response }

export async function authorizeAdminOrderRequest(
  request: NextRequest,
): Promise<AuthorizationResult> {
  const authorization = await requireAdminRequest(request)
  if (authorization.ok) return { ok: true }
  return {
    ok: false,
    response: apiErrorResponse(
      authorization.code === 'UNAUTHENTICATED' ? 401 : 403,
      authorization.code === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'FORBIDDEN',
      authorization.code === 'UNAUTHENTICATED'
        ? 'ログインが必要です。'
        : '管理者権限が必要です。',
    ),
  }
}

export function adminOrderServiceErrorResponse(error: AdminOrderServiceError) {
  return apiErrorResponse(
    error.code === 'ORDER_NOT_FOUND' ? 404 : 409,
    error.code,
    error.message,
  )
}

export function adminOrderRouteErrorResponse(error: unknown) {
  if (error instanceof AdminOrderServiceError) {
    return adminOrderServiceErrorResponse(error)
  }
  console.error('管理注文の処理に失敗しました。', error)
  return apiErrorResponse(
    500,
    'INTERNAL_ERROR',
    '注文を処理できませんでした。時間をおいてもう一度お試しください。',
  )
}

export function adminOrderListSuccessResponse(items: unknown) {
  const body = orderListResponseSchema.parse({ items })
  return noStoreJsonResponse(body)
}

export function adminOrderSuccessResponse(order: unknown) {
  const body = orderResponseSchema.parse({ order })
  return noStoreJsonResponse(body)
}
