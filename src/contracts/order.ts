import { z } from 'zod'

const moneySchema = z.number().int().nonnegative()

const orderStatusSchema = z.enum(['received', 'processing', 'shipped', 'completed', 'cancelled'])

const orderItemSchema = z.object({
  productId: z.uuid(),
  productName: z.string().min(1),
  unitPrice: moneySchema,
  quantity: z.number().int().min(1),
  lineTotal: moneySchema,
})

const orderSchema = z.object({
  id: z.uuid(),
  status: orderStatusSchema,
  items: z.array(orderItemSchema),
  subtotal: moneySchema,
  couponCode: z.string().min(1).nullable(),
  discountPercent: z.number().int().min(1).max(100).nullable(),
  discountAmount: moneySchema,
  total: moneySchema,
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
})

export const createOrderRequestSchema = z.object({
  checkoutToken: z.string().regex(/^[0-9a-f]{64}$/u, {
    message: '注文内容を再確認してください。',
  }),
})

export const updateAdminOrderStatusRequestSchema = z.object({
  status: orderStatusSchema,
  expectedVersion: z.number().int().min(1),
})

export const orderIdSchema = z.uuid()
export const orderResponseSchema = z.object({ order: orderSchema })
export const orderListResponseSchema = z.object({
  items: z.array(orderSchema),
})

export type OrderStatus = z.infer<typeof orderStatusSchema>
export type OrderItemDto = z.infer<typeof orderItemSchema>
export type OrderDto = z.infer<typeof orderSchema>
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>
export type UpdateAdminOrderStatusRequest = z.infer<typeof updateAdminOrderStatusRequestSchema>
