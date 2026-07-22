import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'MockShop',
    template: '%s | MockShop',
  },
  description: 'テスト境界と失敗原因を追跡しやすくする、小規模ECサンドボックス。',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <a
          className="fixed left-4 top-4 z-50 -translate-y-24 bg-ink px-4 py-3 text-sm font-semibold text-white transition-transform focus:translate-y-0"
          href="#main-content"
        >
          メインコンテンツへ移動
        </a>
        <div className="grid min-h-screen grid-rows-[auto_1fr_auto]">
          <SiteHeader />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  )
}
