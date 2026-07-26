import { and, asc, eq, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type {
  AddCartItemRequest,
  UpdateCartItemRequest,
} from '@/contracts/cart'
import { cartItems, carts, products } from '@/server/db/schema'

import { calculateCart } from '../cart-calculation'

type CartDatabase = NodePgDatabase
type CartTransaction = Parameters<
  Parameters<CartDatabase['transaction']>[0]
>[0]
type CartExecutor = CartDatabase | CartTransaction

export type CartServiceErrorCode =
  | 'CART_ITEM_NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'QUANTITY_EXCEEDS_STOCK'

export class CartServiceError extends Error {
  readonly code: CartServiceErrorCode

  constructor(code: CartServiceErrorCode, message: string) {
    super(message)
    this.name = 'CartServiceError'
    this.code = code
  }
}

type CartDependencies = {
  db: CartDatabase
  now: string
  userId: string
}

async function ensureAndLockCart(
  tx: CartTransaction,
  userId: string,
  now: string,
) {
  await tx
    .insert(carts)
    .values({ createdAt: now, updatedAt: now, userId })
    .onConflictDoNothing({ target: carts.userId })

  const [cart] = await tx
    .select({ id: carts.id, version: carts.version })
    .from(carts)
    .where(eq(carts.userId, userId))
    .for('update')

  if (!cart) throw new Error('カートを作成できませんでした。')
  return cart
}

async function loadCart(
  executor: CartExecutor,
  cart: { id: string; version: number },
) {
  const rows = await executor
    .select({
      id: cartItems.id,
      isPublished: products.isPublished,
      name: products.name,
      productId: products.id,
      quantity: cartItems.quantity,
      stock: products.stock,
      unitPrice: products.price,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(asc(products.id))

  return calculateCart({ ...cart, items: rows })
}

async function incrementCartVersion(
  tx: CartTransaction,
  cartId: string,
  now: string,
) {
  const [updated] = await tx
    .update(carts)
    .set({
      updatedAt: now,
      version: sql`${carts.version} + 1`,
    })
    .where(eq(carts.id, cartId))
    .returning({ id: carts.id, version: carts.version })

  if (!updated) throw new Error('カートversionを更新できませんでした。')
  return updated
}

export async function getCart({
  db,
  now,
  userId,
}: CartDependencies) {
  return db.transaction(async (tx) => {
    const cart = await ensureAndLockCart(tx, userId, now)
    return loadCart(tx, cart)
  })
}

export async function addCartItem(
  input: AddCartItemRequest,
  { db, now, userId }: CartDependencies,
) {
  return db.transaction(async (tx) => {
    const cart = await ensureAndLockCart(tx, userId, now)
    const [product] = await tx
      .select({
        id: products.id,
        isPublished: products.isPublished,
        stock: products.stock,
      })
      .from(products)
      .where(eq(products.id, input.productId))
      .for('update')

    if (!product?.isPublished) {
      throw new CartServiceError(
        'PRODUCT_NOT_FOUND',
        '商品が見つかりませんでした。',
      )
    }

    const [existingItem] = await tx
      .select({
        id: cartItems.id,
        quantity: cartItems.quantity,
      })
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.productId, product.id),
        ),
      )
      .limit(1)

    const nextQuantity = (existingItem?.quantity ?? 0) + input.quantity
    if (nextQuantity > product.stock) {
      throw new CartServiceError(
        'QUANTITY_EXCEEDS_STOCK',
        '注文可能な数量を超えています。',
      )
    }

    if (existingItem) {
      await tx
        .update(cartItems)
        .set({ quantity: nextQuantity })
        .where(eq(cartItems.id, existingItem.id))
    } else {
      await tx.insert(cartItems).values({
        cartId: cart.id,
        productId: product.id,
        quantity: nextQuantity,
      })
    }

    const updatedCart = await incrementCartVersion(tx, cart.id, now)
    return loadCart(tx, updatedCart)
  })
}

export async function updateCartItem(
  itemId: string,
  input: UpdateCartItemRequest,
  { db, now, userId }: CartDependencies,
) {
  return db.transaction(async (tx) => {
    const cart = await ensureAndLockCart(tx, userId, now)
    const [item] = await tx
      .select({
        id: cartItems.id,
        isPublished: products.isPublished,
        quantity: cartItems.quantity,
        stock: products.stock,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
      .for('update')

    if (!item) {
      throw new CartServiceError(
        'CART_ITEM_NOT_FOUND',
        'カート明細が見つかりませんでした。',
      )
    }
    if (!item.isPublished) {
      throw new CartServiceError(
        'PRODUCT_NOT_FOUND',
        '商品が見つかりませんでした。',
      )
    }
    if (input.quantity > item.stock) {
      throw new CartServiceError(
        'QUANTITY_EXCEEDS_STOCK',
        '注文可能な数量を超えています。',
      )
    }
    if (input.quantity === item.quantity) return loadCart(tx, cart)

    await tx
      .update(cartItems)
      .set({ quantity: input.quantity })
      .where(eq(cartItems.id, item.id))
    const updatedCart = await incrementCartVersion(tx, cart.id, now)
    return loadCart(tx, updatedCart)
  })
}

export async function deleteCartItem(
  itemId: string,
  { db, now, userId }: CartDependencies,
) {
  return db.transaction(async (tx) => {
    const cart = await ensureAndLockCart(tx, userId, now)
    const deleted = await tx
      .delete(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
      .returning({ id: cartItems.id })

    if (deleted.length === 0) {
      throw new CartServiceError(
        'CART_ITEM_NOT_FOUND',
        'カート明細が見つかりませんでした。',
      )
    }

    const updatedCart = await incrementCartVersion(tx, cart.id, now)
    return loadCart(tx, updatedCart)
  })
}
