import 'server-only'

import {
  productListResponseSchema,
  productResponseSchema,
} from '@/contracts/product'
import { getRuntimeDatabase } from '@/server/db/runtime'

import {
  findPublishedProduct,
  listPublishedProducts,
} from './product-service'

export async function loadProductListPageData() {
  const items = await listPublishedProducts({
    db: getRuntimeDatabase().db,
  })

  return productListResponseSchema.parse({ items }).items
}

export async function loadProductDetailPageData(productId: string) {
  const product = await findPublishedProduct(productId, {
    db: getRuntimeDatabase().db,
  })

  if (!product) return null
  return productResponseSchema.parse({ product }).product
}
