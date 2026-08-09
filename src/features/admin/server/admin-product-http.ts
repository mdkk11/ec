import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

import type { ApiError } from '@/contracts/api-error'
import {
  adminProductListResponseSchema,
  adminProductResponseSchema,
} from '@/contracts/product'
import { requireAdminRequest } from '@/server/auth/request-actor'

import { AdminProductServiceError } from './admin-product-service'

export const adminProductResponseHeaders = {
  'Cache-Control': 'no-store',
}

type AuthorizationResult =
  | { ok: true; adminId: string }
  | { ok: false; response: Response }

type ParseResult<T> =
  | { ok: true; data: T }
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
        ? adminProductErrorResponse(401, 'UNAUTHENTICATED', 'ログインが必要です。')
        : adminProductErrorResponse(403, 'FORBIDDEN', '管理者権限が必要です。'),
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

export async function parseAdminProductJsonRequest<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<ParseResult<T>> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return {
      ok: false,
      response: adminProductErrorResponse(
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
      response: adminProductErrorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
        validationFieldErrors(parsed.error),
      ),
    }
  }
  return { data: parsed.data, ok: true }
}

export function adminProductErrorResponse(
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
    headers: adminProductResponseHeaders,
    status,
  })
}

export function adminProductRouteErrorResponse(error: unknown) {
  if (error instanceof AdminProductServiceError) {
    return adminProductErrorResponse(
      error.code === 'PRODUCT_NOT_FOUND' ? 404 : 409,
      error.code,
      error.message,
    )
  }
  console.error('管理商品の処理に失敗しました。', error)
  return adminProductErrorResponse(
    500,
    'INTERNAL_ERROR',
    '商品を処理できませんでした。時間をおいてもう一度お試しください。',
  )
}

export function adminProductListSuccessResponse(items: unknown) {
  const body = adminProductListResponseSchema.parse({ items })
  return NextResponse.json(body, {
    headers: adminProductResponseHeaders,
    status: 200,
  })
}

export function adminProductSuccessResponse(
  product: unknown,
  status: 200 | 201 = 200,
) {
  const body = adminProductResponseSchema.parse({ product })
  return NextResponse.json(body, {
    headers: adminProductResponseHeaders,
    status,
  })
}
