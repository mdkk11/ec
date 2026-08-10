import type { NextRequest } from 'next/server'

import {
  adminOrderRouteErrorResponse,
  adminOrderSuccessResponse,
  authorizeAdminOrderRequest,
} from '@/features/admin/server/admin-order-http'
import { updateAdminOrderStatus } from '@/features/admin/server/admin-order-service'
import {
  orderIdSchema,
  updateAdminOrderStatusRequestSchema,
} from '@/contracts/order'
import { Temporal } from '@/lib/date-time/temporal'
import { getRuntimeDatabase } from '@/server/db/runtime'
import {
  apiErrorResponse,
  parseJsonRequest,
} from '@/server/http/json'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const authorization = await authorizeAdminOrderRequest(request)
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

    const parsed = await parseJsonRequest(
      request,
      updateAdminOrderStatusRequestSchema,
    )
    if (!parsed.ok) return parsed.response

    const order = await updateAdminOrderStatus(parsedId.data, parsed.data, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
    })
    return adminOrderSuccessResponse(order)
  } catch (error) {
    return adminOrderRouteErrorResponse(error)
  }
}
