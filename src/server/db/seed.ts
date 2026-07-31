import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { hashPassword } from '@/server/auth/password'

import { coupons, products, users } from './schema'

export const seedCredentials = {
  admin: {
    email: 'admin@example.test',
    password: 'AdminPass123!',
  },
  customer: {
    email: 'customer@example.test',
    password: 'CustomerPass123!',
  },
  purchaseChromium: {
    email: 'purchase-chromium@example.test',
    password: 'PurchaseChrome123!',
  },
  purchaseFirefox: {
    email: 'purchase-firefox@example.test',
    password: 'PurchaseFirefox123!',
  },
  purchaseMobile: {
    email: 'purchase-mobile@example.test',
    password: 'PurchaseMobile123!',
  },
  purchaseStockConflict: {
    email: 'purchase-conflict@example.test',
    password: 'PurchaseConflict123!',
  },
  purchaseWebkit: {
    email: 'purchase-webkit@example.test',
    password: 'PurchaseWebkit123!',
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

export const seedCouponCodes = {
  expired: 'EXPIRED10',
  future: 'FUTURE10',
  inactive: 'INACTIVE10',
  minimum: 'MINIMUM20',
  welcome: 'WELCOME15',
} as const

const seedCoupons = [
  {
    code: seedCouponCodes.welcome,
    createdAt: '2026-01-01T00:00:00Z',
    discountPercent: 15,
    endsAt: '2099-01-01T00:00:00Z',
    id: '60000000-0000-4000-8000-000000000001',
    isActive: true,
    minimumSubtotal: 10_000,
    startsAt: '2020-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    code: seedCouponCodes.inactive,
    createdAt: '2026-01-01T00:00:00Z',
    discountPercent: 10,
    endsAt: '2099-01-01T00:00:00Z',
    id: '60000000-0000-4000-8000-000000000002',
    isActive: false,
    minimumSubtotal: 0,
    startsAt: '2020-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    code: seedCouponCodes.future,
    createdAt: '2026-01-01T00:00:00Z',
    discountPercent: 10,
    endsAt: '2100-01-01T00:00:00Z',
    id: '60000000-0000-4000-8000-000000000003',
    isActive: true,
    minimumSubtotal: 0,
    startsAt: '2099-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    code: seedCouponCodes.expired,
    createdAt: '2026-01-01T00:00:00Z',
    discountPercent: 10,
    endsAt: '2021-01-01T00:00:00Z',
    id: '60000000-0000-4000-8000-000000000004',
    isActive: true,
    minimumSubtotal: 0,
    startsAt: '2020-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    code: seedCouponCodes.minimum,
    createdAt: '2026-01-01T00:00:00Z',
    discountPercent: 20,
    endsAt: '2099-01-01T00:00:00Z',
    id: '60000000-0000-4000-8000-000000000005',
    isActive: true,
    minimumSubtotal: 100_000,
    startsAt: '2020-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
] as const

export async function seedCouponFixtures(db: NodePgDatabase) {
  for (const coupon of seedCoupons) {
    await db
      .insert(coupons)
      .values(coupon)
      .onConflictDoUpdate({
        set: coupon,
        target: coupons.id,
      })
  }
}

export const e2ePurchaseFixtures = {
  chromium: {
    couponCode: 'BUYCHR15',
    email: seedCredentials.purchaseChromium.email,
    password: seedCredentials.purchaseChromium.password,
    productId: '31000000-0000-4000-8000-000000000010',
  },
  firefox: {
    couponCode: 'BUYFFX15',
    email: seedCredentials.purchaseFirefox.email,
    password: seedCredentials.purchaseFirefox.password,
    productId: '31000000-0000-4000-8000-000000000011',
  },
  mobile: {
    email: seedCredentials.purchaseMobile.email,
    password: seedCredentials.purchaseMobile.password,
    productId: '31000000-0000-4000-8000-000000000013',
  },
  stockConflict: {
    email: seedCredentials.purchaseStockConflict.email,
    password: seedCredentials.purchaseStockConflict.password,
    productId: '31000000-0000-4000-8000-000000000014',
  },
  webkit: {
    couponCode: 'BUYWKT15',
    email: seedCredentials.purchaseWebkit.email,
    password: seedCredentials.purchaseWebkit.password,
    productId: '31000000-0000-4000-8000-000000000012',
  },
} as const

export async function seedE2EFixtures(db: NodePgDatabase) {
  await seedAuthenticationUsers(db)
  await seedCatalogProducts(db)
  await seedCouponFixtures(db)

  const purchaseUsers = [
    {
      credentials: seedCredentials.purchaseChromium,
      id: '10000000-0000-4000-8000-000000000010',
      salt: 'mockshop-buy-chr',
    },
    {
      credentials: seedCredentials.purchaseFirefox,
      id: '10000000-0000-4000-8000-000000000011',
      salt: 'mockshop-buy-ffx',
    },
    {
      credentials: seedCredentials.purchaseWebkit,
      id: '10000000-0000-4000-8000-000000000012',
      salt: 'mockshop-buy-wkt',
    },
    {
      credentials: seedCredentials.purchaseMobile,
      id: '10000000-0000-4000-8000-000000000013',
      salt: 'mockshop-buy-mob',
    },
    {
      credentials: seedCredentials.purchaseStockConflict,
      id: '10000000-0000-4000-8000-000000000014',
      salt: 'mockshop-buy-cnf',
    },
  ] as const
  for (const fixture of purchaseUsers) {
    const fixturePasswordHash = await hashPassword(
      fixture.credentials.password,
      fixedSalt(fixture.salt),
    )
    await db
      .insert(users)
      .values({
        createdAt: '2026-01-01T00:00:00Z',
        email: fixture.credentials.email,
        id: fixture.id,
        passwordHash: fixturePasswordHash,
        role: 'customer',
      })
      .onConflictDoUpdate({
        set: {
          email: fixture.credentials.email,
          passwordHash: fixturePasswordHash,
          role: 'customer',
        },
        target: users.id,
      })
  }

  const purchaseProducts = [
    {
      id: e2ePurchaseFixtures.chromium.productId,
      name: 'Chromium 購入確認用バッグ',
    },
    {
      id: e2ePurchaseFixtures.firefox.productId,
      name: 'Firefox 購入確認用バッグ',
    },
    {
      id: e2ePurchaseFixtures.webkit.productId,
      name: 'WebKit 購入確認用バッグ',
    },
    {
      id: e2ePurchaseFixtures.mobile.productId,
      name: 'モバイル購入確認用バッグ',
    },
    {
      id: e2ePurchaseFixtures.stockConflict.productId,
      name: '在庫競合確認用バッグ',
    },
  ] as const
  for (const fixture of purchaseProducts) {
    const product = {
      createdAt: '2026-02-02T00:00:00Z',
      description: '購入E2E専用の固定商品です。',
      id: fixture.id,
      imagePath: '/images/fixtures/product-placeholder.svg',
      isPublished: true,
      name: fixture.name,
      price: 20_000,
      stock: 5,
      updatedAt: '2026-02-02T00:00:00Z',
      version: 1,
    } as const
    await db
      .insert(products)
      .values(product)
      .onConflictDoUpdate({
        set: product,
        target: products.id,
      })
  }

  const purchaseCoupons = [
    {
      code: e2ePurchaseFixtures.chromium.couponCode,
      id: '61000000-0000-4000-8000-000000000010',
    },
    {
      code: e2ePurchaseFixtures.firefox.couponCode,
      id: '61000000-0000-4000-8000-000000000011',
    },
    {
      code: e2ePurchaseFixtures.webkit.couponCode,
      id: '61000000-0000-4000-8000-000000000012',
    },
  ] as const
  for (const fixture of purchaseCoupons) {
    const coupon = {
      code: fixture.code,
      createdAt: '2026-01-01T00:00:00Z',
      discountPercent: 15,
      endsAt: '2099-01-01T00:00:00Z',
      id: fixture.id,
      isActive: true,
      minimumSubtotal: 10_000,
      startsAt: '2020-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as const
    await db
      .insert(coupons)
      .values(coupon)
      .onConflictDoUpdate({
        set: coupon,
        target: coupons.id,
      })
  }
}
