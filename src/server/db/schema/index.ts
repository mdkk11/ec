import { sql } from 'drizzle-orm'
import {
  check,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['customer', 'admin'])

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
    check(
      'users_email_normalized_check',
      sql`${table.email} = lower(btrim(${table.email}))`,
    ),
    check(
      'users_email_length_check',
      sql`char_length(${table.email}) between 1 and 254`,
    ),
    check(
      'users_password_hash_not_empty_check',
      sql`char_length(${table.passwordHash}) > 0`,
    ),
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
    check(
      'sessions_token_hash_format_check',
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'sessions_expiration_check',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
)

export type User = typeof users.$inferSelect
export type UserRole = (typeof userRole.enumValues)[number]
