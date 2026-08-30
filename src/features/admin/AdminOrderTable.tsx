'use client'

import type { OrderDto, OrderStatus } from '@/contracts/order'
import { formatPrice } from '@/features/products/format-price'

import { Button } from '@/components/button/Button'
import { Skeleton } from '@/components/skeleton/Skeleton'
import { formatOrderDate, orderStatusLabel } from '@/features/orders/order-presentation'
import { getAllowedOrderStatuses } from '@/features/orders/order-status-transition'

type AdminOrderTableProps = {
  conflictLatest?: OrderDto | null
  conflictOrderId?: string | null
  errorMessage?: string
  items?: OrderDto[]
  onAcknowledgeConflict?: () => void
  onRetry?: () => void
  onSelectStatus?: (orderId: string, status: OrderStatus | '') => void
  onUpdate?: (orderId: string) => void
  pendingOrderId?: string | null
  selectedStatuses?: Record<string, OrderStatus | undefined>
  status: 'error' | 'loading' | 'success'
  statusMessage?: string
}

export function AdminOrderTable({
  conflictLatest,
  conflictOrderId,
  errorMessage,
  items = [],
  onAcknowledgeConflict,
  onRetry,
  onSelectStatus,
  onUpdate,
  pendingOrderId,
  selectedStatuses = {},
  status,
  statusMessage = '注文一覧を読み込んでいます。しばらくお待ちください。',
}: AdminOrderTableProps) {
  if (status === 'loading') {
    return (
      <>
        <p aria-live="polite" className="sr-only" role="status">
          {statusMessage}
        </p>
        <section aria-busy="true" className="overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <caption className="sr-only">管理注文一覧</caption>
            <thead className="border-b border-line bg-canvas text-xs font-semibold tracking-[0.08em]">
              <tr>
                <th className="px-5 py-4" scope="col">
                  注文
                </th>
                <th className="px-5 py-4" scope="col">
                  状態
                </th>
                <th className="px-5 py-4" scope="col">
                  合計
                </th>
                <th className="px-5 py-4" scope="col">
                  状態を更新
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-5 py-5 align-top">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="mt-2 h-4 w-40" />
                </td>
                <td className="px-5 py-5 align-top">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="mt-2 h-4 w-20" />
                </td>
                <td className="px-5 py-5 align-top">
                  <Skeleton className="h-5 w-24" />
                </td>
                <td className="px-5 py-5 align-top">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-40" />
                    <Skeleton className="h-12 w-24" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </>
    )
  }

  if (status === 'error') {
    return (
      <section className="border border-line bg-surface p-10 text-center">
        <div aria-live="assertive" className="mx-auto max-w-xl" role="alert">
          <h2 className="font-serif text-3xl">注文一覧を読み込めませんでした</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            {errorMessage ?? '時間をおいてもう一度お試しください。'}
          </p>
          {onRetry ? (
            <Button className="mt-6" onClick={onRetry}>
              再試行
            </Button>
          ) : null}
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="border border-line bg-surface p-10 text-center">
        <h2 className="font-serif text-3xl">注文はまだありません</h2>
        <p className="mt-4 text-sm leading-7 text-muted">
          注文が確定すると、ここで状態を管理できます。
        </p>
      </section>
    )
  }

  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <caption className="sr-only">管理注文一覧</caption>
        <thead className="border-b border-line bg-canvas text-xs font-semibold tracking-[0.08em]">
          <tr>
            <th className="px-5 py-4" scope="col">
              注文
            </th>
            <th className="px-5 py-4" scope="col">
              状態
            </th>
            <th className="px-5 py-4" scope="col">
              合計
            </th>
            <th className="px-5 py-4" scope="col">
              状態を更新
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((order) => {
            const allowedStatuses = getAllowedOrderStatuses(order.status)
            const selectedStatus = selectedStatuses[order.id] ?? ''
            const isPending = pendingOrderId === order.id
            const isConflict = conflictOrderId === order.id

            return (
              <tr aria-busy={isPending} key={order.id}>
                <th className="px-5 py-5 align-top font-normal" scope="row">
                  <p className="break-all font-mono text-xs">{order.id}</p>
                  <p className="mt-2 text-xs text-muted">
                    {formatOrderDate(order.createdAt)} / {order.items.length}点
                  </p>
                </th>
                <td className="px-5 py-5 align-top">
                  <span className="font-semibold">{orderStatusLabel(order.status)}</span>
                  <p className="mt-2 text-xs text-muted">version {order.version}</p>
                </td>
                <td className="px-5 py-5 align-top font-semibold tabular-nums">
                  {formatPrice(order.total)}
                </td>
                <td className="px-5 py-5 align-top">
                  {isConflict ? (
                    <div
                      aria-live="assertive"
                      className="max-w-xs border border-accent bg-[#fff8f5] p-4"
                      role="alert"
                    >
                      <p className="font-semibold">最新状態を確認してください</p>
                      <p className="mt-2 text-xs leading-5 text-muted">
                        {conflictLatest
                          ? `現在は「${orderStatusLabel(conflictLatest.status)}」です。`
                          : '注文の最新状態を取得できませんでした。'}
                      </p>
                      {onAcknowledgeConflict ? (
                        <Button
                          className="mt-4 w-full px-3 text-[10px]"
                          onClick={onAcknowledgeConflict}
                          type="button"
                          variant="secondary"
                        >
                          最新状態を確認
                        </Button>
                      ) : null}
                    </div>
                  ) : allowedStatuses.length === 0 ? (
                    <span className="text-xs text-muted">変更できません</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="sr-only" htmlFor={`admin-order-status-${order.id}`}>
                        注文 {order.id} の変更先状態
                      </label>
                      <select
                        className="min-h-12 border border-line bg-surface px-3 text-sm"
                        disabled={isPending}
                        id={`admin-order-status-${order.id}`}
                        onChange={(event) =>
                          onSelectStatus?.(order.id, event.target.value as OrderStatus | '')
                        }
                        value={selectedStatus}
                      >
                        <option value="">変更先を選択</option>
                        {allowedStatuses.map((nextStatus) => (
                          <option key={nextStatus} value={nextStatus}>
                            {orderStatusLabel(nextStatus)}
                          </option>
                        ))}
                      </select>
                      <Button
                        className="px-4 text-[10px]"
                        disabled={!selectedStatus || isPending}
                        onClick={() => onUpdate?.(order.id)}
                        type="button"
                      >
                        {isPending ? '更新中…' : '状態を更新'}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
