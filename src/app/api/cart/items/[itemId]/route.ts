import type { NextRequest } from 'next/server'

import { cartItemIdSchema, updateCartItemRequestSchema } from '@/contracts/cart'
import {
  authorizeCartRequest,
  cartRouteErrorResponse,
  cartSuccessResponse,
} from '@/features/cart/server/cart-http'
import { deleteCartItem, updateCartItem } from '@/features/cart/server/cart-service'
import { Temporal } from '@/lib/date-time/temporal'
import { getRuntimeDatabase } from '@/server/db/runtime'
import { apiErrorResponse, parseJsonRequest } from '@/server/http/json'

type RouteContext = {
  params: Promise<{ itemId: string }>
}

async function parseItemId(context: RouteContext) {
  const { itemId } = await context.params
  return cartItemIdSchema.safeParse(itemId)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authorization = await authorizeCartRequest(request)
    if (!authorization.ok) return authorization.response

    const parsedItemId = await parseItemId(context)
    if (!parsedItemId.success) {
      return apiErrorResponse(400, 'VALIDATION_ERROR', 'カート明細IDの形式が正しくありません。')
    }

    const parsed = await parseJsonRequest(request, updateCartItemRequestSchema)
    if (!parsed.ok) return parsed.response

    const cart = await updateCartItem(parsedItemId.data, parsed.data, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
      userId: authorization.userId,
    })
    return cartSuccessResponse(cart)
  } catch (error) {
    return cartRouteErrorResponse(error, {
      logMessage: 'カート明細の更新に失敗しました。',
      responseMessage: 'カートを更新できませんでした。時間をおいてもう一度お試しください。',
    })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authorization = await authorizeCartRequest(request)
    if (!authorization.ok) return authorization.response

    const parsedItemId = await parseItemId(context)
    if (!parsedItemId.success) {
      return apiErrorResponse(400, 'VALIDATION_ERROR', 'カート明細IDの形式が正しくありません。')
    }

    const cart = await deleteCartItem(parsedItemId.data, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
      userId: authorization.userId,
    })
    return cartSuccessResponse(cart)
  } catch (error) {
    return cartRouteErrorResponse(error, {
      logMessage: 'カート明細の削除に失敗しました。',
      responseMessage: '商品を削除できませんでした。時間をおいてもう一度お試しください。',
    })
  }
}
