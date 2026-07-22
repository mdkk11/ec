import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react'

type Product = {
  id: number
  brand: string
  name: string
  price: string
  image: string
  alt: string
  color: string
}

const products: Product[] = [
  {
    id: 1,
    brand: 'ATELIER NOMA',
    name: 'リネンブレンド オーバーシャツ',
    price: '¥28,600',
    image:
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1200&q=85',
    alt: '生成り色のリネンブレンド オーバーシャツ',
    color: 'Natural',
  },
  {
    id: 2,
    brand: 'STUDIO KERN',
    name: 'ソフトレザー デイバッグ',
    price: '¥39,600',
    image:
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85',
    alt: '黒のソフトレザー デイバッグ',
    color: 'Black',
  },
  {
    id: 3,
    brand: 'FORM / 01',
    name: 'スエード コートスニーカー',
    price: '¥22,000',
    image:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85',
    alt: 'テラコッタ色のスエード コートスニーカー',
    color: 'Clay',
  },
  {
    id: 4,
    brand: 'MOCKSHOP OBJECTS',
    name: 'ドライタッチ コットンTシャツ',
    price: '¥12,100',
    image:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=85',
    alt: '白のドライタッチ コットンTシャツ',
    color: 'Chalk',
  },
]

const categories = [
  {
    number: '01',
    title: 'Soft tailoring',
    caption: '輪郭は残して、着心地は軽く。',
    image:
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=85',
  },
  {
    number: '02',
    title: 'Everyday objects',
    caption: '使うほどに馴染む、日々の道具。',
    image:
      'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1200&q=85',
  },
  {
    number: '03',
    title: 'New neutrals',
    caption: '素材で選ぶ、今季のニュートラル。',
    image:
      'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=85',
  },
]

function Logo() {
  return (
    <a
      href="#top"
      className="text-[1.15rem] font-bold tracking-[0.32em] text-ink sm:text-[1.4rem]"
      aria-label="MockShop トップへ"
    >
      MockShop
    </a>
  )
}

function IconButton({
  label,
  children,
  onClick,
  count,
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
  count?: number
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative grid size-10 place-items-center transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {children}
      {!!count && (
        <span className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-accent text-[9px] font-semibold text-white">
          {count}
        </span>
      )}
    </button>
  )
}

function Header({ cartCount }: { cartCount: number }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <header className="relative z-40 bg-surface" id="top">
      <div className="bg-ink px-4 py-2 text-center text-[10px] font-medium tracking-[0.12em] text-white sm:text-[11px]">
        30,000円以上のご注文で送料無料
      </div>

      <div className="page-wrap grid h-[72px] grid-cols-3 items-center border-b border-line lg:h-[88px]">
        <div className="flex items-center gap-1 lg:hidden">
          <IconButton label="メニューを開く" onClick={() => setMenuOpen(true)}>
            <Menu size={21} strokeWidth={1.5} />
          </IconButton>
        </div>

        <nav className="hidden items-center gap-7 text-[12px] font-medium tracking-[0.08em] lg:flex" aria-label="メインナビゲーション">
          <a className="nav-link" href="#new">NEW IN</a>
          <a className="nav-link" href="#edit">WOMEN</a>
          <a className="nav-link" href="#edit">MEN</a>
          <a className="nav-link" href="#journal">LIVING</a>
        </nav>

        <div className="justify-self-center">
          <Logo />
        </div>

        <div className="flex items-center justify-self-end">
          <div className="hidden xl:flex items-center border-b border-ink/50 mr-4 py-2 w-48">
            <Search size={17} strokeWidth={1.5} className="mr-2" />
            <button
              className="w-full text-left text-xs text-muted"
              onClick={() => setSearchOpen(true)}
              type="button"
            >
              アイテムを検索
            </button>
          </div>
          <IconButton label="検索を開く" onClick={() => setSearchOpen(true)}>
            <Search size={20} strokeWidth={1.5} />
          </IconButton>
          <span className="hidden sm:block">
            <IconButton label="アカウント">
              <UserRound size={20} strokeWidth={1.5} />
            </IconButton>
          </span>
          <span className="hidden sm:block">
            <IconButton label="お気に入り">
              <Heart size={20} strokeWidth={1.5} />
            </IconButton>
          </span>
          <IconButton label={`カート、${cartCount}点`} count={cartCount}>
            <ShoppingBag size={20} strokeWidth={1.5} />
          </IconButton>
        </div>
      </div>

      {searchOpen && (
        <div className="absolute inset-x-0 top-full border-b border-line bg-surface shadow-[0_24px_50px_rgba(0,0,0,0.08)]">
          <div className="page-wrap py-7 sm:py-10">
            <div className="mx-auto flex max-w-2xl items-center border-b border-ink pb-3">
              <Search size={21} strokeWidth={1.5} className="mr-3 shrink-0" />
              <input
                autoFocus
                className="w-full bg-transparent text-lg outline-none placeholder:text-muted/70"
                placeholder="ブランド、アイテム、カテゴリを検索"
                aria-label="商品を検索"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="grid size-10 shrink-0 place-items-center"
                aria-label="検索を閉じる"
              >
                <X size={21} strokeWidth={1.5} />
              </button>
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-xs text-muted">
              人気の検索: リネン、レザーバッグ、ニュートラル
            </p>
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-surface px-5 py-5 lg:hidden">
          <div className="flex items-center justify-between">
            <Logo />
            <IconButton label="メニューを閉じる" onClick={() => setMenuOpen(false)}>
              <X size={22} strokeWidth={1.5} />
            </IconButton>
          </div>
          <nav className="mt-20 flex flex-col" aria-label="モバイルナビゲーション">
            {['NEW IN', 'WOMEN', 'MEN', 'LIVING', 'JOURNAL'].map((item) => (
              <a
                key={item}
                href={item === 'NEW IN' ? '#new' : '#edit'}
                onClick={() => setMenuOpen(false)}
                className="border-b border-line py-5 font-serif text-4xl"
              >
                {item}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}

function ProductCard({
  product,
  onAdd,
}: {
  product: Product
  onAdd: (product: Product) => void
}) {
  const [favorite, setFavorite] = useState(false)

  return (
    <article className="group min-w-0">
      <div className="relative aspect-[3/4] overflow-hidden bg-[#ebeae6]">
        <img
          src={product.image}
          alt={product.alt}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transition-none"
        />
        <button
          type="button"
          aria-label={favorite ? `${product.name}をお気に入りから削除` : `${product.name}をお気に入りに追加`}
          aria-pressed={favorite}
          onClick={() => setFavorite((value) => !value)}
          className="absolute right-3 top-3 grid size-10 place-items-center bg-white/90 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <Heart size={19} strokeWidth={1.5} fill={favorite ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          onClick={() => onAdd(product)}
          className="absolute inset-x-3 bottom-3 translate-y-2 bg-ink px-4 py-3 text-xs font-semibold tracking-[0.08em] text-white opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 max-md:translate-y-0 max-md:opacity-100"
        >
          カートに追加
        </button>
      </div>
      <div className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.14em]">{product.brand}</p>
            <h3 className="mt-1.5 truncate text-sm text-muted">{product.name}</h3>
          </div>
          <span className="mt-0.5 size-2.5 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: product.id === 3 ? '#b5472f' : product.id === 2 ? '#171714' : '#e9e5db' }} aria-label={`カラー: ${product.color}`} />
        </div>
        <p className="mt-2 text-sm tabular-nums">{product.price}</p>
      </div>
    </article>
  )
}

function App() {
  const [cartCount, setCartCount] = useState(0)
  const [toast, setToast] = useState('')

  const addToCart = (product: Product) => {
    setCartCount((count) => count + 1)
    setToast(`${product.name}をカートに追加しました`)
  }

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Header cartCount={cartCount} />

      <main>
        <section className="page-wrap py-5 sm:py-8 lg:py-10" aria-labelledby="hero-title">
          <div className="grid min-h-[620px] overflow-hidden bg-sage lg:grid-cols-12 lg:min-h-[680px]">
            <div className="relative z-10 flex flex-col justify-between px-6 py-8 sm:px-10 sm:py-11 lg:col-span-5 lg:px-14 lg:py-14">
              <p className="label">SPRING / SUMMER 2026</p>
              <div className="py-16 lg:py-8">
                <h1 id="hero-title" className="max-w-[9ch] font-serif text-[clamp(3.4rem,7vw,7.4rem)] leading-[0.84] tracking-[-0.045em]">
                  Made for quieter days.
                </h1>
                <p className="mt-7 max-w-sm text-sm leading-7 sm:text-base">
                  季節の輪郭を、軽やかに。新しい日々のための静かな色と、心地よい素材。
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a className="button-primary" href="#new">
                    新着を見る <ArrowRight size={16} strokeWidth={1.5} />
                  </a>
                  <a className="button-secondary" href="#edit">コレクションを見る</a>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-medium tracking-[0.12em]">
                <span className="h-px w-9 bg-ink" />
                EDIT 01 — LIGHT LAYERS
              </div>
            </div>
            <div className="relative min-h-[420px] lg:col-span-7 lg:min-h-full">
              <img
                src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1800&q=88"
                alt="春の軽やかなレイヤードスタイル"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            </div>
          </div>
        </section>

        <section className="page-wrap section-space" id="edit" aria-labelledby="edit-heading">
          <div className="section-heading">
            <div>
              <p className="label text-muted">THE SEASONAL EDIT</p>
              <h2 id="edit-heading" className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Curated for now</h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-muted">
              色、素材、佇まいから選んだ、今の暮らしに馴染む3つの編集。
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
            {categories.map((category, index) => (
              <a
                href="#new"
                key={category.title}
                className={`group block ${index === 1 ? 'lg:translate-y-16' : ''}`}
              >
                <div className="aspect-[4/5] overflow-hidden bg-[#e5e2dc]">
                  <img
                    src={category.image}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transition-none"
                  />
                </div>
                <div className="mt-4 flex items-start justify-between border-t border-ink pt-4">
                  <div>
                    <p className="label text-muted">EDIT {category.number}</p>
                    <h3 className="mt-2 font-serif text-2xl sm:text-3xl">{category.title}</h3>
                    <p className="mt-2 text-sm text-muted">{category.caption}</p>
                  </div>
                  <ArrowRight className="mt-1 transition-transform group-hover:translate-x-1" size={19} strokeWidth={1.5} />
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="page-wrap section-space pt-24 lg:pt-36" id="new" aria-labelledby="new-heading">
          <div className="section-heading border-b border-line pb-6">
            <div>
              <p className="label text-accent">JUST ARRIVED</p>
              <h2 id="new-heading" className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">New essentials</h2>
            </div>
            <a className="group flex items-center gap-2 text-xs font-semibold tracking-[0.08em]" href="#top">
              すべて見る
              <ArrowRight size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
            </a>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={addToCart} />
            ))}
          </div>
        </section>

        <section className="section-space bg-ink text-white" id="journal" aria-labelledby="journal-heading">
          <div className="page-wrap grid gap-12 py-20 sm:py-28 lg:grid-cols-12 lg:items-center lg:py-36">
            <div className="lg:col-span-4">
              <p className="label text-white/55">OUR POINT OF VIEW</p>
              <h2 id="journal-heading" className="mt-5 max-w-[8ch] font-serif text-5xl leading-[0.95] tracking-tight sm:text-6xl">
                Better things, kept longer.
              </h2>
            </div>
            <div className="lg:col-start-7 lg:col-span-5">
              <p className="text-lg leading-9 text-white/75 sm:text-xl">
                私たちが選ぶのは、時間とともに良くなるもの。つくり手の背景、素材の手触り、手入れの方法まで、ひとつずつ丁寧に届けます。
              </p>
              <a className="mt-8 inline-flex items-center gap-3 border-b border-white pb-2 text-xs font-semibold tracking-[0.1em]" href="#top">
                MockShopについて <ArrowRight size={16} strokeWidth={1.5} />
              </a>
            </div>
          </div>
        </section>

        <section className="page-wrap py-20 sm:py-28" aria-labelledby="newsletter-heading">
          <div className="grid gap-10 border-y border-line py-12 lg:grid-cols-2 lg:items-end lg:py-16">
            <div>
              <p className="label text-muted">STAY IN THE KNOW</p>
              <h2 id="newsletter-heading" className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">A note from MockShop</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-muted">
                新着アイテム、つくり手のストーリー、季節の編集を月に2回お届けします。
              </p>
            </div>
            <form className="flex border-b border-ink pb-3" onSubmit={(event) => event.preventDefault()}>
              <input
                type="email"
                required
                aria-label="メールアドレス"
                placeholder="メールアドレス"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              />
              <button type="submit" className="ml-4 flex shrink-0 items-center gap-2 text-xs font-semibold tracking-[0.08em]">
                登録する <ArrowRight size={16} strokeWidth={1.5} />
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="bg-[#ebe9e3]">
        <div className="page-wrap grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:py-20">
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo />
            <p className="mt-5 max-w-xs text-sm leading-7 text-muted">日常に長く残る服と道具を、静かな編集で。</p>
          </div>
          {[
            ['SHOP', '新着アイテム', 'ウィメンズ', 'メンズ', 'リビング'],
            ['HELP', '配送と返品', 'お問い合わせ', 'サイズガイド', 'よくある質問'],
            ['FOLLOW', 'Instagram', 'Pinterest', 'Journal'],
          ].map(([title, ...links]) => (
            <div key={title}>
              <h2 className="label">{title}</h2>
              <ul className="mt-5 space-y-3 text-sm text-muted">
                {links.map((link) => <li key={link}><a className="hover:text-ink" href="#top">{link}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="page-wrap flex flex-col gap-3 border-t border-ink/15 py-5 text-[10px] tracking-[0.08em] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 MOCKSHOP. SAMPLE STOREFRONT.</p>
          <p>JAPAN / JPY</p>
        </div>
      </footer>

      <div
        aria-live="polite"
        className={`fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 bg-ink px-5 py-4 text-sm text-white shadow-xl transition-all sm:left-auto sm:right-5 sm:translate-x-0 ${toast ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
      >
        <div className="flex items-center justify-between gap-4">
          <span>{toast}</span>
          <button type="button" aria-label="通知を閉じる" onClick={() => setToast('')}>
            <X size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
