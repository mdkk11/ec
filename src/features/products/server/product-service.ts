import { and, asc, desc, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type { ProductDto } from '@/contracts/product'
import { products } from '@/server/db/schema'

type ProductDependencies = {
  db: NodePgDatabase
}

const publicProductSelection = {
  description: products.description,
  id: products.id,
  imagePath: products.imagePath,
  name: products.name,
  price: products.price,
  stock: products.stock,
}

function toProductDto(product: {
  description: string
  id: string
  imagePath: string
  name: string
  price: number
  stock: number
}): ProductDto {
  return {
    availability: product.stock > 0 ? 'in_stock' : 'out_of_stock',
    description: product.description,
    id: product.id,
    imagePath: product.imagePath,
    name: product.name,
    price: product.price,
  }
}

export async function listPublishedProducts({ db }: ProductDependencies) {
  const records = await db
    .select(publicProductSelection)
    .from(products)
    .where(eq(products.isPublished, true))
    .orderBy(desc(products.createdAt), asc(products.id))

  return records.map(toProductDto)
}

export async function findPublishedProduct(
  productId: string,
  { db }: ProductDependencies,
) {
  const [record] = await db
    .select(publicProductSelection)
    .from(products)
    .where(
      and(
        eq(products.id, productId),
        eq(products.isPublished, true),
      ),
    )
    .limit(1)

  return record ? toProductDto(record) : null
}
