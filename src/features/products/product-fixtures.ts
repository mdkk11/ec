import type { ProductDto } from '@/contracts/product'

export const productFixture: ProductDto = {
  availability: 'in_stock',
  description:
    '軽やかなリネン混素材を使い、羽織りとしても一枚でも着られるよう仕立てたオーバーシャツです。',
  id: '30000000-0000-4000-8000-000000000001',
  imagePath: '/images/home/linen-overshirt.jpg',
  name: 'リネンブレンド オーバーシャツ',
  price: 28_600,
}

export const outOfStockProductFixture: ProductDto = {
  availability: 'out_of_stock',
  description:
    'しなやかなレザーと控えめな金具を組み合わせた、日常使いのためのデイバッグです。',
  id: '30000000-0000-4000-8000-000000000002',
  imagePath: '/images/home/leather-day-bag.jpg',
  name: 'ソフトレザー デイバッグ',
  price: 39_600,
}

export const longProductFixture: ProductDto = {
  availability: 'in_stock',
  description:
    '季節の変わり目から盛夏まで長く着られるよう、通気性と肌離れのよさを両立した素材を選びました。ゆとりのある輪郭を保ちながら、袖口や裾の細かな仕様を整えることで、日常のさまざまな場面に自然になじむ一着へ仕上げています。',
  id: '30000000-0000-4000-8000-000000000003',
  imagePath: '/images/home/cotton-tshirt.jpg',
  name: '長い商品名でも読みやすさを保つドライタッチコットン オーバーサイズロングスリーブTシャツ',
  price: 18_700,
}

export const productListFixture = [
  productFixture,
  outOfStockProductFixture,
  {
    availability: 'in_stock',
    description: '落ち着いた色合いのスエードスニーカーです。',
    id: '30000000-0000-4000-8000-000000000004',
    imagePath: '/images/home/suede-sneakers.jpg',
    name: 'スエード コートスニーカー',
    price: 22_000,
  },
  {
    availability: 'in_stock',
    description: '毎日のためのコットンTシャツです。',
    id: '30000000-0000-4000-8000-000000000005',
    imagePath: '/images/home/cotton-tshirt.jpg',
    name: 'ドライタッチ コットンTシャツ',
    price: 12_100,
  },
] satisfies ProductDto[]
