import type { NextRequest } from 'next/server'

import { applyCouponRequestSchema } from '@/contracts/cart'
import {
  cartErrorResponse,
  cartServiceErrorResponse,
  cartSuccessResponse,
  validationFieldErrors,
} from '@/features/cart/server/cart-http'
import {
  applyCoupon,
  CartServiceError,
  removeCoupon,
} from '@/features/cart/server/cart-service'
import { Temporal } from '@/lib/date-time/temporal'
import { requireCustomerRequest } from '@/server/auth/request-actor'
import { getRuntimeDatabase } from '@/server/db/runtime'

async function authorize(
  request: NextRequest,
  now: Temporal.Instant,
) {
  const authorization = await requireCustomerRequest(request, now)
  if (authorization.ok) return authorization
  return authorization.code === 'UNAUTHENTICATED'
    ? cartErrorResponse(401, authorization.code, 'ログインが必要です。')
    : cartErrorResponse(
        403,
        authorization.code,
        'カートは購入者専用です。',
      )
}

export async function PUT(request: NextRequest) {
  try {
    const now = Temporal.Now.instant()
    const authorization = await authorize(request, now)
    if (authorization instanceof Response) return authorization

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return cartErrorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
      )
    }
    const parsed = applyCouponRequestSchema.safeParse(payload)
    if (!parsed.success) {
      return cartErrorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
        validationFieldErrors(parsed.error),
      )
    }

    const cart = await applyCoupon(parsed.data, {
      db: getRuntimeDatabase().db,
      now,
      userId: authorization.actor.id,
    })
    return cartSuccessResponse(cart)
  } catch (error) {
    if (error instanceof CartServiceError) {
      return cartServiceErrorResponse(error)
    }
    console.error('クーポンの適用に失敗しました。', error)
    return cartErrorResponse(
      500,
      'INTERNAL_ERROR',
      'クーポンを適用できませんでした。時間をおいてもう一度お試しください。',
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const now = Temporal.Now.instant()
    const authorization = await authorize(request, now)
    if (authorization instanceof Response) return authorization

    const cart = await removeCoupon({
      db: getRuntimeDatabase().db,
      now,
      userId: authorization.actor.id,
    })
    return cartSuccessResponse(cart)
  } catch (error) {
    if (error instanceof CartServiceError) {
      return cartServiceErrorResponse(error)
    }
    console.error('クーポンの解除に失敗しました。', error)
    return cartErrorResponse(
      500,
      'INTERNAL_ERROR',
      'クーポンを解除できませんでした。時間をおいてもう一度お試しください。',
    )
  }
}
