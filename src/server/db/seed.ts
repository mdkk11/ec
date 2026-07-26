import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { hashPassword } from '@/server/auth/password'

import { products, users } from './schema'

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

const seedProducts = [
  {
    createdAt: '2026-03-04T00:00:00Z',
    description:
      '軽やかなリネン混素材を使い、羽織りとしても一枚でも着られるよう仕立てたオーバーシャツです。',
    id: '30000000-0000-4000-8000-000000000001',
    imagePath: '/images/home/linen-overshirt.jpg',
    isPublished: true,
    name: 'リネンブレンド オーバーシャツ',
    price: 28_600,
    stock: 8,
    updatedAt: '2026-03-04T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-03-03T00:00:00Z',
    description:
      'しなやかなレザーと控えめな金具を組み合わせた、日常使いのためのデイバッグです。',
    id: '30000000-0000-4000-8000-000000000002',
    imagePath: '/images/home/leather-day-bag.jpg',
    isPublished: true,
    name: 'ソフトレザー デイバッグ',
    price: 39_600,
    stock: 0,
    updatedAt: '2026-03-03T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-03-02T00:00:00Z',
    description:
      '落ち着いた色合いのスエードを、端正なコートシューズの輪郭にまとめたスニーカーです。',
    id: '30000000-0000-4000-8000-000000000003',
    imagePath: '/images/home/suede-sneakers.jpg',
    isPublished: true,
    name: 'スエード コートスニーカー',
    price: 22_000,
    stock: 5,
    updatedAt: '2026-03-02T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-03-01T00:00:00Z',
    description:
      'さらりとした肌触りとほどよい厚みを両立した、毎日のためのコットンTシャツです。',
    id: '30000000-0000-4000-8000-000000000004',
    imagePath: '/images/home/cotton-tshirt.jpg',
    isPublished: true,
    name: 'ドライタッチ コットンTシャツ',
    price: 12_100,
    stock: 12,
    updatedAt: '2026-03-01T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-03-05T00:00:00Z',
    description: '公開前の商品です。',
    id: '30000000-0000-4000-8000-000000000005',
    imagePath: '/images/fixtures/product-placeholder.svg',
    isPublished: false,
    name: '非公開の商品',
    price: 18_700,
    stock: 3,
    updatedAt: '2026-03-05T00:00:00Z',
    version: 1,
  },
] as const

export async function seedCatalogProducts(db: NodePgDatabase) {
  for (const product of seedProducts) {
    await db
      .insert(products)
      .values(product)
      .onConflictDoUpdate({
        set: product,
        target: products.id,
      })
  }
}
