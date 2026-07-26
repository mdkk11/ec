'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/button/Button'
import { useSession } from '@/features/auth/SessionProvider'

import { useCartOperations } from './CartOperationProvider'

export function ProductCartAction({
  availability,
  productId,
}: {
  availability: 'in_stock' | 'out_of_stock'
  productId: string
}) {
  const { refresh, state: sessionState } = useSession()
  const operations = useCartOperations()
  const [showSuccess, setShowSuccess] = useState(false)
  const toastTimeoutRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current)
      }
    },
    [],
  )

  if (availability === 'out_of_stock') {
    return (
      <Button className="mt-7 w-full" disabled>
        在庫切れ
      </Button>
    )
  }
  if (sessionState.status === 'loading') {
    return (
      <p aria-live="polite" className="mt-7 text-sm text-muted" role="status">
        認証状態を確認しています…
      </p>
    )
  }
  if (sessionState.status === 'error') {
    return (
      <div className="mt-7">
        <p className="text-sm text-accent" role="alert">
          認証状態を確認できませんでした。
        </p>
        <Button className="mt-3" onClick={refresh} variant="secondary">
          再試行
        </Button>
      </div>
    )
  }
  if (sessionState.status === 'anonymous') {
    return (
      <Link className="button-primary mt-7 w-full" href="/login">
        ログインして購入
      </Link>
    )
  }
  if (sessionState.user.role !== 'customer') {
    return (
      <p className="mt-7 text-sm leading-6 text-muted">
        カートは購入者アカウントで利用できます。
      </p>
    )
  }

  const pending = operations.state.pending.some(
    ({ operation }) =>
      operation.kind === 'add' && operation.productId === productId,
  )
  const failure = operations.state.errors.find(
    ({ operation }) =>
      operation.kind === 'add' && operation.productId === productId,
  )
  const errorMessage = failure
    ? failure.error instanceof Error
      ? failure.error.message
      : '商品を追加できませんでした。もう一度お試しください。'
    : null

  return (
    <div className="mt-7">
      <Button
        className="w-full"
        disabled={pending}
        onClick={async () => {
          setShowSuccess(false)
          const cart = await operations.execute({
            kind: 'add',
            productId,
            quantity: 1,
          })
          if (!cart) return
          setShowSuccess(true)
          if (toastTimeoutRef.current !== null) {
            window.clearTimeout(toastTimeoutRef.current)
          }
          toastTimeoutRef.current = window.setTimeout(
            () => setShowSuccess(false),
            4_000,
          )
        }}
      >
        {pending ? '追加中…' : '1点カートに追加'}
      </Button>
      {pending ? (
        <p aria-live="polite" className="sr-only" role="status">
          カートへ追加しています。
        </p>
      ) : null}
      {failure ? (
        <p aria-live="assertive" className="mt-3 text-sm text-accent" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {showSuccess ? (
        <div
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-50 w-[min(90vw,24rem)] -translate-x-1/2 border border-ink bg-ink px-5 py-4 text-sm text-white sm:bottom-8 sm:left-auto sm:right-8 sm:translate-x-0"
          role="status"
        >
          <p>カートへ追加しました。</p>
          <Link className="mt-2 inline-block underline underline-offset-4" href="/cart">
            カートを見る
          </Link>
        </div>
      ) : null}
    </div>
  )
}
