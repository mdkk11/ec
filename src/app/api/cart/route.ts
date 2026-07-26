import type { NextRequest } from 'next/server'

import {
  authorizeCartRequest,
  cartRouteErrorResponse,
  cartSuccessResponse,
} from '@/features/cart/server/cart-http'
import { getCart } from '@/features/cart/server/cart-service'
import { Temporal } from '@/lib/date-time/temporal'
import { getRuntimeDatabase } from '@/server/db/runtime'

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeCartRequest(request)
    if (!authorization.ok) return authorization.response

    const cart = await getCart({
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
      userId: authorization.userId,
    })
    return cartSuccessResponse(cart)
  } catch (error) {
    return cartRouteErrorResponse(error, {
      logMessage: 'カートの取得に失敗しました。',
      responseMessage:
        'カートを取得できませんでした。時間をおいてもう一度お試しください。',
    })
  }
}
