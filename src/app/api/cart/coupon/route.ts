import type { NextRequest } from 'next/server'

import { applyCouponRequestSchema } from '@/contracts/cart'
import {
  authorizeCartRequest,
  cartRouteErrorResponse,
  cartSuccessResponse,
} from '@/features/cart/server/cart-http'
import { applyCoupon, removeCoupon } from '@/features/cart/server/cart-service'
import { Temporal } from '@/lib/date-time/temporal'
import { getRuntimeDatabase } from '@/server/db/runtime'
import { parseJsonRequest } from '@/server/http/json'

export async function PUT(request: NextRequest) {
  try {
    const now = Temporal.Now.instant()
    const authorization = await authorizeCartRequest(request, now)
    if (!authorization.ok) return authorization.response

    const parsed = await parseJsonRequest(request, applyCouponRequestSchema)
    if (!parsed.ok) return parsed.response

    const cart = await applyCoupon(parsed.data, {
      db: getRuntimeDatabase().db,
      now,
      userId: authorization.userId,
    })
    return cartSuccessResponse(cart)
  } catch (error) {
    return cartRouteErrorResponse(error, {
      logMessage: 'クーポンの適用に失敗しました。',
      responseMessage: 'クーポンを適用できませんでした。時間をおいてもう一度お試しください。',
    })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const now = Temporal.Now.instant()
    const authorization = await authorizeCartRequest(request, now)
    if (!authorization.ok) return authorization.response

    const cart = await removeCoupon({
      db: getRuntimeDatabase().db,
      now,
      userId: authorization.userId,
    })
    return cartSuccessResponse(cart)
  } catch (error) {
    return cartRouteErrorResponse(error, {
      logMessage: 'クーポンの解除に失敗しました。',
      responseMessage: 'クーポンを解除できませんでした。時間をおいてもう一度お試しください。',
    })
  }
}
