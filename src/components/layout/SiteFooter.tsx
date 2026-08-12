import Link from 'next/link'

import { Logo } from './Logo'

export function SiteFooter() {
  return (
    <footer className="bg-[#ebe9e3]">
      <div className="page-wrap grid gap-12 py-14 sm:grid-cols-2 lg:py-20">
        <div>
          <Logo />
          <p className="mt-5 max-w-xs text-sm leading-7 text-muted">
            毎日の服と道具を、素材と使い心地から選ぶ小さなオンラインストアです。
          </p>
        </div>

        <div>
          <h2 className="label">SHOP</h2>
          <ul className="mt-5 space-y-3 text-sm text-muted">
            <li>
              <Link className="transition-colors hover:text-ink" href="/products">
                ALL ITEMS
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="page-wrap flex flex-col gap-3 border-t border-ink/15 py-5 text-[10px] tracking-[0.08em] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 MOCKSHOP. SAMPLE STOREFRONT.</p>
        <p>JAPAN / JPY</p>
      </div>
    </footer>
  )
}
