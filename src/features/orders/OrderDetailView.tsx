import Link from 'next/link'

import type { OrderDto } from '@/contracts/order'
import { formatPrice } from '@/features/products/format-price'

import { formatOrderDate, orderStatusLabel } from './order-presentation'

export function OrderDetailView({
  order,
  variant = 'detail',
}: {
  order: OrderDto
  variant?: 'complete' | 'detail'
}) {
  return (
    <section className="page-wrap py-12 sm:py-16 lg:py-20">
      <p className="label text-accent">
        {variant === 'complete' ? 'ORDER COMPLETE' : 'ORDER DETAIL'}
      </p>
      <h1 className="mt-4 font-serif text-4xl sm:text-5xl">
        {variant === 'complete' ? 'ご注文を受け付けました' : '注文詳細'}
      </h1>
      {variant === 'complete' ? (
        <p aria-live="polite" className="mt-5 text-sm leading-7 text-muted" role="status">
          注文内容を保存しました。注文番号と確定内容をご確認ください。
        </p>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <div>
          <div className="border-b border-line pb-6">
            <p className="text-xs font-semibold tracking-[0.08em] text-muted">注文番号</p>
            <p className="mt-2 break-all font-mono text-sm">{order.id}</p>
            <p className="mt-3 text-sm text-muted">{formatOrderDate(order.createdAt)}</p>
          </div>
          <ul>
            {order.items.map((item) => (
              <li
                className="flex flex-wrap justify-between gap-5 border-b border-line py-6"
                key={item.productId}
              >
                <div>
                  <h2 className="font-serif text-2xl">{item.productName}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {formatPrice(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">{formatPrice(item.lineTotal)}</p>
              </li>
            ))}
          </ul>
        </div>
        <aside className="h-fit border border-line bg-surface p-6 lg:sticky lg:top-8">
          <h2 className="font-serif text-2xl">確定内容</h2>
          <p className="mt-3 text-sm">
            状態: <strong>{orderStatusLabel(order.status)}</strong>
          </p>
          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">商品小計</dt>
              <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
            </div>
            {order.couponCode ? (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">クーポン {order.couponCode}</dt>
                  <dd>{order.discountPercent}%</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">割引</dt>
                  <dd className="tabular-nums">−{formatPrice(order.discountAmount)}</dd>
                </div>
              </>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-line pt-4 text-base font-semibold">
              <dt>合計</dt>
              <dd className="tabular-nums">{formatPrice(order.total)}</dd>
            </div>
          </dl>
          <Link className="button-secondary mt-6 w-full" href="/orders">
            注文履歴を見る
          </Link>
        </aside>
      </div>
    </section>
  )
}
