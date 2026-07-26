import { Logo } from './Logo'

const footerGroups = [
  {
    title: 'SHOP',
    items: [
      { href: '/products', label: '商品一覧' },
      { href: '/#edit', label: '季節の編集' },
      { href: '/#journal', label: 'MockShopについて' },
    ],
  },
  {
    title: 'HELP',
    items: [
      { label: '配送と返品' },
      { label: 'お問い合わせ' },
      { label: 'サイズガイド' },
      { label: 'よくある質問' },
    ],
  },
  {
    title: 'FOLLOW',
    items: [{ label: 'Instagram' }, { label: 'Pinterest' }, { label: 'Journal' }],
  },
] as const

export function SiteFooter() {
  return (
    <footer className="bg-[#ebe9e3]">
      <div className="page-wrap grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:py-20">
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo />
          <p className="mt-5 max-w-xs text-sm leading-7 text-muted">
            日常に長く残る服と道具を、静かな編集で。
          </p>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title}>
            <h2 className="label">{group.title}</h2>
            <ul className="mt-5 space-y-3 text-sm text-muted">
              {group.items.map((item) => (
                <li key={item.label}>
                  {'href' in item ? (
                    <a className="transition-colors hover:text-ink" href={item.href}>
                      {item.label}
                    </a>
                  ) : (
                    item.label
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="page-wrap flex flex-col gap-3 border-t border-ink/15 py-5 text-[10px] tracking-[0.08em] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 MOCKSHOP. SAMPLE STOREFRONT.</p>
        <p>JAPAN / JPY</p>
      </div>
    </footer>
  )
}
