import type { NextRequest } from 'next/server'

import { createOrderRequestSchema } from '@/contracts/order'
import {
  authorizeOrderRequest,
  orderListSuccessResponse,
  orderRouteErrorResponse,
  orderSuccessResponse,
} from '@/features/orders/server/order-http'
import {
  createOrder,
  listOrders,
} from '@/features/orders/server/order-service'
import { Temporal } from '@/lib/date-time/temporal'
import { getRuntimeDatabase } from '@/server/db/runtime'
import { parseJsonRequest } from '@/server/http/json'

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeOrderRequest(request)
    if (!authorization.ok) return authorization.response

    const items = await listOrders({
      db: getRuntimeDatabase().db,
      userId: authorization.userId,
    })
    return orderListSuccessResponse(items)
  } catch (error) {
    return orderRouteErrorResponse(error, {
      logMessage: '注文履歴の取得に失敗しました。',
      responseMessage:
        '注文履歴を取得できませんでした。時間をおいてもう一度お試しください。',
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeOrderRequest(request)
    if (!authorization.ok) return authorization.response

    const parsed = await parseJsonRequest(
      request,
      createOrderRequestSchema,
    )
    if (!parsed.ok) return parsed.response

    const order = await createOrder(parsed.data, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
      userId: authorization.userId,
    })
    return orderSuccessResponse(order, 201)
  } catch (error) {
    return orderRouteErrorResponse(error, {
      logMessage: '注文の確定に失敗しました。',
      responseMessage:
        '注文を確定できませんでした。時間をおいてもう一度お試しください。',
    })
  }
}
