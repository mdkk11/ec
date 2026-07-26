import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Button } from '@/components/button/Button'
import type { ProductDto } from '@/contracts/product'

import { formatPrice } from './format-price'

export type ProductDetailViewProps =
  | {
      product: ProductDto
      purchaseAction?: ReactNode
      status: 'success'
    }
  | {
      status: 'loading'
    }
  | {
      status: 'not_found'
    }
  | {
      message?: string
      onRetry?: () => void
      status: 'error'
    }

function Breadcrumbs({ productName }: { productName?: string }) {
  return (
    <nav aria-label="パンくずリスト" className="text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link className="underline-offset-4 hover:underline" href="/">
            ホーム
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link
            className="underline-offset-4 hover:underline"
            href="/products"
          >
            商品一覧
          </Link>
        </li>
        {productName ? (
          <>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{productName}</li>
          </>
        ) : null}
      </ol>
    </nav>
  )
}

export function ProductDetailView(props: ProductDetailViewProps) {
  if (props.status === 'loading') {
    return (
      <section className="page-wrap py-12 sm:py-16">
        <Breadcrumbs />
        <div
          aria-live="polite"
          className="py-24 text-center text-sm text-muted"
          role="status"
        >
          商品を読み込んでいます…
        </div>
      </section>
    )
  }

  if (props.status === 'not_found') {
    return (
      <section className="page-wrap py-12 sm:py-16">
        <Breadcrumbs />
        <div className="mx-auto max-w-xl py-24 text-center">
          <p className="label text-accent">404</p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl">
            商品が見つかりませんでした
          </h1>
          <p className="mt-5 text-sm leading-7 text-muted">
            URLが正しくないか、現在は公開されていない可能性があります。
          </p>
          <Link className="button-secondary mt-8" href="/products">
            商品一覧へ戻る
          </Link>
        </div>
      </section>
    )
  }

  if (props.status === 'error') {
    return (
      <section className="page-wrap py-12 sm:py-16">
        <Breadcrumbs />
        <div className="mx-auto max-w-xl py-24 text-center">
          <div aria-live="assertive" role="alert">
            <h1 className="font-serif text-4xl sm:text-5xl">
              商品を読み込めませんでした
            </h1>
            <p className="mt-5 text-sm leading-7 text-muted">
              {props.message ??
                '商品を取得できませんでした。時間をおいてもう一度お試しください。'}
            </p>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={props.onRetry}>再試行</Button>
            <Link className="button-secondary" href="/products">
              商品一覧へ戻る
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const { product } = props
  const outOfStock = product.availability === 'out_of_stock'

  return (
    <section className="page-wrap py-12 sm:py-16 lg:py-20">
      <Breadcrumbs productName={product.name} />
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)] lg:gap-14">
        <div className="relative aspect-[3/4] overflow-hidden bg-[#ebeae6]">
          <Image
            alt={product.name}
            className="object-cover"
            fill
            priority
            sizes="(min-width: 1024px) 66vw, 100vw"
            src={product.imagePath}
          />
        </div>
        <div className="self-start lg:sticky lg:top-8">
          <p className="label text-accent">PRODUCT</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-5 text-lg tabular-nums">
            {formatPrice(product.price)}
          </p>
          <p
            className={`mt-7 inline-flex border px-4 py-2 text-xs font-semibold tracking-[0.08em] ${
              outOfStock
                ? 'border-line bg-line text-muted'
                : 'border-sage bg-sage/25'
            }`}
          >
            {outOfStock ? '在庫切れ' : '在庫あり'}
          </p>
          {props.purchaseAction}
          <div className="mt-9 border-t border-line pt-7">
            <h2 className="text-xs font-semibold tracking-[0.1em]">商品説明</h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-8 text-muted">
              {product.description}
            </p>
          </div>
          <Link
            className="mt-9 inline-block text-sm underline underline-offset-4"
            href="/products"
          >
            商品一覧へ戻る
          </Link>
        </div>
      </div>
    </section>
  )
}
