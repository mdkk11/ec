import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

import type { ApiError } from '@/contracts/api-error'
import {
  orderListResponseSchema,
  orderResponseSchema,
} from '@/contracts/order'
import { requireAdminRequest } from '@/server/auth/request-actor'

import { AdminOrderServiceError } from './admin-order-service'

export const adminOrderResponseHeaders = {
  'Cache-Control': 'no-store',
}

type AuthorizationResult =
  | { ok: true }
  | { ok: false; response: Response }

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response }

export async function authorizeAdminOrderRequest(
  request: NextRequest,
): Promise<AuthorizationResult> {
  const authorization = await requireAdminRequest(request)
  if (authorization.ok) return { ok: true }
  return {
    ok: false,
    response: adminOrderErrorResponse(
      authorization.code === 'UNAUTHENTICATED' ? 401 : 403,
      authorization.code === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'FORBIDDEN',
      authorization.code === 'UNAUTHENTICATED'
        ? 'ログインが必要です。'
        : '管理者権限が必要です。',
    ),
  }
}

function validationFieldErrors(error: {
  issues: { message: string; path: PropertyKey[] }[]
}) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field !== 'string') continue
    fieldErrors[field] ??= []
    fieldErrors[field].push(issue.message)
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined
}

export function adminOrderErrorResponse(
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
    headers: adminOrderResponseHeaders,
    status,
  })
}

export async function parseAdminOrderJsonRequest<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<ParseResult<T>> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return {
      ok: false,
      response: adminOrderErrorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
      ),
    }
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return {
      ok: false,
      response: adminOrderErrorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
        validationFieldErrors(parsed.error),
      ),
    }
  }
  return { data: parsed.data, ok: true }
}

export function adminOrderServiceErrorResponse(error: AdminOrderServiceError) {
  return adminOrderErrorResponse(
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
  return adminOrderErrorResponse(
    500,
    'INTERNAL_ERROR',
    '注文を処理できませんでした。時間をおいてもう一度お試しください。',
  )
}

export function adminOrderListSuccessResponse(items: unknown) {
  const body = orderListResponseSchema.parse({ items })
  return NextResponse.json(body, {
    headers: adminOrderResponseHeaders,
    status: 200,
  })
}

export function adminOrderSuccessResponse(order: unknown) {
  const body = orderResponseSchema.parse({ order })
  return NextResponse.json(body, {
    headers: adminOrderResponseHeaders,
    status: 200,
  })
}
