import type { NextRequest } from 'next/server'

import { addCartItemRequestSchema } from '@/contracts/cart'
import {
  cartErrorResponse,
  cartServiceErrorResponse,
  cartSuccessResponse,
  validationFieldErrors,
} from '@/features/cart/server/cart-http'
import {
  addCartItem,
  CartServiceError,
} from '@/features/cart/server/cart-service'
import { Temporal } from '@/lib/date-time/temporal'
import { requireCustomerRequest } from '@/server/auth/request-actor'
import { getRuntimeDatabase } from '@/server/db/runtime'

export async function POST(request: NextRequest) {
  try {
    const authorization = await requireCustomerRequest(request)
    if (!authorization.ok) {
      return authorization.code === 'UNAUTHENTICATED'
        ? cartErrorResponse(401, authorization.code, 'ログインが必要です。')
        : cartErrorResponse(
            403,
            authorization.code,
            'カートは購入者専用です。',
          )
    }

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
    const parsed = addCartItemRequestSchema.safeParse(payload)
    if (!parsed.success) {
      return cartErrorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
        validationFieldErrors(parsed.error),
      )
    }

    const cart = await addCartItem(parsed.data, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant().toString(),
      userId: authorization.actor.id,
    })
    return cartSuccessResponse(cart, 201)
  } catch (error) {
    if (error instanceof CartServiceError) {
      return cartServiceErrorResponse(error)
    }
    console.error('カートへの商品追加に失敗しました。', error)
    return cartErrorResponse(
      500,
      'INTERNAL_ERROR',
      '商品を追加できませんでした。時間をおいてもう一度お試しください。',
    )
  }
}
