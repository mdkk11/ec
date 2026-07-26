import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { loadInitialSessionState } from '@/features/auth/server/session-page-data'

import { AppProviders } from './providers'
import '@fontsource-variable/inter'
import '@fontsource-variable/noto-sans-jp'
import '@fontsource-variable/cormorant-garamond'
import '@fontsource-variable/noto-serif-jp'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'MockShop',
    template: '%s | MockShop',
  },
  applicationName: 'MockShop',
  description: '日常に長く残る服と道具を、静かな編集で届けるオンラインストア。',
}

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const initialSessionState = await loadInitialSessionState()

  return (
    <html lang="ja">
      <body>
        <a
          className="fixed left-4 top-4 z-50 -translate-y-24 bg-ink px-4 py-3 text-sm font-semibold text-white transition-transform focus:translate-y-0"
          href="#main-content"
        >
          メインコンテンツへ移動
        </a>
        <AppProviders initialSessionState={initialSessionState}>
          <div className="grid min-h-screen grid-rows-[auto_1fr_auto]">
            <SiteHeader />
            <main id="main-content" tabIndex={-1}>
              {children}
            </main>
            <SiteFooter />
          </div>
        </AppProviders>
      </body>
    </html>
  )
}
