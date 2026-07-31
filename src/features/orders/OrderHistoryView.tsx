'use client'

import Link from 'next/link'

import { Button } from '@/components/button/Button'
import type { OrderDto } from '@/contracts/order'
import { formatPrice } from '@/features/products/format-price'

import {
  formatOrderDate,
  orderStatusLabel,
} from './order-presentation'

type OrderHistoryViewProps =
  | { items: OrderDto[]; status: 'success' }
  | { onRetry?: () => void; status: 'error' }
  | { status: 'loading' }

export function OrderHistoryView(props: OrderHistoryViewProps) {
  if (props.status === 'loading') {
    return (
      <section className="page-wrap py-16 sm:py-24">
        <div aria-live="polite" className="text-center" role="status">
          <h1 className="font-serif text-4xl sm:text-5xl">
            注文履歴を読み込んでいます
          </h1>
          <p className="mt-5 text-sm text-muted">しばらくお待ちください。</p>
        </div>
      </section>
    )
  }

  if (props.status === 'error') {
    return (
      <section className="page-wrap py-16 sm:py-24">
        <div
          aria-live="assertive"
          className="mx-auto max-w-xl text-center"
          role="alert"
        >
          <h1 className="font-serif text-4xl sm:text-5xl">
            注文履歴を読み込めませんでした
          </h1>
          <p className="mt-5 text-sm leading-7 text-muted">
            時間をおいてもう一度お試しください。
          </p>
          {props.onRetry ? (
            <Button className="mt-6" onClick={props.onRetry}>
              再試行
            </Button>
          ) : null}
        </div>
      </section>
    )
  }

  if (props.items.length === 0) {
    return (
      <section className="page-wrap py-16 sm:py-24">
        <p className="label text-accent">ORDER HISTORY</p>
        <h1 className="mt-4 font-serif text-4xl sm:text-5xl">注文履歴</h1>
        <div className="mt-10 border border-line bg-surface px-6 py-16 text-center">
          <h2 className="font-serif text-3xl">注文履歴はありません</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            商品一覧から、気になる商品を探してみてください。
          </p>
          <Link className="button-primary mt-8" href="/products">
            商品一覧を見る
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page-wrap py-12 sm:py-16 lg:py-20">
      <p className="label text-accent">ORDER HISTORY</p>
      <h1 className="mt-4 font-serif text-4xl sm:text-5xl">注文履歴</h1>
      <ol className="mt-10 space-y-5">
        {props.items.map((order) => (
          <li className="border border-line bg-surface p-6" key={order.id}>
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-muted">
                  注文番号
                </p>
                <p className="mt-2 break-all font-mono text-sm">{order.id}</p>
                <p className="mt-3 text-sm text-muted">
                  {formatOrderDate(order.createdAt)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-sm font-semibold">
                  {orderStatusLabel(order.status)}
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums">
                  {formatPrice(order.total)}
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm text-muted">
              {order.items.length}点の商品
            </p>
            <Link
              className="mt-5 inline-block text-sm underline underline-offset-4"
              href={`/orders/${order.id}`}
            >
              注文詳細を見る
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
