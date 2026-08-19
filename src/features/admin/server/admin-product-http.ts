import type { NextRequest } from 'next/server'

import {
  adminProductListResponseSchema,
  adminProductResponseSchema,
} from '@/contracts/product'
import { requireAdminRequest } from '@/server/auth/request-actor'
import {
  apiErrorResponse,
  noStoreJsonResponse,
} from '@/server/http/json'

import { AdminProductServiceError } from './admin-product-service'

type AuthorizationResult =
  | { ok: true; adminId: string }
  | { ok: false; response: Response }

export async function authorizeAdminProductRequest(
  request: NextRequest,
): Promise<AuthorizationResult> {
  const authorization = await requireAdminRequest(request)
  if (authorization.ok) {
    return { adminId: authorization.actor.id, ok: true }
  }
  return {
    ok: false,
    response:
      authorization.code === 'UNAUTHENTICATED'
        ? apiErrorResponse(401, 'UNAUTHENTICATED', 'ログインが必要です。')
        : apiErrorResponse(403, 'FORBIDDEN', '管理者権限が必要です。'),
  }
}

export function adminProductRouteErrorResponse(error: unknown) {
  if (error instanceof AdminProductServiceError) {
    if (error.code === 'INVALID_CATEGORY') {
      return apiErrorResponse(
        400,
        'VALIDATION_ERROR',
        error.message,
        { categoryId: [error.message] },
      )
    }
    return apiErrorResponse(
      error.code === 'PRODUCT_NOT_FOUND' ? 404 : 409,
      error.code,
      error.message,
    )
  }
  console.error('管理商品の処理に失敗しました。', error)
  return apiErrorResponse(
    500,
    'INTERNAL_ERROR',
    '商品を処理できませんでした。時間をおいてもう一度お試しください。',
  )
}

export function adminProductListSuccessResponse(items: unknown) {
  const body = adminProductListResponseSchema.parse({ items })
  return noStoreJsonResponse(body)
}

export function adminProductSuccessResponse(
  product: unknown,
  status: 200 | 201 = 200,
) {
  const body = adminProductResponseSchema.parse({ product })
  return noStoreJsonResponse(body, status)
}
