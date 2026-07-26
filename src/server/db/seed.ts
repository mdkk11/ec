import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { hashPassword } from '@/server/auth/password'

import { users } from './schema'

export const seedCredentials = {
  admin: {
    email: 'admin@example.test',
    password: 'AdminPass123!',
  },
  customer: {
    email: 'customer@example.test',
    password: 'CustomerPass123!',
  },
} as const

const seedUsers = [
  {
    createdAt: '2026-01-01T00:00:00Z',
    email: seedCredentials.customer.email,
    id: '10000000-0000-4000-8000-000000000001',
    password: seedCredentials.customer.password,
    role: 'customer' as const,
    salt: 'mockshop-cust-v1',
  },
  {
    createdAt: '2026-01-01T00:00:00Z',
    email: seedCredentials.admin.email,
    id: '20000000-0000-4000-8000-000000000001',
    password: seedCredentials.admin.password,
    role: 'admin' as const,
    salt: 'mockshop-admin-v',
  },
] as const

function fixedSalt(value: string) {
  const salt = Buffer.from(value, 'utf8')
  if (salt.byteLength !== 16) {
    throw new Error('seed用scrypt saltは16 bytesで固定してください。')
  }
  return salt
}

export async function seedAuthenticationUsers(db: NodePgDatabase) {
  for (const user of seedUsers) {
    const passwordHash = await hashPassword(user.password, fixedSalt(user.salt))

    await db
      .insert(users)
      .values({
        createdAt: user.createdAt,
        email: user.email,
        id: user.id,
        passwordHash,
        role: user.role,
      })
      .onConflictDoUpdate({
        set: {
          email: user.email,
          passwordHash,
          role: user.role,
        },
        target: users.id,
      })
  }
}
