import type { NextRequest } from 'next/server'

import {
  adminOrderListSuccessResponse,
  adminOrderRouteErrorResponse,
  authorizeAdminOrderRequest,
} from '@/features/admin/server/admin-order-http'
import { listAdminOrders } from '@/features/admin/server/admin-order-service'
import { getRuntimeDatabase } from '@/server/db/runtime'

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeAdminOrderRequest(request)
    if (!authorization.ok) return authorization.response

    const items = await listAdminOrders({ db: getRuntimeDatabase().db })
    return adminOrderListSuccessResponse(items)
  } catch (error) {
    return adminOrderRouteErrorResponse(error)
  }
}
