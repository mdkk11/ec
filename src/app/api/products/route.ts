import { NextRequest } from 'next/server'

import { productCategoryQuerySchema } from '@/contracts/category'
import { productListResponseSchema } from '@/contracts/product'
import {
  listPublishedProducts,
  ProductServiceError,
} from '@/features/products/server/product-service'
import { getRuntimeDatabase } from '@/server/db/runtime'
import {
  apiErrorResponse,
  noStoreJsonResponse,
} from '@/server/http/json'

export async function GET(
  request = new NextRequest('http://localhost/api/products'),
) {
  const categoryValues = request.nextUrl.searchParams.getAll('category')
  const parsedQuery = productCategoryQuerySchema.safeParse({
    category:
      categoryValues.length < 2 ? categoryValues[0] : categoryValues,
  })
  if (!parsedQuery.success) {
    return apiErrorResponse(
      400,
      'VALIDATION_ERROR',
      'カテゴリの指定を確認してください。',
    )
  }

  try {
    const items = await listPublishedProducts({
      categorySlug: parsedQuery.data.category,
      db: getRuntimeDatabase().db,
    })

    const responseBody = productListResponseSchema.parse({ items })

    return noStoreJsonResponse(responseBody)
  } catch (error) {
    if (error instanceof ProductServiceError) {
      return apiErrorResponse(404, error.code, error.message)
    }
    console.error('商品一覧の取得に失敗しました。', error)
    return apiErrorResponse(
      500,
      'INTERNAL_ERROR',
      '商品を取得できませんでした。時間をおいてもう一度お試しください。',
    )
  }
}
