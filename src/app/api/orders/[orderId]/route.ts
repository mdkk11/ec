import type { NextRequest } from 'next/server'

import { orderIdSchema } from '@/contracts/order'
import {
  authorizeOrderRequest,
  orderRouteErrorResponse,
  orderSuccessResponse,
} from '@/features/orders/server/order-http'
import { findOrder } from '@/features/orders/server/order-service'
import { getRuntimeDatabase } from '@/server/db/runtime'
import { apiErrorResponse } from '@/server/http/json'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const authorization = await authorizeOrderRequest(request)
    if (!authorization.ok) return authorization.response

    const { orderId } = await params
    const parsedId = orderIdSchema.safeParse(orderId)
    if (!parsedId.success) {
      return apiErrorResponse(
        404,
        'ORDER_NOT_FOUND',
        '注文が見つかりませんでした。',
      )
    }

    const order = await findOrder(parsedId.data, {
      db: getRuntimeDatabase().db,
      userId: authorization.userId,
    })
    if (!order) {
      return apiErrorResponse(
        404,
        'ORDER_NOT_FOUND',
        '注文が見つかりませんでした。',
      )
    }

    return orderSuccessResponse(order)
  } catch (error) {
    return orderRouteErrorResponse(error, {
      logMessage: '注文詳細の取得に失敗しました。',
      responseMessage:
        '注文詳細を取得できませんでした。時間をおいてもう一度お試しください。',
    })
  }
}
