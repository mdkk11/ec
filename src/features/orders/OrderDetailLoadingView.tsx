import Link from 'next/link'

import { Skeleton } from '@/components/skeleton/Skeleton'

export function OrderDetailLoadingView() {
  return (
    <>
      <p aria-live="polite" className="sr-only" role="status">
        注文詳細を読み込んでいます。しばらくお待ちください。
      </p>
      <section aria-busy="true" className="page-wrap py-12 sm:py-16 lg:py-20">
        <p className="label text-accent">ORDER DETAIL</p>
        <h1 className="mt-4 font-serif text-4xl sm:text-5xl">注文詳細</h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
          <div>
            <div className="border-b border-line pb-6">
              <p className="text-xs font-semibold tracking-[0.08em] text-muted">注文番号</p>
              <Skeleton className="mt-2 h-5 w-full max-w-80" />
              <Skeleton className="mt-3 h-5 w-40" />
            </div>
            <ul>
              {Array.from({ length: 2 }, (_, index) => (
                <li
                  className="flex flex-wrap justify-between gap-5 border-b border-line py-6"
                  key={index}
                >
                  <div className="min-w-56 flex-1">
                    <Skeleton className="h-8 w-4/5 max-w-96" />
                    <Skeleton className="mt-2 h-5 w-36" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </li>
              ))}
            </ul>
          </div>
          <aside className="h-fit border border-line bg-surface p-6 lg:sticky lg:top-8">
            <h2 className="font-serif text-2xl">確定内容</h2>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span>状態:</span>
              <Skeleton className="h-5 w-14" />
            </div>
            <dl className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">商品小計</dt>
                <dd>
                  <Skeleton className="h-5 w-20" />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>
                  <Skeleton className="h-5 w-28" />
                </dt>
                <dd>
                  <Skeleton className="h-5 w-20" />
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-4 text-base font-semibold">
                <dt>合計</dt>
                <dd>
                  <Skeleton className="h-6 w-24" />
                </dd>
              </div>
            </dl>
            <Link className="button-secondary mt-6 w-full" href="/orders">
              注文履歴を見る
            </Link>
          </aside>
        </div>
      </section>
    </>
  )
}
