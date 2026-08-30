import Link from 'next/link'

import { Button } from '@/components/button/Button'
import { Skeleton } from '@/components/skeleton/Skeleton'
import type { PublicCategoryDto } from '@/contracts/category'
import type { ProductDto } from '@/contracts/product'
import { publicCategoryCatalog } from '@/features/categories/category-catalog'

import { ProductCard } from './ProductCard'

type ProductListNavigationProps = {
  categories?: readonly PublicCategoryDto[]
  selectedCategory?: PublicCategoryDto | null
}

export type ProductListViewProps = ProductListNavigationProps &
  (
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
    | {
        status: 'not_found'
      }
  )

export function ProductListView(props: ProductListViewProps) {
  const categories = props.categories ?? publicCategoryCatalog
  const selectedCategory = props.status === 'success' ? props.selectedCategory : null
  const allItemsCurrent = props.status === 'success' && !selectedCategory
  const heading = selectedCategory?.name ?? 'ALL ITEMS'

  return (
    <>
      {props.status === 'loading' ? (
        <p aria-live="polite" className="sr-only" role="status">
          商品を読み込んでいます…
        </p>
      ) : null}
      <section
        aria-busy={props.status === 'loading' ? true : undefined}
        className="page-wrap py-12 sm:py-16 lg:py-20"
      >
        <nav aria-label="パンくずリスト" className="text-xs text-muted">
          <ol className="flex items-center gap-2">
            <li>
              <Link className="underline-offset-4 hover:underline" href="/">
                ホーム
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            {selectedCategory ? (
              <>
                <li>
                  <Link className="underline-offset-4 hover:underline" href="/products">
                    ALL ITEMS
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{selectedCategory.name}</li>
              </>
            ) : (
              <li aria-current={props.status === 'success' ? 'page' : undefined}>ALL ITEMS</li>
            )}
          </ol>
        </nav>

        <nav aria-label="商品カテゴリ" className="mt-7">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold tracking-[0.08em]">
            <li>
              <Link
                aria-current={allItemsCurrent ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center border-b ${
                  allItemsCurrent ? 'border-current' : 'border-transparent'
                }`}
                href="/products"
              >
                ALL ITEMS
              </Link>
            </li>
            {categories.map((category) => {
              const current = selectedCategory?.slug === category.slug
              return (
                <li key={category.slug}>
                  <Link
                    aria-current={current ? 'page' : undefined}
                    className={`inline-flex min-h-11 items-center border-b ${
                      current ? 'border-current' : 'border-transparent'
                    }`}
                    href={`/products?category=${category.slug}`}
                  >
                    {category.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="mt-8 border-b border-line pb-7 sm:flex sm:items-end sm:justify-between sm:gap-8">
          <div>
            <p className="label text-accent">CATALOG</p>
            <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">{heading}</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">
              日常に長く残る服と道具を、新しく届いた順にご覧いただけます。
            </p>
          </div>
          {props.status === 'success' ? (
            <p className="mt-5 shrink-0 text-xs font-semibold tracking-[0.08em] text-muted sm:mt-0">
              {props.items.length}点
            </p>
          ) : props.status === 'loading' ? (
            <Skeleton className="mt-5 h-4 w-10 shrink-0 sm:mt-0" />
          ) : null}
        </div>

        {props.status === 'loading' ? (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-y-14">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index}>
                <Skeleton className="aspect-[3/4] w-full" />
                <div className="pt-4">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="mt-2 h-4 w-3/5" />
                  <Skeleton className="mt-3 h-4 w-2/5" />
                </div>
              </div>
            ))}
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

        {props.status === 'not_found' ? (
          <div className="mx-auto max-w-xl py-24 text-center">
            <p className="label text-accent">404</p>
            <h2 className="mt-3 font-serif text-3xl">カテゴリが見つかりませんでした</h2>
            <p className="mt-4 text-sm leading-7 text-muted">
              URLのカテゴリ指定を確認してください。
            </p>
            <Link className="button-secondary mt-8" href="/products">
              ALL ITEMSへ戻る
            </Link>
          </div>
        ) : null}

        {props.status === 'success' && props.items.length === 0 ? (
          <div className="py-24 text-center">
            <h2 className="font-serif text-3xl">
              {selectedCategory
                ? `「${selectedCategory.name}」の商品はまだありません`
                : '公開中の商品はまだありません'}
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted">
              {selectedCategory
                ? '別のカテゴリもご覧ください。'
                : '新しい商品が追加されるまで、もうしばらくお待ちください。'}
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
    </>
  )
}
