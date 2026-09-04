import { and, asc, desc, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type { ProductDetailDto, ProductDto } from '@/contracts/product'
import { categories, products } from '@/server/db/schema'

type ProductDependencies = {
  db: NodePgDatabase
}

const publicProductSelection = {
  categoryName: categories.name,
  categorySlug: categories.slug,
  description: products.description,
  id: products.id,
  imagePath: products.imagePath,
  name: products.name,
  price: products.price,
  stock: products.stock,
}

type PublicProductRecord = {
  categoryName: string
  categorySlug: string
  description: string
  id: string
  imagePath: string
  name: string
  price: number
  stock: number
}

function toProductDto(product: PublicProductRecord): ProductDto {
  return {
    availability: product.stock > 0 ? 'in_stock' : 'out_of_stock',
    category: {
      name: product.categoryName,
      slug: product.categorySlug,
    },
    description: product.description,
    id: product.id,
    imagePath: product.imagePath,
    name: product.name,
    price: product.price,
  }
}

function toProductDetailDto(product: PublicProductRecord): ProductDetailDto {
  return { ...toProductDto(product), stock: product.stock }
}

export class ProductServiceError extends Error {
  readonly code = 'CATEGORY_NOT_FOUND'

  constructor() {
    super('カテゴリが見つかりませんでした。')
    this.name = 'ProductServiceError'
  }
}

export async function listPublishedProducts({
  categorySlug,
  db,
}: ProductDependencies & { categorySlug?: string }) {
  let categoryId: string | undefined
  if (categorySlug) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, categorySlug))
      .limit(1)
    if (!category) throw new ProductServiceError()
    categoryId = category.id
  }

  const records = await db
    .select(publicProductSelection)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(
      categoryId
        ? and(eq(products.isPublished, true), eq(products.categoryId, categoryId))
        : eq(products.isPublished, true),
    )
    .orderBy(desc(products.createdAt), asc(products.id))

  return records.map(toProductDto)
}

export async function findPublishedProduct(productId: string, { db }: ProductDependencies) {
  const [record] = await db
    .select(publicProductSelection)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.id, productId), eq(products.isPublished, true)))
    .limit(1)

  return record ? toProductDetailDto(record) : null
}
