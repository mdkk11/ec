export type EditorialItem = {
  number: string
  title: string
  caption: string
  image: string
}

export type PreviewProduct = {
  id: string
  brand: string
  name: string
  price: string
  image: string
  alt: string
  color: string
  colorValue: string
}

export const editorialItems: EditorialItem[] = [
  {
    number: '01',
    title: 'Soft tailoring',
    caption: '輪郭は残して、着心地は軽く。',
    image: '/images/home/soft-tailoring.jpg',
  },
  {
    number: '02',
    title: 'Everyday objects',
    caption: '使うほどに馴染む、日々の道具。',
    image: '/images/home/everyday-objects.jpg',
  },
  {
    number: '03',
    title: 'New neutrals',
    caption: '素材で選ぶ、今季のニュートラル。',
    image: '/images/home/new-neutrals.jpg',
  },
]

export const previewProducts: PreviewProduct[] = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    brand: 'ATELIER NOMA',
    name: 'リネンブレンド オーバーシャツ',
    price: '¥28,600',
    image: '/images/home/linen-overshirt.jpg',
    alt: '生成り色のリネンブレンド オーバーシャツ',
    color: 'Natural',
    colorValue: '#e9e5db',
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    brand: 'STUDIO KERN',
    name: 'ソフトレザー デイバッグ',
    price: '¥39,600',
    image: '/images/home/leather-day-bag.jpg',
    alt: '黒のソフトレザー デイバッグ',
    color: 'Black',
    colorValue: '#171714',
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    brand: 'FORM / 01',
    name: 'スエード コートスニーカー',
    price: '¥22,000',
    image: '/images/home/suede-sneakers.jpg',
    alt: 'テラコッタ色のスエード コートスニーカー',
    color: 'Clay',
    colorValue: '#b5472f',
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    brand: 'MOCKSHOP OBJECTS',
    name: 'ドライタッチ コットンTシャツ',
    price: '¥12,100',
    image: '/images/home/cotton-tshirt.jpg',
    alt: '白のドライタッチ コットンTシャツ',
    color: 'Chalk',
    colorValue: '#e9e5db',
  },
  {
    id: '30000000-0000-4000-8000-000000000006',
    brand: 'ATELIER NOMA',
    name: 'コットンツイル ワイドトラウザー',
    price: '¥24,200',
    image: '/images/home/cotton-twill-trousers.jpg',
    alt: 'トープ色のコットンツイル ワイドトラウザー',
    color: 'Taupe',
    colorValue: '#8d8173',
  },
  {
    id: '30000000-0000-4000-8000-000000000007',
    brand: 'STUDIO KERN',
    name: 'ファインウール リブカーディガン',
    price: '¥31,900',
    image: '/images/home/rib-cardigan.jpg',
    alt: 'グレージュのファインウール リブカーディガン',
    color: 'Greige',
    colorValue: '#aaa195',
  },
  {
    id: '30000000-0000-4000-8000-000000000008',
    brand: 'FORM / 01',
    name: 'ウォッシュドキャンバス トート',
    price: '¥16,500',
    image: '/images/home/canvas-tote.jpg',
    alt: '生成り色のウォッシュドキャンバス トート',
    color: 'Ecru',
    colorValue: '#d8d0bf',
  },
  {
    id: '30000000-0000-4000-8000-000000000009',
    brand: 'MOCKSHOP OBJECTS',
    name: 'ストーンウェア マグ',
    price: '¥4,950',
    image: '/images/home/stoneware-mug.jpg',
    alt: 'サンド色のストーンウェア マグ',
    color: 'Sand',
    colorValue: '#c4b7a2',
  },
]
