import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  sql,
} from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type {
  CreateOrderRequest,
  OrderDto,
  OrderItemDto,
} from '@/contracts/order'
import {
  calculateCart,
  createCheckoutToken,
  type CartCouponRecord,
  type CartRecord,
} from '@/features/cart/cart-calculation'
import { Temporal } from '@/lib/date-time/temporal'
import {
  cartItems,
  carts,
  coupons,
  orderItems,
  orders,
  products,
} from '@/server/db/schema'

type OrderDatabase = NodePgDatabase
type OrderTransaction = Parameters<
  Parameters<OrderDatabase['transaction']>[0]
>[0]

type OrderDependencies = {
  db: OrderDatabase
  now: Temporal.Instant
  userId: string
}

export type OrderServiceErrorCode =
  | 'CHECKOUT_CHANGED'
  | 'EMPTY_CART'
  | 'STOCK_CONFLICT'

export class OrderServiceError extends Error {
  readonly code: OrderServiceErrorCode

  constructor(code: OrderServiceErrorCode, message: string) {
    super(message)
    this.name = 'OrderServiceError'
    this.code = code
  }
}

function checkoutChanged(): never {
  throw new OrderServiceError(
    'CHECKOUT_CHANGED',
    '注文内容が変更されました。最新の内容を確認してください。',
  )
}

function emptyCart(): never {
  throw new OrderServiceError(
    'EMPTY_CART',
    'カートに商品がありません。',
  )
}

function stockConflict(): never {
  throw new OrderServiceError(
    'STOCK_CONFLICT',
    '在庫が変更されました。最新のカートを確認してください。',
  )
}

function normalizeCoupon(
  coupon: {
    code: string
    discountPercent: number
    endsAt: string
    isActive: boolean
    minimumSubtotal: number
    startsAt: string
  } | undefined,
): CartCouponRecord | null {
  if (!coupon) return null
  return {
    ...coupon,
    endsAt: Temporal.Instant.from(coupon.endsAt).toString(),
    startsAt: Temporal.Instant.from(coupon.startsAt).toString(),
  }
}

export function toOrderItemDto(item: {
  lineTotal: number
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}): OrderItemDto {
  return {
    lineTotal: item.lineTotal,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }
}

export function toOrderDto(
  order: {
    couponCode: string | null
    createdAt: string
    discountAmount: number
    discountPercent: number | null
    id: string
    status:
      | 'received'
      | 'processing'
      | 'shipped'
      | 'completed'
      | 'cancelled'
    subtotal: number
    total: number
    version: number
  },
  items: OrderItemDto[],
): OrderDto {
  return {
    couponCode: order.couponCode,
    createdAt: Temporal.Instant.from(order.createdAt).toString(),
    discountAmount: order.discountAmount,
    discountPercent: order.discountPercent,
    id: order.id,
    items,
    status: order.status,
    subtotal: order.subtotal,
    total: order.total,
    version: order.version,
  }
}

async function lockCheckoutState(
  tx: OrderTransaction,
  userId: string,
): Promise<{
  cart: { couponId: string | null; id: string; version: number }
  record: CartRecord
}> {
  const [cart] = await tx
    .select({
      couponId: carts.couponId,
      id: carts.id,
      version: carts.version,
    })
    .from(carts)
    .where(eq(carts.userId, userId))
    .for('update')

  if (!cart) emptyCart()

  const itemRows = await tx
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(asc(cartItems.productId))

  if (itemRows.length === 0) emptyCart()

  const productRows = await tx
    .select({
      id: products.id,
      isPublished: products.isPublished,
      name: products.name,
      price: products.price,
      stock: products.stock,
    })
    .from(products)
    .where(
      inArray(
        products.id,
        itemRows.map(({ productId }) => productId),
      ),
    )
    .orderBy(asc(products.id))
    .for('update')

  if (productRows.length !== itemRows.length) {
    throw new Error('カート商品の取得結果が一致しませんでした。')
  }

  const [coupon] = cart.couponId
    ? await tx
        .select({
          code: coupons.code,
          discountPercent: coupons.discountPercent,
          endsAt: coupons.endsAt,
          isActive: coupons.isActive,
          minimumSubtotal: coupons.minimumSubtotal,
          startsAt: coupons.startsAt,
        })
        .from(coupons)
        .where(eq(coupons.id, cart.couponId))
        .for('share')
    : []

  if (cart.couponId && !coupon) {
    throw new Error('適用中のクーポンを取得できませんでした。')
  }

  const itemByProductId = new Map(
    itemRows.map((item) => [item.productId, item]),
  )
  const items = productRows.map((product) => {
    const item = itemByProductId.get(product.id)
    if (!item) throw new Error('カート明細を取得できませんでした。')
    return {
      id: item.id,
      isPublished: product.isPublished,
      name: product.name,
      productId: product.id,
      quantity: item.quantity,
      stock: product.stock,
      unitPrice: product.price,
    }
  })

  return {
    cart,
    record: {
      coupon: normalizeCoupon(coupon),
      id: cart.id,
      items,
      version: cart.version,
    },
  }
}

export async function createOrder(
  input: CreateOrderRequest,
  { db, now, userId }: OrderDependencies,
) {
  return db.transaction(async (tx) => {
    const { cart, record } = await lockCheckoutState(tx, userId)
    const calculated = calculateCart(record, now)

    if (
      calculated.issues.some(
        ({ code }) =>
          code === 'PRODUCT_UNAVAILABLE' || code.startsWith('COUPON_'),
      )
    ) {
      checkoutChanged()
    }

    const currentToken = createCheckoutToken({
      coupon: record.coupon,
      discountAmount: calculated.discountAmount,
      items: record.items,
      subtotal: calculated.subtotal,
      total: calculated.total,
      version: record.version,
    })
    if (currentToken !== input.checkoutToken) checkoutChanged()

    if (
      calculated.issues.some(({ code }) => code === 'STOCK_CONFLICT')
    ) {
      stockConflict()
    }

    const nowIso = now.toString()
    for (const item of calculated.items) {
      const updated = await tx
        .update(products)
        .set({
          stock: sql`${products.stock} - ${item.quantity}`,
          updatedAt: nowIso,
          version: sql`${products.version} + 1`,
        })
        .where(
          and(
            eq(products.id, item.productId),
            gte(products.stock, item.quantity),
          ),
        )
        .returning({ id: products.id })

      if (updated.length === 0) stockConflict()
    }

    const [created] = await tx
      .insert(orders)
      .values({
        couponCode: calculated.coupon?.code ?? null,
        createdAt: nowIso,
        discountAmount: calculated.discountAmount,
        discountPercent: calculated.coupon?.discountPercent ?? null,
        status: 'received',
        subtotal: calculated.subtotal,
        total: calculated.total,
        updatedAt: nowIso,
        userId,
        version: 1,
      })
      .returning()

    if (!created) throw new Error('注文を保存できませんでした。')

    const snapshots = calculated.items.map((item) => ({
      lineTotal: item.lineTotal,
      orderId: created.id,
      productId: item.productId,
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }))
    await tx.insert(orderItems).values(snapshots)

    await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id))
    const cleared = await tx
      .update(carts)
      .set({
        couponId: null,
        updatedAt: nowIso,
        version: sql`${carts.version} + 1`,
      })
      .where(eq(carts.id, cart.id))
      .returning({ id: carts.id })
    if (cleared.length === 0) {
      throw new Error('注文後のカートを更新できませんでした。')
    }

    return toOrderDto(
      created,
      snapshots.map(toOrderItemDto),
    )
  })
}

export async function listOrders({
  db,
  userId,
}: Pick<OrderDependencies, 'db' | 'userId'>) {
  const records = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt), desc(orders.id))

  if (records.length === 0) return []

  const items = await db
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        records.map(({ id }) => id),
      ),
    )
    .orderBy(asc(orderItems.orderId), asc(orderItems.productId))

  const itemsByOrder = new Map<string, OrderItemDto[]>()
  for (const item of items) {
    const current = itemsByOrder.get(item.orderId) ?? []
    current.push(toOrderItemDto(item))
    itemsByOrder.set(item.orderId, current)
  }

  return records.map((order) =>
    toOrderDto(order, itemsByOrder.get(order.id) ?? []),
  )
}

export async function findOrder(
  orderId: string,
  { db, userId }: Pick<OrderDependencies, 'db' | 'userId'>,
) {
  const [record] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1)

  if (!record) return null

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, record.id))
    .orderBy(asc(orderItems.productId))

  return toOrderDto(record, items.map(toOrderItemDto))
}
