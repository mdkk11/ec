import Link from 'next/link'

import { SessionControls } from '@/features/auth/SessionControls'

import { Logo } from './Logo'

export function SiteHeader() {
  return (
    <header className="relative z-40 bg-surface" id="top">
      <p className="bg-ink px-4 py-2 text-center text-[10px] font-medium tracking-[0.12em] text-white sm:text-[11px]">
        SPRING / SUMMER 2026 — SAMPLE STOREFRONT
      </p>

      <div className="page-wrap grid h-[72px] grid-cols-[1fr_auto_1fr] items-center border-b border-line lg:h-[88px]">
        <nav
          aria-label="メインナビゲーション"
          className="flex justify-self-start text-[10px] font-semibold tracking-[0.04em] sm:text-[11px] sm:tracking-[0.08em]"
        >
          <Link className="nav-link inline-flex min-h-11 items-center" href="/products">
            ALL ITEMS
          </Link>
        </nav>

        <div className="justify-self-center">
          <Logo />
        </div>

        <div className="flex min-w-0 items-center justify-self-end gap-3">
          <p className="hidden text-[10px] font-medium tracking-[0.1em] text-muted xl:block">
            JAPAN / JPY
          </p>
          <SessionControls />
        </div>
      </div>
    </header>
  )
}
