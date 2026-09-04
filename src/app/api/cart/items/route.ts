import type { NextRequest } from 'next/server'

import { addCartItemRequestSchema } from '@/contracts/cart'
import {
  authorizeCartRequest,
  cartRouteErrorResponse,
  cartSuccessResponse,
} from '@/features/cart/server/cart-http'
import { addCartItem } from '@/features/cart/server/cart-service'
import { Temporal } from '@/lib/date-time/temporal'
import { getRuntimeDatabase } from '@/server/db/runtime'
import { parseJsonRequest } from '@/server/http/json'

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeCartRequest(request)
    if (!authorization.ok) return authorization.response

    const parsed = await parseJsonRequest(request, addCartItemRequestSchema)
    if (!parsed.ok) return parsed.response

    const cart = await addCartItem(parsed.data, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
      userId: authorization.userId,
    })
    return cartSuccessResponse(cart, 201)
  } catch (error) {
    return cartRouteErrorResponse(error, {
      logMessage: 'カートへの商品追加に失敗しました。',
      responseMessage: '商品を追加できませんでした。時間をおいてもう一度お試しください。',
    })
  }
}
