import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

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
          <header className="border-b border-line bg-surface">
            <p className="bg-ink px-4 py-2 text-center text-[11px] font-semibold tracking-[0.12em] text-white">
              MOCKSHOP TEST SANDBOX
            </p>
            <div className="page-wrap flex h-18 items-center justify-center sm:h-20 lg:h-22">
              <Link
                aria-label="MockShop トップへ"
                className="text-lg font-bold tracking-[0.28em] sm:text-xl"
                href="/"
              >
                MockShop
              </Link>
            </div>
          </header>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <footer className="border-t border-line bg-surface">
            <div className="page-wrap flex flex-col gap-2 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
              <p>© 2026 MOCKSHOP</p>
              <p>TEST BOUNDARIES / DETERMINISTIC FIXTURES</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
