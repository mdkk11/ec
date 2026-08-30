import { z } from 'zod'

const moneySchema = z.number().int().nonnegative()
const positiveQuantitySchema = z
  .number()
  .int('数量は整数で入力してください。')
  .min(1, '数量は1以上で入力してください。')

export const cartItemAvailabilitySchema = z.enum(['available', 'out_of_stock', 'unpublished'])

export const cartItemSchema = z.object({
  availableStock: z.number().int().nonnegative(),
  imagePath: z.string().startsWith('/images/'),
  id: z.uuid(),
  productId: z.uuid(),
  name: z.string().min(1),
  unitPrice: moneySchema,
  quantity: positiveQuantitySchema,
  lineTotal: moneySchema,
  availability: cartItemAvailabilitySchema,
})

export const appliedCouponSchema = z.object({
  code: z.string().min(1),
  discountPercent: z.number().int().min(1).max(100),
  minimumSubtotal: moneySchema,
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
})

export const checkoutIssueSchema = z.object({
  code: z.enum([
    'PRODUCT_UNAVAILABLE',
    'STOCK_CONFLICT',
    'COUPON_INACTIVE',
    'COUPON_NOT_STARTED',
    'COUPON_EXPIRED',
    'COUPON_MINIMUM_NOT_MET',
  ]),
  itemId: z.uuid().optional(),
})

export const cartSchema = z.object({
  id: z.uuid(),
  version: z.number().int().min(1),
  items: z.array(cartItemSchema),
  coupon: appliedCouponSchema.nullable(),
  subtotal: moneySchema,
  discountAmount: moneySchema,
  total: moneySchema,
  issues: z.array(checkoutIssueSchema),
  checkoutToken: z
    .string()
    .regex(/^[0-9a-f]{64}$/u)
    .nullable(),
})

export const cartResponseSchema = z.object({ cart: cartSchema })

export const addCartItemRequestSchema = z.object({
  productId: z.uuid('商品IDの形式が正しくありません。'),
  quantity: positiveQuantitySchema,
})

export const updateCartItemRequestSchema = z.object({
  quantity: positiveQuantitySchema,
})

export const applyCouponRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'クーポンコードを入力してください。')
    .transform((code) => code.toUpperCase()),
})

export const cartItemIdSchema = z.uuid()

export type CartDto = z.infer<typeof cartSchema>
export type CartItemDto = z.infer<typeof cartItemSchema>
export type AppliedCouponDto = z.infer<typeof appliedCouponSchema>
export type CheckoutIssueDto = z.infer<typeof checkoutIssueSchema>
export type AddCartItemRequest = z.infer<typeof addCartItemRequestSchema>
export type UpdateCartItemRequest = z.infer<typeof updateCartItemRequestSchema>
export type ApplyCouponRequest = z.input<typeof applyCouponRequestSchema>
export type NormalizedApplyCouponRequest = z.output<typeof applyCouponRequestSchema>
