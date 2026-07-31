import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

import type { ApiError } from '@/contracts/api-error'
import {
  orderListResponseSchema,
  orderResponseSchema,
} from '@/contracts/order'
import { requireCustomerRequest } from '@/server/auth/request-actor'

import { OrderServiceError } from './order-service'

export const orderResponseHeaders = {
  'Cache-Control': 'no-store',
}

type AuthorizationResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response }

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response }

export function orderErrorResponse(
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
    headers: orderResponseHeaders,
    status,
  })
}

export async function authorizeOrderRequest(
  request: NextRequest,
): Promise<AuthorizationResult> {
  const authorization = await requireCustomerRequest(request)
  if (authorization.ok) {
    return { ok: true, userId: authorization.actor.id }
  }

  return {
    ok: false,
    response:
      authorization.code === 'UNAUTHENTICATED'
        ? orderErrorResponse(
            401,
            authorization.code,
            'ログインが必要です。',
          )
        : orderErrorResponse(
            403,
            authorization.code,
            '注文機能は購入者専用です。',
          ),
  }
}

export async function parseOrderJsonRequest<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<ParseResult<T>> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return {
      ok: false,
      response: orderErrorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
      ),
    }
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]
      if (typeof field !== 'string') continue
      fieldErrors[field] ??= []
      fieldErrors[field].push(issue.message)
    }
    return {
      ok: false,
      response: orderErrorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
        Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
      ),
    }
  }

  return { data: parsed.data, ok: true }
}

export function orderServiceErrorResponse(error: OrderServiceError) {
  if (error.code === 'EMPTY_CART') {
    return orderErrorResponse(400, error.code, error.message)
  }
  return orderErrorResponse(409, error.code, error.message)
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
  return orderErrorResponse(
    500,
    'INTERNAL_ERROR',
    responseMessage,
  )
}

export function orderSuccessResponse(order: unknown, status: 200 | 201 = 200) {
  const body = orderResponseSchema.parse({ order })
  return NextResponse.json(body, {
    headers: orderResponseHeaders,
    status,
  })
}

export function orderListSuccessResponse(items: unknown) {
  const body = orderListResponseSchema.parse({ items })
  return NextResponse.json(body, {
    headers: orderResponseHeaders,
    status: 200,
  })
}
