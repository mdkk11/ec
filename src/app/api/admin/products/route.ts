import type { NextRequest } from 'next/server'

import { createAdminProductRequestSchema } from '@/contracts/product'
import {
  adminProductListSuccessResponse,
  adminProductRouteErrorResponse,
  adminProductSuccessResponse,
  authorizeAdminProductRequest,
} from '@/features/admin/server/admin-product-http'
import {
  createAdminProduct,
  listAdminProducts,
} from '@/features/admin/server/admin-product-service'
import { Temporal } from '@/lib/date-time/temporal'
import { getRuntimeDatabase } from '@/server/db/runtime'
import { parseJsonRequest } from '@/server/http/json'

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeAdminProductRequest(request)
    if (!authorization.ok) return authorization.response

    const items = await listAdminProducts({
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
    })
    return adminProductListSuccessResponse(items)
  } catch (error) {
    return adminProductRouteErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeAdminProductRequest(request)
    if (!authorization.ok) return authorization.response

    const parsed = await parseJsonRequest(request, createAdminProductRequestSchema)
    if (!parsed.ok) return parsed.response

    const product = await createAdminProduct(parsed.data, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
    })
    return adminProductSuccessResponse(product, 201)
  } catch (error) {
    return adminProductRouteErrorResponse(error)
  }
}
