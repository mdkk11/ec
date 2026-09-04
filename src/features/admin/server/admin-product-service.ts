import { and, asc, desc, eq, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type {
  AdminProductDto,
  CreateAdminProductRequest,
  UpdateAdminProductRequest,
  UpdateAdminProductStockRequest,
} from '@/contracts/product'
import { categoryCatalog } from '@/features/categories/category-catalog'
import type { Temporal } from '@/lib/date-time/temporal'
import { categories, products } from '@/server/db/schema'

type AdminProductDependencies = {
  db: NodePgDatabase
  now: Temporal.Instant
}

const adminProductSelection = {
  categoryId: products.categoryId,
  description: products.description,
  id: products.id,
  imagePath: products.imagePath,
  isPublished: products.isPublished,
  name: products.name,
  price: products.price,
  stock: products.stock,
  version: products.version,
}

type AdminProductRecord = {
  categoryId: string
  description: string
  id: string
  imagePath: string
  isPublished: boolean
  name: string
  price: number
  stock: number
  version: number
}

function toAdminProductDto(product: AdminProductRecord): AdminProductDto {
  const category = categoryCatalog.find(({ id }) => id === product.categoryId)
  if (!category) throw new Error('商品カテゴリを解決できませんでした。')

  return {
    availability: product.stock > 0 ? 'in_stock' : 'out_of_stock',
    category: { name: category.name, slug: category.slug },
    ...product,
  }
}

export class AdminProductServiceError extends Error {
  constructor(
    readonly code: 'INVALID_CATEGORY' | 'PRODUCT_NOT_FOUND' | 'VERSION_CONFLICT',
    message: string,
  ) {
    super(message)
    this.name = 'AdminProductServiceError'
  }
}

async function assertCategoryExists(categoryId: string, db: NodePgDatabase) {
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1)

  if (!category) {
    throw new AdminProductServiceError(
      'INVALID_CATEGORY',
      '選択したカテゴリが見つかりませんでした。',
    )
  }
}

export async function listAdminProducts({
  db,
}: AdminProductDependencies): Promise<AdminProductDto[]> {
  const records = await db
    .select(adminProductSelection)
    .from(products)
    .orderBy(desc(products.createdAt), asc(products.id))

  return records.map(toAdminProductDto)
}

export async function createAdminProduct(
  input: CreateAdminProductRequest,
  { db, now }: AdminProductDependencies,
): Promise<AdminProductDto> {
  await assertCategoryExists(input.categoryId, db)
  const timestamp = now.toString()
  const [record] = await db
    .insert(products)
    .values({
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    })
    .returning(adminProductSelection)

  if (!record) throw new Error('作成した商品を取得できませんでした。')
  return toAdminProductDto(record)
}

async function throwUpdateFailure(productId: string, db: NodePgDatabase): Promise<never> {
  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  if (!existing) {
    throw new AdminProductServiceError('PRODUCT_NOT_FOUND', '商品が見つかりませんでした。')
  }
  throw new AdminProductServiceError(
    'VERSION_CONFLICT',
    '商品が別の操作で更新されました。最新の内容を確認してください。',
  )
}

export async function updateAdminProduct(
  productId: string,
  input: UpdateAdminProductRequest,
  { db, now }: AdminProductDependencies,
): Promise<AdminProductDto> {
  const { expectedVersion, ...changes } = input
  if (changes.categoryId) await assertCategoryExists(changes.categoryId, db)
  const [record] = await db
    .update(products)
    .set({
      ...changes,
      updatedAt: now.toString(),
      version: sql`${products.version} + 1`,
    })
    .where(and(eq(products.id, productId), eq(products.version, expectedVersion)))
    .returning(adminProductSelection)

  if (!record) return throwUpdateFailure(productId, db)
  return toAdminProductDto(record)
}

export async function updateAdminProductStock(
  productId: string,
  input: UpdateAdminProductStockRequest,
  { db, now }: AdminProductDependencies,
): Promise<AdminProductDto> {
  const [record] = await db
    .update(products)
    .set({
      stock: input.stock,
      updatedAt: now.toString(),
      version: sql`${products.version} + 1`,
    })
    .where(and(eq(products.id, productId), eq(products.version, input.expectedVersion)))
    .returning(adminProductSelection)

  if (!record) return throwUpdateFailure(productId, db)
  return toAdminProductDto(record)
}
