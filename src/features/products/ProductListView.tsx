import Link from 'next/link'

import { Button } from '@/components/button/Button'
import type { ProductDto } from '@/contracts/product'

import { ProductCard } from './ProductCard'

export type ProductListViewProps =
  | {
      items: ProductDto[]
      status: 'success'
    }
  | {
      message?: string
      onRetry?: () => void
      status: 'error'
    }
  | {
      status: 'loading'
    }

export function ProductListView(props: ProductListViewProps) {
  return (
    <section className="page-wrap py-12 sm:py-16 lg:py-20">
      <nav aria-label="パンくずリスト" className="text-xs text-muted">
        <ol className="flex items-center gap-2">
          <li>
            <Link className="underline-offset-4 hover:underline" href="/">
              ホーム
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">商品一覧</li>
        </ol>
      </nav>

      <div className="mt-8 border-b border-line pb-7 sm:flex sm:items-end sm:justify-between sm:gap-8">
        <div>
          <p className="label text-accent">CATALOG</p>
          <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">
            商品一覧
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">
            日常に長く残る服と道具を、新しく届いた順にご覧いただけます。
          </p>
        </div>
        {props.status === 'success' ? (
          <p className="mt-5 shrink-0 text-xs font-semibold tracking-[0.08em] text-muted sm:mt-0">
            {props.items.length}点
          </p>
        ) : null}
      </div>

      {props.status === 'loading' ? (
        <div
          aria-live="polite"
          className="py-24 text-center text-sm text-muted"
          role="status"
        >
          商品を読み込んでいます…
        </div>
      ) : null}

      {props.status === 'error' ? (
        <div className="mx-auto max-w-xl py-24 text-center">
          <div aria-live="assertive" role="alert">
            <h2 className="font-serif text-3xl">商品を読み込めませんでした</h2>
            <p className="mt-4 text-sm leading-7 text-muted">
              {props.message ??
                '商品を取得できませんでした。時間をおいてもう一度お試しください。'}
            </p>
          </div>
          <Button className="mt-7" onClick={props.onRetry}>
            再試行
          </Button>
        </div>
      ) : null}

      {props.status === 'success' && props.items.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="font-serif text-3xl">公開中の商品はまだありません</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            新しい商品が追加されるまで、もうしばらくお待ちください。
          </p>
        </div>
      ) : null}

      {props.status === 'success' && props.items.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-y-14">
          {props.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
