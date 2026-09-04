import type { NextRequest } from 'next/server'

import { productIdSchema, updateAdminProductRequestSchema } from '@/contracts/product'
import {
  adminProductRouteErrorResponse,
  adminProductSuccessResponse,
  authorizeAdminProductRequest,
} from '@/features/admin/server/admin-product-http'
import { updateAdminProduct } from '@/features/admin/server/admin-product-service'
import { Temporal } from '@/lib/date-time/temporal'
import { getRuntimeDatabase } from '@/server/db/runtime'
import { apiErrorResponse, parseJsonRequest } from '@/server/http/json'

type RouteContext = {
  params: Promise<{ productId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authorization = await authorizeAdminProductRequest(request)
    if (!authorization.ok) return authorization.response

    const { productId } = await context.params
    const parsedProductId = productIdSchema.safeParse(productId)
    if (!parsedProductId.success) {
      return apiErrorResponse(400, 'VALIDATION_ERROR', '商品IDの形式を確認してください。')
    }

    const parsed = await parseJsonRequest(request, updateAdminProductRequestSchema)
    if (!parsed.ok) return parsed.response

    const product = await updateAdminProduct(parsedProductId.data, parsed.data, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
    })
    return adminProductSuccessResponse(product)
  } catch (error) {
    return adminProductRouteErrorResponse(error)
  }
}
