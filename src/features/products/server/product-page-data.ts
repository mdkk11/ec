import 'server-only'
import { productListResponseSchema, productResponseSchema } from '@/contracts/product'
import { publicCategoryCatalog } from '@/features/categories/category-catalog'
import { getRuntimeDatabase } from '@/server/db/runtime'

import { findPublishedProduct, listPublishedProducts } from './product-service'

export async function loadProductListPageData(categorySlug?: string) {
  const items = await listPublishedProducts({
    categorySlug,
    db: getRuntimeDatabase().db,
  })

  return {
    categories: publicCategoryCatalog,
    items: productListResponseSchema.parse({ items }).items,
    selectedCategory: publicCategoryCatalog.find(({ slug }) => slug === categorySlug) ?? null,
  }
}

export async function loadProductDetailPageData(productId: string) {
  const product = await findPublishedProduct(productId, {
    db: getRuntimeDatabase().db,
  })

  if (!product) return null
  return productResponseSchema.parse({ product }).product
}
