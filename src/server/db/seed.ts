import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import {
  categoryCatalog,
  categoryIds,
  type CategoryId,
} from '@/features/categories/category-catalog'
import { hashPassword } from '@/server/auth/password'

import { categories, coupons, orderItems, orders, products, users } from './schema'

export const seedCredentials = {
  admin: {
    email: 'admin@example.test',
    password: 'AdminPass123!',
  },
  adminChromium: {
    email: 'admin-chromium@example.test',
    password: 'AdminChrome123!',
  },
  adminFirefox: {
    email: 'admin-firefox@example.test',
    password: 'AdminFirefox123!',
  },
  adminWebkit: {
    email: 'admin-webkit@example.test',
    password: 'AdminWebkit123!',
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
    description: 'しなやかなレザーと控えめな金具を組み合わせた、日常使いのためのデイバッグです。',
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
    description: 'さらりとした肌触りとほどよい厚みを両立した、毎日のためのコットンTシャツです。',
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
    createdAt: '2026-02-28T00:00:00Z',
    description:
      '高密度のコットンツイルを、腰まわりにゆとりのあるワイドシルエットへ仕立てました。季節を問わず着回せる一本です。',
    id: '30000000-0000-4000-8000-000000000006',
    imagePath: '/images/home/cotton-twill-trousers.jpg',
    isPublished: true,
    name: 'コットンツイル ワイドトラウザー',
    price: 24_200,
    stock: 6,
    updatedAt: '2026-02-28T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-27T00:00:00Z',
    description:
      '細番手のウールで編んだ、軽くなめらかなリブカーディガンです。羽織りにもインナーにも収まりやすい厚みに整えました。',
    id: '30000000-0000-4000-8000-000000000007',
    imagePath: '/images/home/rib-cardigan.jpg',
    isPublished: true,
    name: 'ファインウール リブカーディガン',
    price: 31_900,
    stock: 4,
    updatedAt: '2026-02-27T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-26T00:00:00Z',
    description:
      '使い込んだような風合いのキャンバスを、肩掛けしやすい長さのハンドルと組み合わせました。日々の荷物を気兼ねなく運べます。',
    id: '30000000-0000-4000-8000-000000000008',
    imagePath: '/images/home/canvas-tote.jpg',
    isPublished: true,
    name: 'ウォッシュドキャンバス トート',
    price: 16_500,
    stock: 10,
    updatedAt: '2026-02-26T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-25T00:00:00Z',
    description:
      '釉薬の揺らぎを残したストーンウェアのマグです。手になじむ丸みと、普段使いにちょうどよい容量を備えています。',
    id: '30000000-0000-4000-8000-000000000009',
    imagePath: '/images/home/stoneware-mug.jpg',
    isPublished: true,
    name: 'ストーンウェア マグ',
    price: 4_950,
    stock: 12,
    updatedAt: '2026-02-25T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-24T00:00:00Z',
    description:
      '目の詰まったウールを使い、着丈をすっきり整えたブルゾンです。やわらかな暖かさと端正な輪郭を両立しました。',
    id: '30000000-0000-4000-8000-000000000010',
    imagePath: '/images/home/wool-blouson.jpg',
    isPublished: true,
    name: 'コンパクトウール ブルゾン',
    price: 42_900,
    stock: 3,
    updatedAt: '2026-02-24T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-23T00:00:00Z',
    description:
      'シルクの光沢にコットンの扱いやすさを加えた薄手のスカーフです。首元やバッグに穏やかな色を添えます。',
    id: '30000000-0000-4000-8000-000000000011',
    imagePath: '/images/home/silk-cotton-scarf.jpg',
    isPublished: true,
    name: 'シルクコットン スカーフ',
    price: 13_200,
    stock: 8,
    updatedAt: '2026-02-23T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-22T00:00:00Z',
    description:
      '細く柔らかなメリノウールを、ほどよくゆとりのあるクルーネックに編み立てました。素肌にも重ね着にも心地よい一枚です。',
    id: '30000000-0000-4000-8000-000000000012',
    imagePath: '/images/home/merino-crewneck.jpg',
    isPublished: true,
    name: 'メリノウール クルーネックニット',
    price: 29_700,
    stock: 5,
    updatedAt: '2026-02-22T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-21T00:00:00Z',
    description:
      '細かなプリーツが歩くたびに揺れる、ウール混素材のスカートです。落ち着いた表情で日常の装いになじみます。',
    id: '30000000-0000-4000-8000-000000000013',
    imagePath: '/images/home/pleated-skirt.jpg',
    isPublished: true,
    name: 'ウールブレンド プリーツスカート',
    price: 26_400,
    stock: 7,
    updatedAt: '2026-02-21T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-20T00:00:00Z',
    description:
      'なめらかなコットンポプリンを使ったバンドカラーシャツです。襟元を軽く見せ、羽織りとしても使える形にしました。',
    id: '30000000-0000-4000-8000-000000000014',
    imagePath: '/images/home/band-collar-shirt.jpg',
    isPublished: true,
    name: 'コットンポプリン バンドカラーシャツ',
    price: 19_800,
    stock: 6,
    updatedAt: '2026-02-20T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-19T00:00:00Z',
    description:
      '軽量なリサイクルナイロンを使い、必要なものを小さく持ち歩けるショルダーバッグにしました。長さを調整できるストラップ付きです。',
    id: '30000000-0000-4000-8000-000000000015',
    imagePath: '/images/home/nylon-shoulder-bag.jpg',
    isPublished: true,
    name: 'リサイクルナイロン ショルダーバッグ',
    price: 18_700,
    stock: 9,
    updatedAt: '2026-02-19T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-18T00:00:00Z',
    description:
      '細かなシボのあるレザーを薄く仕立てたカードケースです。必要なカードをすっきり分けられる構成にしています。',
    id: '30000000-0000-4000-8000-000000000016',
    imagePath: '/images/home/leather-card-case.jpg',
    isPublished: true,
    name: 'グレインレザー カードケース',
    price: 9_900,
    stock: 15,
    updatedAt: '2026-02-18T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-17T00:00:00Z',
    description:
      '丈夫なキャンバスと柔らかなラバーソールを合わせたデッキシューズです。飾りを抑えた形で幅広い服装に合います。',
    id: '30000000-0000-4000-8000-000000000017',
    imagePath: '/images/home/canvas-deck-shoes.jpg',
    isPublished: true,
    name: 'キャンバス デッキシューズ',
    price: 17_600,
    stock: 4,
    updatedAt: '2026-02-17T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-16T00:00:00Z',
    description:
      '厚みのあるウールフェルトを一体成形したルームシューズです。足を包みながら、室内で軽く歩ける形に整えました。',
    id: '30000000-0000-4000-8000-000000000018',
    imagePath: '/images/home/felt-room-shoes.jpg',
    isPublished: true,
    name: 'ウールフェルト ルームシューズ',
    price: 8_800,
    stock: 0,
    updatedAt: '2026-02-16T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-15T00:00:00Z',
    description:
      '無垢の真鍮を浅い輪郭に曲げたデスクトレイです。鍵や文具など、散らばりやすい小物の定位置になります。',
    id: '30000000-0000-4000-8000-000000000019',
    imagePath: '/images/home/brass-desk-tray.jpg',
    isPublished: true,
    name: 'ブラス デスクトレイ',
    price: 7_700,
    stock: 11,
    updatedAt: '2026-02-15T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-14T00:00:00Z',
    description:
      '再生ガラスのわずかな揺らぎを生かした、口元の細いカラフェです。食卓やベッドサイドで水を注ぐ所作になじみます。',
    id: '30000000-0000-4000-8000-000000000020',
    imagePath: '/images/home/glass-carafe.jpg',
    isPublished: true,
    name: 'リサイクルガラス カラフェ',
    price: 6_600,
    stock: 8,
    updatedAt: '2026-02-14T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-13T00:00:00Z',
    description:
      '洗いをかけたリネンの自然な皺を楽しめるクッションカバーです。落ち着いた色合いで部屋の素材感を整えます。',
    id: '30000000-0000-4000-8000-000000000021',
    imagePath: '/images/home/linen-cushion-cover.jpg',
    isPublished: true,
    name: 'ウォッシュドリネン クッションカバー',
    price: 11_000,
    stock: 7,
    updatedAt: '2026-02-13T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-12T00:00:00Z',
    description:
      '手触りのよいオーク材を細身に削り出したシューホーンです。玄関で場所を取らず、毎日の靴履きを助けます。',
    id: '30000000-0000-4000-8000-000000000022',
    imagePath: '/images/home/oak-shoehorn.jpg',
    isPublished: true,
    name: 'オークウッド シューホーン',
    price: 5_500,
    stock: 10,
    updatedAt: '2026-02-12T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-11T00:00:00Z',
    description:
      '料理の色を穏やかに引き立てる、余白を広く取ったストーンウェアのプレートです。普段の主菜に使いやすい大きさです。',
    id: '30000000-0000-4000-8000-000000000023',
    imagePath: '/images/home/stoneware-dinner-plate.jpg',
    isPublished: true,
    name: 'ストーンウェア ディナープレート',
    price: 4_400,
    stock: 12,
    updatedAt: '2026-02-11T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-10T00:00:00Z',
    description:
      'コットンの軽さにウールのぬくもりを加えたスローケットです。ソファやベッドに置きやすい控えめな配色にしました。',
    id: '30000000-0000-4000-8000-000000000024',
    imagePath: '/images/home/cotton-wool-throw.jpg',
    isPublished: true,
    name: 'コットンウール スローケット',
    price: 14_300,
    stock: 5,
    updatedAt: '2026-02-10T00:00:00Z',
    version: 1,
  },
  {
    createdAt: '2026-02-09T00:00:00Z',
    description:
      '香りの穏やかなシダー材で作ったハンガーの3本セットです。肩の線を支えながら、クローゼットを整えます。',
    id: '30000000-0000-4000-8000-000000000025',
    imagePath: '/images/home/cedar-hangers.jpg',
    isPublished: true,
    name: 'シダーウッド ハンガーセット',
    price: 12_100,
    stock: 6,
    updatedAt: '2026-02-09T00:00:00Z',
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

const seedProductCategoryIds: Record<(typeof seedProducts)[number]['id'], CategoryId> = {
  '30000000-0000-4000-8000-000000000001': categoryIds.clothing,
  '30000000-0000-4000-8000-000000000002': categoryIds['bags-accessories'],
  '30000000-0000-4000-8000-000000000003': categoryIds.shoes,
  '30000000-0000-4000-8000-000000000004': categoryIds.clothing,
  '30000000-0000-4000-8000-000000000005': categoryIds.other,
  '30000000-0000-4000-8000-000000000006': categoryIds.clothing,
  '30000000-0000-4000-8000-000000000007': categoryIds.clothing,
  '30000000-0000-4000-8000-000000000008': categoryIds['bags-accessories'],
  '30000000-0000-4000-8000-000000000009': categoryIds['home-living'],
  '30000000-0000-4000-8000-000000000010': categoryIds.clothing,
  '30000000-0000-4000-8000-000000000011': categoryIds['bags-accessories'],
  '30000000-0000-4000-8000-000000000012': categoryIds.clothing,
  '30000000-0000-4000-8000-000000000013': categoryIds.clothing,
  '30000000-0000-4000-8000-000000000014': categoryIds.clothing,
  '30000000-0000-4000-8000-000000000015': categoryIds['bags-accessories'],
  '30000000-0000-4000-8000-000000000016': categoryIds['bags-accessories'],
  '30000000-0000-4000-8000-000000000017': categoryIds.shoes,
  '30000000-0000-4000-8000-000000000018': categoryIds.shoes,
  '30000000-0000-4000-8000-000000000019': categoryIds['home-living'],
  '30000000-0000-4000-8000-000000000020': categoryIds['home-living'],
  '30000000-0000-4000-8000-000000000021': categoryIds['home-living'],
  '30000000-0000-4000-8000-000000000022': categoryIds['home-living'],
  '30000000-0000-4000-8000-000000000023': categoryIds['home-living'],
  '30000000-0000-4000-8000-000000000024': categoryIds['home-living'],
  '30000000-0000-4000-8000-000000000025': categoryIds['home-living'],
}

export async function seedCategories(db: NodePgDatabase) {
  for (const category of categoryCatalog) {
    await db
      .insert(categories)
      .values(category)
      .onConflictDoUpdate({ set: category, target: categories.id })
  }
}

export async function seedCatalogProducts(db: NodePgDatabase) {
  await seedCategories(db)
  for (const product of seedProducts) {
    const value = { ...product, categoryId: seedProductCategoryIds[product.id] }
    await db.insert(products).values(value).onConflictDoUpdate({
      set: value,
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
    await db.insert(coupons).values(coupon).onConflictDoUpdate({
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

export const e2eAdminFixtures = {
  chromium: {
    email: seedCredentials.adminChromium.email,
    password: seedCredentials.adminChromium.password,
    productName: 'Chromium 管理作成商品',
  },
  firefox: {
    email: seedCredentials.adminFirefox.email,
    password: seedCredentials.adminFirefox.password,
    productName: 'Firefox 管理作成商品',
  },
  webkit: {
    email: seedCredentials.adminWebkit.email,
    password: seedCredentials.adminWebkit.password,
    productName: 'WebKit 管理作成商品',
  },
} as const

export const e2eAdminOrderFixtures = {
  chromium: {
    customerId: '10000000-0000-4000-8000-000000000010',
    orderId: '72000000-0000-4000-8000-000000000010',
    productId: '32000000-0000-4000-8000-000000000010',
  },
  firefox: {
    customerId: '10000000-0000-4000-8000-000000000011',
    orderId: '72000000-0000-4000-8000-000000000011',
    productId: '32000000-0000-4000-8000-000000000011',
  },
  webkit: {
    customerId: '10000000-0000-4000-8000-000000000012',
    orderId: '72000000-0000-4000-8000-000000000012',
    productId: '32000000-0000-4000-8000-000000000012',
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

  const adminUsers = [
    {
      credentials: seedCredentials.adminChromium,
      id: '20000000-0000-4000-8000-000000000010',
      salt: 'mockshop-adm-chr',
    },
    {
      credentials: seedCredentials.adminFirefox,
      id: '20000000-0000-4000-8000-000000000011',
      salt: 'mockshop-adm-ffx',
    },
    {
      credentials: seedCredentials.adminWebkit,
      id: '20000000-0000-4000-8000-000000000012',
      salt: 'mockshop-adm-wkt',
    },
  ] as const
  for (const fixture of adminUsers) {
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
        role: 'admin',
      })
      .onConflictDoUpdate({
        set: {
          email: fixture.credentials.email,
          passwordHash: fixturePasswordHash,
          role: 'admin',
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
      categoryId: categoryIds['bags-accessories'],
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
    await db.insert(products).values(product).onConflictDoUpdate({
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
    await db.insert(coupons).values(coupon).onConflictDoUpdate({
      set: coupon,
      target: coupons.id,
    })
  }

  for (const [browser, fixture] of Object.entries(e2eAdminOrderFixtures)) {
    const product = {
      categoryId: categoryIds.other,
      createdAt: '2026-02-03T00:00:00Z',
      description: '注文管理E2E専用の固定商品です。',
      id: fixture.productId,
      imagePath: '/images/fixtures/product-placeholder.svg',
      isPublished: false,
      name: `${browser} 注文管理確認商品`,
      price: 20_000,
      stock: 5,
      updatedAt: '2026-02-03T00:00:00Z',
      version: 1,
    } as const
    await db.insert(products).values(product)
    await db.insert(orders).values({
      createdAt: '2026-02-04T00:00:00Z',
      discountAmount: 0,
      id: fixture.orderId,
      status: 'received',
      subtotal: product.price,
      total: product.price,
      updatedAt: '2026-02-04T00:00:00Z',
      userId: fixture.customerId,
      version: 1,
    })
    await db.insert(orderItems).values({
      lineTotal: product.price,
      orderId: fixture.orderId,
      productId: fixture.productId,
      productName: product.name,
      quantity: 1,
      unitPrice: product.price,
    })
  }
}
