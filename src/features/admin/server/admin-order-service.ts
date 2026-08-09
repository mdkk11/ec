import {
  and,
  asc,
  desc,
  eq,
  inArray,
  sql,
} from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type {
  OrderDto,
  OrderItemDto,
  UpdateAdminOrderStatusRequest,
} from '@/contracts/order'
import { canTransitionOrderStatus } from '@/features/orders/order-status-transition'
import {
  toOrderDto,
  toOrderItemDto,
} from '@/features/orders/server/order-service'
import { Temporal } from '@/lib/date-time/temporal'
import {
  orderItems,
  orders,
  products,
} from '@/server/db/schema'

type AdminOrderDatabase = NodePgDatabase
type AdminOrderTransaction = Parameters<
  Parameters<AdminOrderDatabase['transaction']>[0]
>[0]

type AdminOrderDependencies = {
  db: AdminOrderDatabase
  now: Temporal.Instant
}

export type AdminOrderServiceErrorCode =
  | 'INVALID_STATUS_TRANSITION'
  | 'ORDER_NOT_FOUND'
  | 'VERSION_CONFLICT'

export class AdminOrderServiceError extends Error {
  readonly code: AdminOrderServiceErrorCode

  constructor(code: AdminOrderServiceErrorCode, message: string) {
    super(message)
    this.name = 'AdminOrderServiceError'
    this.code = code
  }
}

function orderNotFound(): never {
  throw new AdminOrderServiceError(
    'ORDER_NOT_FOUND',
    '注文が見つかりませんでした。',
  )
}

function versionConflict(): never {
  throw new AdminOrderServiceError(
    'VERSION_CONFLICT',
    '注文が更新されました。最新の状態を確認してください。',
  )
}

function invalidStatusTransition(): never {
  throw new AdminOrderServiceError(
    'INVALID_STATUS_TRANSITION',
    'この注文状態からは指定した状態へ変更できません。',
  )
}

async function findOrderItems(
  db: AdminOrderDatabase | AdminOrderTransaction,
  orderIds: string[],
) {
  if (orderIds.length === 0) return []
  return db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds))
    .orderBy(asc(orderItems.orderId), asc(orderItems.productId))
}

function groupOrderItems(
  items: Array<{
    orderId: string
    lineTotal: number
    productId: string
    productName: string
    quantity: number
    unitPrice: number
  }>,
) {
  const itemsByOrder = new Map<string, OrderItemDto[]>()
  for (const item of items) {
    const current = itemsByOrder.get(item.orderId) ?? []
    current.push(toOrderItemDto(item))
    itemsByOrder.set(item.orderId, current)
  }
  return itemsByOrder
}

export async function listAdminOrders({ db }: Pick<AdminOrderDependencies, 'db'>) {
  const records = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt), desc(orders.id))

  if (records.length === 0) return []

  const items = await findOrderItems(
    db,
    records.map(({ id }) => id),
  )
  const itemsByOrder = groupOrderItems(items)
  return records.map((order) =>
    toOrderDto(order, itemsByOrder.get(order.id) ?? []),
  )
}

async function loadOrderItems(
  tx: AdminOrderTransaction,
  orderId: string,
) {
  return tx
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.productId))
}

export async function updateAdminOrderStatus(
  orderId: string,
  input: UpdateAdminOrderStatusRequest,
  { db, now }: AdminOrderDependencies,
): Promise<OrderDto> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for('update')

    if (!current) orderNotFound()
    if (current.version !== input.expectedVersion) versionConflict()
    if (!canTransitionOrderStatus(current.status, input.status)) {
      invalidStatusTransition()
    }

    const nowIso = now.toString()
    const [updated] = await tx
      .update(orders)
      .set({
        cancelledAt: input.status === 'cancelled' ? nowIso : current.cancelledAt,
        status: input.status,
        updatedAt: nowIso,
        version: sql`${orders.version} + 1`,
      })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.status, current.status),
          eq(orders.version, input.expectedVersion),
        ),
      )
      .returning()

    if (!updated) {
      const [latest] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .for('update')

      if (!latest) orderNotFound()
      if (latest.version !== input.expectedVersion) versionConflict()
      if (!canTransitionOrderStatus(latest.status, input.status)) {
        invalidStatusTransition()
      }
      throw new Error('注文状態を更新できませんでした。')
    }

    const items = await loadOrderItems(tx, orderId)

    if (input.status === 'cancelled' && items.length > 0) {
      const productIds = items.map(({ productId }) => productId)
      const lockedProducts = await tx
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.id, productIds))
        .orderBy(asc(products.id))
        .for('update')

      if (lockedProducts.length !== productIds.length) {
        throw new Error('取消対象の商品を取得できませんでした。')
      }

      for (const item of items) {
        const restored = await tx
          .update(products)
          .set({
            stock: sql`${products.stock} + ${item.quantity}`,
            updatedAt: nowIso,
            version: sql`${products.version} + 1`,
          })
          .where(eq(products.id, item.productId))
          .returning({ id: products.id })
        if (restored.length === 0) {
          throw new Error('在庫を復元できませんでした。')
        }
      }
    }

    return toOrderDto(updated, items.map(toOrderItemDto))
  })
}
