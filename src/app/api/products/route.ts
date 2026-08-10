import { productListResponseSchema } from '@/contracts/product'
import { listPublishedProducts } from '@/features/products/server/product-service'
import { getRuntimeDatabase } from '@/server/db/runtime'
import {
  apiErrorResponse,
  noStoreJsonResponse,
} from '@/server/http/json'

export async function GET() {
  try {
    const items = await listPublishedProducts({
      db: getRuntimeDatabase().db,
    })

    const responseBody = productListResponseSchema.parse({ items })

    return noStoreJsonResponse(responseBody)
  } catch (error) {
    console.error('商品一覧の取得に失敗しました。', error)
    return apiErrorResponse(
      500,
      'INTERNAL_ERROR',
      '商品を取得できませんでした。時間をおいてもう一度お試しください。',
    )
  }
}
