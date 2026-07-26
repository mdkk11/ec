import type { NextRequest } from 'next/server'

import {
  cartErrorResponse,
  cartSuccessResponse,
} from '@/features/cart/server/cart-http'
import { getCart } from '@/features/cart/server/cart-service'
import { Temporal } from '@/lib/date-time/temporal'
import { requireCustomerRequest } from '@/server/auth/request-actor'
import { getRuntimeDatabase } from '@/server/db/runtime'

export async function GET(request: NextRequest) {
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

    const cart = await getCart({
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
      userId: authorization.actor.id,
    })
    return cartSuccessResponse(cart)
  } catch (error) {
    console.error('カートの取得に失敗しました。', error)
    return cartErrorResponse(
      500,
      'INTERNAL_ERROR',
      'カートを取得できませんでした。時間をおいてもう一度お試しください。',
    )
  }
}
