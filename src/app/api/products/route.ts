import { NextResponse } from 'next/server'

import { productListResponseSchema } from '@/contracts/product'
import { listPublishedProducts } from '@/features/products/server/product-service'
import {
  productErrorResponse,
  productResponseHeaders,
} from '@/features/products/server/product-http'
import { getRuntimeDatabase } from '@/server/db/runtime'

export async function GET() {
  try {
    const items = await listPublishedProducts({
      db: getRuntimeDatabase().db,
    })

    const responseBody = productListResponseSchema.parse({ items })

    return NextResponse.json(
      responseBody,
      { headers: productResponseHeaders, status: 200 },
    )
  } catch (error) {
    console.error('商品一覧の取得に失敗しました。', error)
    return productErrorResponse(
      500,
      'INTERNAL_ERROR',
      '商品を取得できませんでした。時間をおいてもう一度お試しください。',
    )
  }
}
