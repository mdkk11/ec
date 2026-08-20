import Link from 'next/link'

import { Skeleton } from '@/components/skeleton/Skeleton'

function LoadingField({
  label,
  shapeClassName = 'h-12 w-full',
}: {
  label: string
  shapeClassName?: string
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <Skeleton className={`mt-2 ${shapeClassName}`} />
    </div>
  )
}

export function AdminProductsLoadingView({
  statusMessage,
}: {
  statusMessage: string
}) {
  return (
    <>
      <p aria-live="polite" className="sr-only" role="status">
        {statusMessage}
      </p>
      <section
        aria-busy="true"
        className="page-wrap py-12 sm:py-16 lg:py-20"
      >
        <p className="label text-accent">ADMINISTRATION</p>
        <h1 className="mt-4 font-serif text-4xl sm:text-5xl">商品管理</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
          商品の作成、公開状態、価格と在庫を管理します。
        </p>

        <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,32rem)]">
          <section>
            <h2 className="font-serif text-3xl">商品一覧</h2>
            <Skeleton className="mt-2 h-5 w-12" />
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {Array.from({ length: 2 }, (_, index) => (
                <li
                  className="grid gap-4 py-5 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center"
                  key={index}
                >
                  <Skeleton className="aspect-[3/4] w-20" />
                  <div>
                    <Skeleton className="h-8 w-3/4 max-w-72" />
                    <Skeleton className="mt-2 h-5 w-2/3 max-w-64" />
                  </div>
                  <Skeleton className="h-12 w-24" />
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-3xl">新しい商品</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              作成時は非公開です。内容を確認してから公開できます。
            </p>
            <div className="mt-6 border border-line bg-surface p-5 sm:p-7">
              <div className="grid gap-6">
                <LoadingField label="カテゴリ" />
                <LoadingField label="商品名" />
                <LoadingField
                  label="商品説明"
                  shapeClassName="h-32 w-full"
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <LoadingField label="価格（円）" />
                  <LoadingField label="在庫数" />
                </div>
                <LoadingField label="画像パス" />
                <div className="flex min-h-12 items-center gap-3 text-sm font-semibold">
                  <Skeleton className="h-5 w-5" />
                  購入者へ公開する
                </div>
              </div>
              <Skeleton className="mt-7 h-12 w-full sm:w-28" />
            </div>
          </section>
        </div>
      </section>
    </>
  )
}

export function AdminProductEditLoadingView({
  statusMessage,
}: {
  statusMessage: string
}) {
  return (
    <>
      <p aria-live="polite" className="sr-only" role="status">
        {statusMessage}
      </p>
      <section
        aria-busy="true"
        className="page-wrap py-12 sm:py-16 lg:py-20"
      >
        <Link
          className="text-sm underline underline-offset-4"
          href="/admin/products"
        >
          商品管理へ戻る
        </Link>
        <p className="label mt-8 text-accent">ADMINISTRATION</p>
        <Skeleton className="mt-4 h-14 w-3/4 max-w-xl" />
        <div className="mt-3 flex items-center gap-2 text-sm text-muted">
          <span>version</span>
          <Skeleton className="h-4 w-8" />
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section>
            <h2 className="font-serif text-3xl">商品情報と公開状態</h2>
            <div className="mt-6 border border-line bg-surface p-5 sm:p-7">
              <div className="grid gap-6">
                <LoadingField label="カテゴリ" />
                <LoadingField label="商品名" />
                <LoadingField
                  label="商品説明"
                  shapeClassName="h-32 w-full"
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <LoadingField label="価格（円）" />
                </div>
                <LoadingField label="画像パス" />
                <div className="flex min-h-12 items-center gap-3 text-sm font-semibold">
                  <Skeleton className="h-5 w-5" />
                  購入者へ公開する
                </div>
              </div>
              <Skeleton className="mt-7 h-12 w-full sm:w-36" />
            </div>
          </section>

          <section>
            <h2 className="font-serif text-3xl">在庫</h2>
            <div className="mt-6 border border-line bg-surface p-6">
              <LoadingField label="在庫数" />
              <p className="mt-4 text-sm leading-6 text-muted">
                注文や取消でも商品versionが更新されます。
              </p>
              <Skeleton className="mt-6 h-12 w-full" />
            </div>
          </section>
        </div>
      </section>
    </>
  )
}
