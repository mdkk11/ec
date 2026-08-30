import { z } from 'zod'

import { categoryIdSchema, publicCategoryDtoSchema } from './category'

export const productIdSchema = z.uuid()

export const productAvailabilitySchema = z.enum(['in_stock', 'out_of_stock'])

export const productDtoSchema = z.object({
  category: publicCategoryDtoSchema,
  id: productIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.number().int().nonnegative(),
  imagePath: z.string().startsWith('/images/'),
  availability: productAvailabilitySchema,
})

export const productDetailDtoSchema = productDtoSchema.extend({
  stock: z.number().int().nonnegative(),
})

export const productListResponseSchema = z.object({
  items: z.array(productDtoSchema),
})

export const productResponseSchema = z.object({
  product: productDetailDtoSchema,
})

const productNameSchema = z.string().min(1, '商品名を入力してください。')
const productDescriptionSchema = z.string().min(1, '商品説明を入力してください。')
const productPriceSchema = z
  .number({ error: '価格は数値で入力してください。' })
  .int('価格は整数で入力してください。')
  .nonnegative('価格は0以上で入力してください。')
const productImagePathSchema = z
  .string()
  .startsWith('/images/', '画像パスは /images/ から入力してください。')
const productStockSchema = z
  .number({ error: '在庫数は数値で入力してください。' })
  .int('在庫数は整数で入力してください。')
  .nonnegative('在庫数は0以上で入力してください。')
const expectedVersionSchema = z
  .number({ error: 'versionは数値で指定してください。' })
  .int('versionは整数で指定してください。')
  .positive('versionは1以上で指定してください。')

export const adminProductDtoSchema = productDtoSchema.extend({
  categoryId: categoryIdSchema,
  isPublished: z.boolean(),
  stock: productStockSchema,
  version: expectedVersionSchema,
})

export const adminProductListResponseSchema = z.object({
  items: z.array(adminProductDtoSchema),
})

export const adminProductResponseSchema = z.object({
  product: adminProductDtoSchema,
})

export const createAdminProductRequestSchema = z.object({
  categoryId: categoryIdSchema,
  name: productNameSchema,
  description: productDescriptionSchema,
  price: productPriceSchema,
  imagePath: productImagePathSchema,
  isPublished: z.boolean(),
  stock: productStockSchema,
})

export const updateAdminProductRequestSchema = z
  .object({
    categoryId: categoryIdSchema.optional(),
    name: productNameSchema.optional(),
    description: productDescriptionSchema.optional(),
    price: productPriceSchema.optional(),
    imagePath: productImagePathSchema.optional(),
    isPublished: z.boolean().optional(),
    expectedVersion: expectedVersionSchema,
  })
  .refine(
    ({ categoryId, name, description, price, imagePath, isPublished }) =>
      categoryId !== undefined ||
      name !== undefined ||
      description !== undefined ||
      price !== undefined ||
      imagePath !== undefined ||
      isPublished !== undefined,
    { message: '更新する商品情報を1件以上指定してください。' },
  )

export const updateAdminProductStockRequestSchema = z.object({
  stock: productStockSchema,
  expectedVersion: expectedVersionSchema,
})

export type ProductDto = z.infer<typeof productDtoSchema>
export type ProductDetailDto = z.infer<typeof productDetailDtoSchema>
export type ProductListResponse = z.infer<typeof productListResponseSchema>
export type ProductResponse = z.infer<typeof productResponseSchema>
export type AdminProductDto = z.infer<typeof adminProductDtoSchema>
export type AdminProductListResponse = z.infer<typeof adminProductListResponseSchema>
export type AdminProductResponse = z.infer<typeof adminProductResponseSchema>
export type CreateAdminProductRequest = z.infer<typeof createAdminProductRequestSchema>
export type UpdateAdminProductRequest = z.infer<typeof updateAdminProductRequestSchema>
export type UpdateAdminProductStockRequest = z.infer<typeof updateAdminProductStockRequestSchema>
