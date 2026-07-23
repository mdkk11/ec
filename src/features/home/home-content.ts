export type EditorialItem = {
  number: string
  title: string
  caption: string
  image: string
}

export type PreviewProduct = {
  id: number
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
    id: 1,
    brand: 'ATELIER NOMA',
    name: 'リネンブレンド オーバーシャツ',
    price: '¥28,600',
    image: '/images/home/linen-overshirt.jpg',
    alt: '生成り色のリネンブレンド オーバーシャツ',
    color: 'Natural',
    colorValue: '#e9e5db',
  },
  {
    id: 2,
    brand: 'STUDIO KERN',
    name: 'ソフトレザー デイバッグ',
    price: '¥39,600',
    image: '/images/home/leather-day-bag.jpg',
    alt: '黒のソフトレザー デイバッグ',
    color: 'Black',
    colorValue: '#171714',
  },
  {
    id: 3,
    brand: 'FORM / 01',
    name: 'スエード コートスニーカー',
    price: '¥22,000',
    image: '/images/home/suede-sneakers.jpg',
    alt: 'テラコッタ色のスエード コートスニーカー',
    color: 'Clay',
    colorValue: '#b5472f',
  },
  {
    id: 4,
    brand: 'MOCKSHOP OBJECTS',
    name: 'ドライタッチ コットンTシャツ',
    price: '¥12,100',
    image: '/images/home/cotton-tshirt.jpg',
    alt: '白のドライタッチ コットンTシャツ',
    color: 'Chalk',
    colorValue: '#e9e5db',
  },
]
