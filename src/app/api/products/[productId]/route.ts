import {
  productIdSchema,
  productResponseSchema,
} from '@/contracts/product'
import { findPublishedProduct } from '@/features/products/server/product-service'
import { getRuntimeDatabase } from '@/server/db/runtime'
import {
  apiErrorResponse,
  noStoreJsonResponse,
} from '@/server/http/json'

type ProductRouteContext = {
  params: Promise<{ productId: string }>
}

export async function GET(_request: Request, context: ProductRouteContext) {
  const { productId } = await context.params
  const parsedProductId = productIdSchema.safeParse(productId)
  if (!parsedProductId.success) {
    return apiErrorResponse(
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
      return apiErrorResponse(
        404,
        'PRODUCT_NOT_FOUND',
        '商品が見つかりませんでした。',
      )
    }

    const responseBody = productResponseSchema.parse({ product })

    return noStoreJsonResponse(responseBody)
  } catch (error) {
    console.error('商品詳細の取得に失敗しました。', error)
    return apiErrorResponse(
      500,
      'INTERNAL_ERROR',
      '商品を取得できませんでした。時間をおいてもう一度お試しください。',
    )
  }
}
