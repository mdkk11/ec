import { z } from 'zod'

export const categoryIdSchema = z.uuid('カテゴリを選択してください。')

export const categorySlugSchema = z
  .string()
  .regex(/^[a-z]+(?:-[a-z]+)*$/u, 'カテゴリslugの形式を確認してください。')

export const categoryDtoSchema = z.object({
  displayOrder: z.number().int().positive(),
  id: categoryIdSchema,
  name: z.string().min(1),
  slug: categorySlugSchema,
})

export const publicCategoryDtoSchema = categoryDtoSchema.pick({
  name: true,
  slug: true,
})

export const productCategoryQuerySchema = z.object({
  category: categorySlugSchema.optional(),
})

export type CategoryDto = z.infer<typeof categoryDtoSchema>
export type PublicCategoryDto = z.infer<typeof publicCategoryDtoSchema>
export type ProductCategoryQuery = z.infer<typeof productCategoryQuerySchema>
