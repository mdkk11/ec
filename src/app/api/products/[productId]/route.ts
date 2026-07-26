import { NextResponse } from 'next/server'

import {
  productIdSchema,
  productResponseSchema,
} from '@/contracts/product'
import {
  productErrorResponse,
  productResponseHeaders,
} from '@/features/products/server/product-http'
import { findPublishedProduct } from '@/features/products/server/product-service'
import { getRuntimeDatabase } from '@/server/db/runtime'

type ProductRouteContext = {
  params: Promise<{ productId: string }>
}

export async function GET(_request: Request, context: ProductRouteContext) {
  const { productId } = await context.params
  const parsedProductId = productIdSchema.safeParse(productId)
  if (!parsedProductId.success) {
    return productErrorResponse(
      400,
      'VALIDATION_ERROR',
      '商品IDの形式を確認してください。',
    )
  }

  try {
    const product = await findPublishedProduct(parsedProductId.data, {
      db: getRuntimeDatabase().db,
    })
    if (!product) {
      return productErrorResponse(
        404,
        'PRODUCT_NOT_FOUND',
        '商品が見つかりませんでした。',
      )
    }

    const responseBody = productResponseSchema.parse({ product })

    return NextResponse.json(
      responseBody,
      { headers: productResponseHeaders, status: 200 },
    )
  } catch (error) {
    console.error('商品詳細の取得に失敗しました。', error)
    return productErrorResponse(
      500,
      'INTERNAL_ERROR',
      '商品を取得できませんでした。時間をおいてもう一度お試しください。',
    )
  }
}
