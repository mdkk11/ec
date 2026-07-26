import { SessionControls } from '@/features/auth/SessionControls'

import { Logo } from './Logo'

const navigation = [
  { href: '/products', label: '商品一覧' },
  { href: '/#edit', label: 'SEASONAL EDIT' },
  { href: '/#journal', label: 'POINT OF VIEW' },
] as const

export function SiteHeader() {
  return (
    <header className="relative z-40 bg-surface" id="top">
      <p className="bg-ink px-4 py-2 text-center text-[10px] font-medium tracking-[0.12em] text-white sm:text-[11px]">
        SPRING / SUMMER 2026 — SAMPLE STOREFRONT
      </p>

      <div className="page-wrap grid h-[72px] grid-cols-3 items-center border-b border-line lg:h-[88px]">
        <details className="relative justify-self-start lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-[11px] font-semibold tracking-[0.12em] [&::-webkit-details-marker]:hidden">
            メニュー
          </summary>
          <nav
            aria-label="モバイルナビゲーション"
            className="absolute left-0 top-full mt-3 w-[min(82vw,22rem)] border border-line bg-surface p-5 shadow-[0_24px_50px_rgba(0,0,0,0.08)]"
          >
            <ul className="divide-y divide-line font-serif text-3xl">
              {navigation.map((item) => (
                <li key={item.label}>
                  <a className="block py-4" href={item.href}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </details>

        <nav
          aria-label="メインナビゲーション"
          className="hidden items-center gap-7 text-[12px] font-medium tracking-[0.08em] lg:flex"
        >
          {navigation.map((item) => (
            <a className="nav-link" href={item.href} key={item.label}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="justify-self-center">
          <Logo />
        </div>

        <div className="flex items-center justify-self-end gap-3">
          <p className="hidden text-[10px] font-medium tracking-[0.1em] text-muted xl:block">
            JAPAN / JPY
          </p>
          <SessionControls />
        </div>
      </div>
    </header>
  )
}
