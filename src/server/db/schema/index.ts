import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['customer', 'admin'])
export const orderStatus = pgEnum('order_status', [
  'received',
  'processing',
  'shipped',
  'completed',
  'cancelled',
])

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull(),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    check('users_email_normalized_check', sql`${table.email} = lower(btrim(${table.email}))`),
    check('users_email_length_check', sql`char_length(${table.email}) between 1 and 254`),
    check('users_password_hash_not_empty_check', sql`char_length(${table.passwordHash}) > 0`),
  ],
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { mode: 'string', withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    check('sessions_token_hash_format_check', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check('sessions_expiration_check', sql`${table.expiresAt} > ${table.createdAt}`),
  ],
)

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    displayOrder: integer('display_order').notNull(),
  },
  (table) => [
    uniqueIndex('categories_name_unique').on(table.name),
    uniqueIndex('categories_slug_unique').on(table.slug),
    uniqueIndex('categories_display_order_unique').on(table.displayOrder),
    check('categories_slug_format_check', sql`${table.slug} ~ '^[a-z]+(-[a-z]+)*$'`),
    check('categories_display_order_positive_check', sql`${table.displayOrder} >= 1`),
  ],
)

export const products = pgTable(
  'products',
  {
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    price: integer('price').notNull(),
    imagePath: text('image_path').notNull(),
    isPublished: boolean('is_published').notNull(),
    stock: integer('stock').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('products_category_id_idx').on(table.categoryId),
    check('products_price_non_negative_check', sql`${table.price} >= 0`),
    check('products_stock_non_negative_check', sql`${table.stock} >= 0`),
    check('products_version_positive_check', sql`${table.version} >= 1`),
  ],
)

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    discountPercent: integer('discount_percent').notNull(),
    minimumSubtotal: integer('minimum_subtotal').notNull(),
    startsAt: timestamp('starts_at', { mode: 'string', withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { mode: 'string', withTimezone: true }).notNull(),
    isActive: boolean('is_active').notNull(),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('coupons_code_unique').on(table.code),
    check('coupons_code_normalized_check', sql`${table.code} = upper(btrim(${table.code}))`),
    check('coupons_code_not_empty_check', sql`char_length(${table.code}) > 0`),
    check('coupons_discount_percent_check', sql`${table.discountPercent} between 1 and 100`),
    check('coupons_minimum_subtotal_non_negative_check', sql`${table.minimumSubtotal} >= 0`),
    check('coupons_period_check', sql`${table.startsAt} < ${table.endsAt}`),
  ],
)

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    couponId: uuid('coupon_id').references(() => coupons.id),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('carts_user_id_unique').on(table.userId),
    check('carts_version_positive_check', sql`${table.version} >= 1`),
  ],
)

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    quantity: integer('quantity').notNull(),
  },
  (table) => [
    uniqueIndex('cart_items_cart_product_unique').on(table.cartId, table.productId),
    check('cart_items_quantity_positive_check', sql`${table.quantity} >= 1`),
  ],
)

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: orderStatus('status').notNull().default('received'),
    subtotal: bigint('subtotal', { mode: 'number' }).notNull(),
    couponCode: text('coupon_code'),
    discountPercent: integer('discount_percent'),
    discountAmount: bigint('discount_amount', { mode: 'number' }).notNull(),
    total: bigint('total', { mode: 'number' }).notNull(),
    version: integer('version').notNull().default(1),
    cancelledAt: timestamp('cancelled_at', {
      mode: 'string',
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('orders_user_created_id_idx').on(table.userId, table.createdAt.desc(), table.id.desc()),
    check('orders_subtotal_non_negative_check', sql`${table.subtotal} >= 0`),
    check(
      'orders_discount_percent_check',
      sql`${table.discountPercent} is null or ${table.discountPercent} between 1 and 100`,
    ),
    check('orders_discount_amount_non_negative_check', sql`${table.discountAmount} >= 0`),
    check('orders_total_non_negative_check', sql`${table.total} >= 0`),
    check('orders_version_positive_check', sql`${table.version} >= 1`),
  ],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    unitPrice: bigint('unit_price', { mode: 'number' }).notNull(),
    quantity: integer('quantity').notNull(),
    lineTotal: bigint('line_total', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('order_items_order_product_idx').on(table.orderId, table.productId),
    check('order_items_unit_price_non_negative_check', sql`${table.unitPrice} >= 0`),
    check('order_items_quantity_positive_check', sql`${table.quantity} >= 1`),
    check('order_items_line_total_non_negative_check', sql`${table.lineTotal} >= 0`),
  ],
)

export type User = typeof users.$inferSelect
export type UserRole = (typeof userRole.enumValues)[number]
export type Product = typeof products.$inferSelect
export type Category = typeof categories.$inferSelect
export type Coupon = typeof coupons.$inferSelect
export type Cart = typeof carts.$inferSelect
export type CartItem = typeof cartItems.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type OrderStatus = (typeof orderStatus.enumValues)[number]
