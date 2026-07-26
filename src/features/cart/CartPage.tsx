'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect } from 'react'

import { Button } from '@/components/button/Button'
import { useSession } from '@/features/auth/SessionProvider'
import { getCart } from '@/lib/api-client/cart'
import { ApiClientError } from '@/lib/api-client/request-json'

import {
  cartQueryKey,
  useCartOperations,
} from './CartOperationProvider'
import {
  CartView,
  type CartViewOperationState,
} from './CartView'

function StatusPage({
  children,
  role,
  title,
}: {
  children: React.ReactNode
  role?: 'alert' | 'status'
  title: string
}) {
  return (
    <section className="page-wrap py-16 sm:py-24">
      <div
        aria-live={role === 'alert' ? 'assertive' : 'polite'}
        className="mx-auto max-w-xl text-center"
        role={role}
      >
        <h1 className="font-serif text-4xl sm:text-5xl">{title}</h1>
        <div className="mt-5 text-sm leading-7 text-muted">{children}</div>
      </div>
    </section>
  )
}

export function CartPage() {
  const {
    refresh,
    setAnonymous,
    state: sessionState,
  } = useSession()
  const operations = useCartOperations()
  const customerId =
    sessionState.status === 'authenticated' &&
    sessionState.user.role === 'customer'
      ? sessionState.user.id
      : null
  const query = useQuery({
    enabled: customerId !== null,
    queryFn: ({ signal }) => getCart(signal).then(({ cart }) => cart),
    queryKey: cartQueryKey(customerId ?? 'disabled'),
  })

  useEffect(() => {
    if (
      query.error instanceof ApiClientError &&
      query.error.status === 401
    ) {
      setAnonymous()
    }
  }, [query.error, setAnonymous])

  if (sessionState.status === 'loading') {
    return (
      <StatusPage role="status" title="認証状態を確認しています">
        しばらくお待ちください。
      </StatusPage>
    )
  }
  if (sessionState.status === 'error') {
    return (
      <StatusPage role="alert" title="認証状態を確認できませんでした">
        <Button className="mt-4" onClick={refresh}>
          再試行
        </Button>
      </StatusPage>
    )
  }
  if (sessionState.status === 'anonymous') {
    return (
      <StatusPage title="カートを見るにはログインが必要です">
        <Link className="button-primary mt-4" href="/login">
          ログイン
        </Link>
      </StatusPage>
    )
  }
  if (sessionState.user.role !== 'customer') {
    return (
      <StatusPage title="カートは購入者専用です">
        管理者アカウントでは購入操作を利用できません。
      </StatusPage>
    )
  }
  if (query.isPending) {
    return (
      <StatusPage role="status" title="カートを読み込んでいます">
        しばらくお待ちください。
      </StatusPage>
    )
  }
  if (query.isError || !query.data) {
    const networkError =
      query.error instanceof ApiClientError &&
      query.error.kind === 'network'
    return (
      <StatusPage role="alert" title="カートを読み込めませんでした">
        <p>
          {networkError
            ? 'サーバーへ接続できませんでした。'
            : '時間をおいてもう一度お試しください。'}
        </p>
        <Button className="mt-4" onClick={() => void query.refetch()}>
          再試行
        </Button>
      </StatusPage>
    )
  }

  const operationState: CartViewOperationState = {
    errors: operations.state.errors.map(({ error, operation }) => ({
      message:
        error instanceof Error
          ? error.message
          : '更新できませんでした。もう一度お試しください。',
      operation,
    })),
    pending: operations.state.pending.map(({ operation }) => operation),
  }

  return (
    <CartView
      cart={query.data}
      onApplyCoupon={(code) => {
        return operations.execute({ code, kind: 'apply-coupon' })
      }}
      onDelete={(itemId) => {
        void operations.execute({ itemId, kind: 'delete' })
      }}
      onRemoveCoupon={() => {
        return operations.execute({ kind: 'remove-coupon' })
      }}
      onUpdate={(itemId, quantity) => {
        return operations.execute({ itemId, kind: 'update', quantity })
      }}
      operationState={operationState}
    />
  )
}
