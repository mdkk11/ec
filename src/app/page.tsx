import type { Metadata } from 'next'

import { HomePage } from '@/features/home/HomePage'

const title = 'Made for quieter days.'
const description = '季節の輪郭を、軽やかに。新しい日々のための静かな色と、心地よい素材。'

export const metadata: Metadata = {
  title: {
    absolute: `${title} | MockShop`,
  },
  description,
  openGraph: {
    title: `MockShop — ${title}`,
    description,
    locale: 'ja_JP',
    siteName: 'MockShop',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: `MockShop — ${title}`,
    description,
  },
}

export default function Page() {
  return <HomePage />
}
