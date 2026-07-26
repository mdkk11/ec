import { z } from 'zod'

export const productIdSchema = z.uuid()

export const productAvailabilitySchema = z.enum([
  'in_stock',
  'out_of_stock',
])

export const productDtoSchema = z.object({
  id: productIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.number().int().nonnegative(),
  imagePath: z.string().startsWith('/images/'),
  availability: productAvailabilitySchema,
})

export const productListResponseSchema = z.object({
  items: z.array(productDtoSchema),
})

export const productResponseSchema = z.object({
  product: productDtoSchema,
})

export type ProductDto = z.infer<typeof productDtoSchema>
export type ProductListResponse = z.infer<typeof productListResponseSchema>
export type ProductResponse = z.infer<typeof productResponseSchema>
