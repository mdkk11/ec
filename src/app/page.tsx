import type { Metadata } from 'next'

import { HomePage } from '@/features/home/HomePage'

const title = 'Made for quieter days.'
const description = '軽やかな素材と落ち着いた色を、春から夏の日常へ。'

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
