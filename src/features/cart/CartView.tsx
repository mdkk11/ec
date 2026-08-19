'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/button/Button'
import type { CartDto, CartItemDto } from '@/contracts/cart'
import { CouponForm } from '@/features/coupons/CouponForm'
import { formatPrice } from '@/features/products/format-price'

import type {
  CartOperation,
} from './CartOperationProvider'

export type CartViewOperationState = {
  errors: Array<{
    message: string
    operation: CartOperation
    recovery?: 'refresh' | 'retry'
  }>
  pending: CartOperation[]
}

export type CartCheckoutState = {
  confirmationRequired?: boolean
  errorMessage?: string | null
  message?: string | null
  pending: boolean
  refreshFailed?: boolean
}

type CartViewProps = {
  cart: CartDto
  checkoutState?: CartCheckoutState
  onDelete: (itemId: string) => void
  onApplyCoupon: (code: string) => Promise<unknown> | void
  onCheckout: (checkoutToken: string) => Promise<unknown> | void
  onRefreshAfterUpdateError?: (
    operation: Extract<CartOperation, { kind: 'update' }>,
  ) => Promise<boolean>
  onRefreshCart?: () => Promise<unknown> | void
  onRemoveCoupon: () => Promise<unknown> | void
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
  onRefreshAfterUpdateError,
  operationState,
  interactionDisabled,
}: {
  cart: CartDto
  item: CartItemDto
  onDelete: CartViewProps['onDelete']
  onUpdate: CartViewProps['onUpdate']
  onRefreshAfterUpdateError: CartViewProps['onRefreshAfterUpdateError']
  operationState: CartViewOperationState
  interactionDisabled: boolean
}) {
  const [quantityDraft, setQuantityDraft] = useState<number | null>(null)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [refreshPending, setRefreshPending] = useState(false)
  const quantity = quantityDraft ?? item.quantity
  const pendingOperations = operationState.pending.filter(
    (operation) =>
      (operation.kind === 'delete' || operation.kind === 'update') &&
      operation.itemId === item.id,
  )
  const updating = pendingOperations.length > 0
  const operationError =
    operationState.errors.find(
      ({ operation }) =>
        (operation.kind === 'delete' || operation.kind === 'update') &&
        operation.itemId === item.id,
    ) ?? null
  const updateError =
    operationError?.operation.kind === 'update'
      ? { ...operationError, operation: operationError.operation }
      : null
  const issue = issueMessage(cart, item)
  const quantityOptions = Array.from(
    { length: item.availableStock },
    (_, index) => index + 1,
  )
  const savedQuantityExceedsStock = item.quantity > item.availableStock
  const quantityDisabled =
    interactionDisabled ||
    item.availability !== 'available' ||
    item.availableStock === 0

  const updateQuantity = async (nextQuantity: number) => {
    const result = await onUpdate(item.id, nextQuantity)
    if (result) {
      setQuantityDraft((current) =>
        current === nextQuantity ? null : current,
      )
    }
  }

  return (
    <li
      aria-busy={updating || interactionDisabled}
      className="grid gap-5 border-b border-line py-6 sm:grid-cols-[8rem_minmax(0,1fr)]"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[#ebeae6]">
        <Image
          alt={item.name}
          className="object-cover"
          fill
          sizes="128px"
          src={item.imagePath}
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
            <select
              aria-label={`${item.name}の数量`}
              className={`h-12 border border-line bg-surface px-3 text-base tabular-nums ${
                savedQuantityExceedsStock ? 'w-44' : 'w-24'
              }`}
              disabled={quantityDisabled}
              id={`quantity-${item.id}`}
              onChange={(event) => {
                const nextQuantity = Number(event.target.value)
                setQuantityDraft(nextQuantity)
                setRefreshFailed(false)
                void updateQuantity(nextQuantity)
              }}
              value={quantity}
            >
              {savedQuantityExceedsStock ? (
                <option disabled value={item.quantity}>
                  {item.quantity}点（在庫超過）
                </option>
              ) : null}
              {quantityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}点
                </option>
              ))}
            </select>
          </label>
          <Button
            aria-label={`${item.name}を削除`}
            disabled={interactionDisabled || updating}
            onClick={() => onDelete(item.id)}
            variant="text"
          >
            削除
          </Button>
        </div>
        {operationError ? (
          <div className="mt-3 text-sm text-accent">
            <p role="alert">{operationError.message}</p>
            {updateError?.recovery === 'refresh' &&
            onRefreshAfterUpdateError ? (
              <Button
                className="mt-3"
                disabled={refreshPending}
                onClick={async () => {
                  setRefreshPending(true)
                  setRefreshFailed(false)
                  const refreshed = await onRefreshAfterUpdateError(
                    updateError.operation,
                  )
                  setRefreshPending(false)
                  if (refreshed) setQuantityDraft(null)
                  else setRefreshFailed(true)
                }}
                variant="secondary"
              >
                {refreshPending
                  ? '再取得しています…'
                  : '最新のカートを再取得'}
              </Button>
            ) : null}
            {updateError?.recovery === 'retry' ? (
              <Button
                className="mt-3"
                disabled={updating}
                onClick={() =>
                  void updateQuantity(updateError.operation.quantity)
                }
                variant="secondary"
              >
                再試行
              </Button>
            ) : null}
          </div>
        ) : null}
        {refreshFailed ? (
          <p className="mt-2 text-sm text-accent" role="alert">
            最新のカートを取得できませんでした。もう一度お試しください。
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
  checkoutState = { pending: false },
  onApplyCoupon,
  onCheckout,
  onDelete,
  onRefreshAfterUpdateError,
  onRefreshCart,
  onRemoveCoupon,
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
          <div className="mt-8 flex flex-col items-center gap-4">
            <Link className="button-primary" href="/products">
              商品一覧を見る
            </Link>
            <Link className="button-secondary" href="/orders">
              注文履歴を見る
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const couponIssue = cart.issues.find((issue) =>
    issue.code.startsWith('COUPON_'),
  )
  const couponPending = operationState.pending.find(
    (operation) =>
      operation.kind === 'apply-coupon' ||
      operation.kind === 'remove-coupon',
  )
  const couponError = operationState.errors.find(
    ({ operation }) =>
      operation.kind === 'apply-coupon' ||
      operation.kind === 'remove-coupon',
  )?.message
  const cartOperationPending = operationState.pending.length > 0
  const interactionDisabled = checkoutState.pending

  return (
    <section
      aria-busy={checkoutState.pending}
      className="page-wrap py-12 sm:py-16 lg:py-20"
    >
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
              onRefreshAfterUpdateError={onRefreshAfterUpdateError}
              onUpdate={onUpdate}
              operationState={operationState}
              interactionDisabled={interactionDisabled}
            />
          ))}
        </ul>
        <aside className="h-fit border border-line bg-surface p-6 lg:sticky lg:top-8">
          <h2 className="font-serif text-2xl">合計</h2>
          <CouponForm
            coupon={cart.coupon}
            disabled={interactionDisabled}
            errorMessage={couponError}
            issueCode={
              couponIssue &&
              couponIssue.code !== 'PRODUCT_UNAVAILABLE' &&
              couponIssue.code !== 'STOCK_CONFLICT'
                ? couponIssue.code
                : null
            }
            onApply={onApplyCoupon}
            onRemove={onRemoveCoupon}
            pending={
              couponPending?.kind === 'apply-coupon'
                ? 'apply'
                : couponPending?.kind === 'remove-coupon'
                  ? 'remove'
                  : null
            }
          />
          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">商品小計</dt>
              <dd className="tabular-nums">{formatPrice(cart.subtotal)}</dd>
            </div>
            {cart.coupon ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">クーポン割引</dt>
                <dd className="tabular-nums">
                  −{formatPrice(cart.discountAmount)}
                </dd>
              </div>
            ) : null}
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
          {checkoutState.message ? (
            <p className="mt-6 text-sm leading-6 text-accent" role="status">
              {checkoutState.message}
            </p>
          ) : null}
          {checkoutState.errorMessage ? (
            <p className="mt-6 text-sm leading-6 text-accent" role="alert">
              {checkoutState.errorMessage}
            </p>
          ) : null}
          {(checkoutState.refreshFailed ||
            checkoutState.confirmationRequired) &&
          onRefreshCart ? (
            <Button
              className="mt-4 w-full"
              disabled={checkoutState.pending}
              onClick={() => void onRefreshCart()}
              variant="secondary"
            >
              最新のカートを再取得
            </Button>
          ) : null}
          {checkoutState.confirmationRequired ? (
            <Link
              className="button-secondary mt-3 w-full"
              href="/orders"
            >
              注文履歴を確認
            </Link>
          ) : null}
          <Button
            className="mt-6 w-full"
            disabled={
              cart.checkoutToken === null ||
              cartOperationPending ||
              checkoutState.confirmationRequired ||
              checkoutState.refreshFailed ||
              checkoutState.pending
            }
            onClick={() => {
              if (cart.checkoutToken) {
                void onCheckout(cart.checkoutToken)
              }
            }}
          >
            {checkoutState.pending ? '注文を確定しています…' : '注文を確定する'}
          </Button>
          {checkoutState.pending ? (
            <p aria-live="polite" className="sr-only" role="status">
              注文を確定しています。
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
