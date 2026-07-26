'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/button/Button'
import type { CartDto, CartItemDto } from '@/contracts/cart'
import { formatPrice } from '@/features/products/format-price'

import type {
  CartOperation,
} from './CartOperationProvider'

export type CartViewOperationState = {
  errors: Array<{ message: string; operation: CartOperation }>
  pending: CartOperation[]
}

type CartViewProps = {
  cart: CartDto
  onDelete: (itemId: string) => void
  onUpdate: (
    itemId: string,
    quantity: number,
  ) => Promise<unknown> | void
  operationState?: CartViewOperationState
}

function issueMessage(cart: CartDto, item: CartItemDto) {
  const issue = cart.issues.find((candidate) => candidate.itemId === item.id)
  if (issue?.code === 'PRODUCT_UNAVAILABLE') {
    return 'この商品は現在非公開です。削除すると問題を解消できます。'
  }
  if (issue?.code === 'STOCK_CONFLICT') {
    return '在庫が変更されました。数量を減らして再度お試しください。'
  }
  return null
}

function CartLine({
  cart,
  item,
  onDelete,
  onUpdate,
  operationState,
}: {
  cart: CartDto
  item: CartItemDto
  onDelete: CartViewProps['onDelete']
  onUpdate: CartViewProps['onUpdate']
  operationState: CartViewOperationState
}) {
  const [quantityDraft, setQuantityDraft] = useState<string | null>(
    null,
  )
  const quantity = quantityDraft ?? String(item.quantity)
  const parsedQuantity = Number(quantity)
  const validQuantity =
    Number.isInteger(parsedQuantity) && parsedQuantity >= 1
  const pendingOperations = operationState.pending.filter(
    (operation) =>
      operation.kind !== 'add' && operation.itemId === item.id,
  )
  const updating = pendingOperations.length > 0
  const sameUpdatePending = pendingOperations.some(
    (operation) =>
      operation.kind === 'update' &&
      operation.quantity === parsedQuantity,
  )
  const operationError =
    operationState.errors.find(
      ({ operation }) =>
        operation.kind !== 'add' && operation.itemId === item.id,
    )?.message ?? null
  const issue = issueMessage(cart, item)

  return (
    <li
      aria-busy={updating}
      className="grid gap-5 border-b border-line py-6 sm:grid-cols-[8rem_minmax(0,1fr)]"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[#ebeae6]">
        <Image
          alt=""
          className="object-cover"
          fill
          sizes="128px"
          src="/images/fixtures/product-placeholder.svg"
        />
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">{item.name}</h2>
            <p className="mt-2 text-sm text-muted">
              単価 {formatPrice(item.unitPrice)}
            </p>
          </div>
          <p className="font-medium tabular-nums">
            {formatPrice(item.lineTotal)}
          </p>
        </div>

        {issue ? (
          <p
            className="mt-4 border-l-2 border-accent pl-3 text-sm leading-6 text-accent"
            role="status"
          >
            {issue}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-end gap-3 pt-6">
          <label
            className="grid gap-2 text-xs font-semibold"
            htmlFor={`quantity-${item.id}`}
          >
            数量
            <input
              aria-label={`${item.name}の数量`}
              className="h-12 w-24 border border-line bg-surface px-3 text-base tabular-nums"
              id={`quantity-${item.id}`}
              inputMode="numeric"
              min={1}
              onChange={(event) => setQuantityDraft(event.target.value)}
              step={1}
              type="number"
              value={quantity}
            />
          </label>
          <Button
            aria-label={`${item.name}の数量を更新`}
            disabled={!validQuantity || sameUpdatePending}
            onClick={async () => {
              const result = await onUpdate(item.id, parsedQuantity)
              if (result) {
                setQuantityDraft((current) =>
                  current === String(parsedQuantity) ? null : current,
                )
              }
            }}
            variant="secondary"
          >
            {updating ? '更新中…' : '数量を更新'}
          </Button>
          <Button
            aria-label={`${item.name}を削除`}
            disabled={updating}
            onClick={() => onDelete(item.id)}
            variant="text"
          >
            削除
          </Button>
        </div>
        {!validQuantity ? (
          <p className="mt-2 text-sm text-accent" role="alert">
            数量は1以上の整数で入力してください。
          </p>
        ) : null}
        {operationError ? (
          <p className="mt-2 text-sm text-accent" role="alert">
            {operationError}
          </p>
        ) : null}
        {updating ? (
          <p aria-live="polite" className="sr-only" role="status">
            {item.name}を更新しています。
          </p>
        ) : null}
      </div>
    </li>
  )
}

export function CartView({
  cart,
  onDelete,
  onUpdate,
  operationState = { errors: [], pending: [] },
}: CartViewProps) {
  if (cart.items.length === 0) {
    return (
      <section className="page-wrap py-16 sm:py-24">
        <p className="label text-accent">SHOPPING CART</p>
        <h1 className="mt-4 font-serif text-4xl sm:text-5xl">カート</h1>
        <div className="mt-10 border border-line bg-surface px-6 py-16 text-center">
          <h2 className="font-serif text-3xl">カートは空です</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            商品一覧から、気になる商品をカートへ追加してください。
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
      <p className="label text-accent">SHOPPING CART</p>
      <h1 className="mt-4 font-serif text-4xl sm:text-5xl">カート</h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <ul>
          {cart.items.map((item) => (
            <CartLine
              cart={cart}
              item={item}
              key={item.id}
              onDelete={onDelete}
              onUpdate={onUpdate}
              operationState={operationState}
            />
          ))}
        </ul>
        <aside className="h-fit border border-line bg-surface p-6 lg:sticky lg:top-8">
          <h2 className="font-serif text-2xl">合計</h2>
          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">商品小計</dt>
              <dd className="tabular-nums">{formatPrice(cart.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-4 text-base font-semibold">
              <dt>合計</dt>
              <dd className="tabular-nums">{formatPrice(cart.total)}</dd>
            </div>
          </dl>
          {cart.checkoutToken === null ? (
            <p className="mt-6 text-sm leading-6 text-accent" role="status">
              カート内の問題を解消すると、注文内容を確認できます。
            </p>
          ) : null}
          <Link
            className="mt-6 inline-block text-sm underline underline-offset-4"
            href="/products"
          >
            買い物を続ける
          </Link>
        </aside>
      </div>
    </section>
  )
}
