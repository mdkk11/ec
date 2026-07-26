import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

import type { ApiError } from '@/contracts/api-error'
import { cartResponseSchema } from '@/contracts/cart'
import { requireCustomerRequest } from '@/server/auth/request-actor'

import { CartServiceError } from './cart-service'

export const cartResponseHeaders = {
  'Cache-Control': 'no-store',
}

type CartAuthorizationResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response }

type CartRequestParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response }

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
        ? cartErrorResponse(
            401,
            authorization.code,
            'ログインが必要です。',
          )
        : cartErrorResponse(
            403,
            authorization.code,
            'カートは購入者専用です。',
          ),
  }
}

export async function parseCartJsonRequest<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<CartRequestParseResult<T>> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return {
      ok: false,
      response: cartErrorResponse(
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
      response: cartErrorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
        validationFieldErrors(parsed.error),
      ),
    }
  }

  return { data: parsed.data, ok: true }
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
  return cartErrorResponse(
    500,
    'INTERNAL_ERROR',
    responseMessage,
  )
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
