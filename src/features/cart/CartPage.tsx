'use client'

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useEffect,
  useRef,
  useState,
} from 'react'

import { Button } from '@/components/button/Button'
import { useSession } from '@/features/auth/SessionProvider'
import { getCart } from '@/lib/api-client/cart'
import { createOrder } from '@/lib/api-client/order'
import { ApiClientError } from '@/lib/api-client/request-json'

import {
  cartQueryKey,
  useCartOperations,
} from './CartOperationProvider'
import {
  CartView,
  type CartCheckoutState,
  type CartViewOperationState,
} from './CartView'
import {
  checkoutFeedbackAfterRefresh,
  decideCheckoutError,
  initialCheckoutFeedback,
} from './cartCheckoutFeedback'

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

function couponErrorMessage(error: ApiClientError) {
  switch (error.code) {
    case 'COUPON_NOT_FOUND':
      return 'クーポンが見つかりませんでした。'
    case 'COUPON_INACTIVE':
      return 'このクーポンは現在利用できません。'
    case 'COUPON_NOT_STARTED':
      return 'このクーポンはまだ利用できません。'
    case 'COUPON_EXPIRED':
      return 'このクーポンの利用期間は終了しました。'
    case 'COUPON_MINIMUM_NOT_MET':
      return 'クーポンの最低購入額に達していません。'
    default:
      return error.message
  }
}

function CustomerCartPage({ customerId }: { customerId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { setAnonymous } = useSession()
  const operations = useCartOperations()
  const [checkoutFeedback, setCheckoutFeedback] = useState(
    initialCheckoutFeedback,
  )
  const [checkoutPending, setCheckoutPending] = useState(false)
  const [checkoutRefreshPending, setCheckoutRefreshPending] =
    useState(false)
  const checkoutAbortRef = useRef<AbortController | null>(null)
  const checkoutRunningRef = useRef(false)
  const mountedRef = useRef(false)
  const query = useQuery({
    queryFn: ({ signal }) => getCart(signal).then(({ cart }) => cart),
    queryKey: cartQueryKey(customerId),
  })
  const checkoutMutation = useMutation({
    mutationFn: ({
      checkoutToken,
      signal,
    }: {
      checkoutToken: string
      signal: AbortSignal
    }) => createOrder({ checkoutToken }, signal),
    retry: false,
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      checkoutAbortRef.current?.abort()
      checkoutAbortRef.current = null
      checkoutRunningRef.current = false
    }
  }, [])

  useEffect(() => {
    if (
      query.error instanceof ApiClientError &&
      query.error.status === 401
    ) {
      setAnonymous()
    }
  }, [query.error, setAnonymous])

  if (query.isPending) {
    return (
      <StatusPage role="status" title="カートを読み込んでいます">
        しばらくお待ちください。
      </StatusPage>
    )
  }
  if (!query.data) {
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
        error instanceof ApiClientError &&
        (operation.kind === 'apply-coupon' ||
          operation.kind === 'remove-coupon')
          ? couponErrorMessage(error)
          : error instanceof Error
          ? error.message
          : '更新できませんでした。もう一度お試しください。',
      operation,
    })),
    pending: operations.state.pending.map(({ operation }) => operation),
  }
  const checkoutState: CartCheckoutState = {
    ...checkoutFeedback,
    pending: checkoutPending || checkoutRefreshPending,
  }

  const refreshCartAfterCheckoutError = async () => {
    setCheckoutRefreshPending(true)
    const result = await query.refetch()
    if (!mountedRef.current) return

    if (
      result.error instanceof ApiClientError &&
      result.error.status === 401
    ) {
      queryClient.removeQueries({
        queryKey: cartQueryKey(customerId),
      })
      setAnonymous()
      return
    }
    setCheckoutFeedback((current) =>
      checkoutFeedbackAfterRefresh(current, result.isError),
    )
    setCheckoutRefreshPending(false)
  }

  const handleCheckout = async (checkoutToken: string) => {
    if (
      checkoutRunningRef.current ||
      operations.state.pending.length > 0 ||
      query.data?.checkoutToken !== checkoutToken
    ) {
      return
    }

    const controller = new AbortController()
    checkoutAbortRef.current = controller
    checkoutRunningRef.current = true
    setCheckoutFeedback(initialCheckoutFeedback)
    setCheckoutPending(true)

    try {
      const { order } = await checkoutMutation.mutateAsync({
        checkoutToken,
        signal: controller.signal,
      })
      if (!mountedRef.current) return

      queryClient.removeQueries({
        queryKey: cartQueryKey(customerId),
      })
      router.push(`/orders/${order.id}/complete`)
    } catch (error) {
      if (!mountedRef.current) return

      const decision = decideCheckoutError(error)
      if (decision.type === 'unauthenticated') {
        queryClient.removeQueries({
          queryKey: cartQueryKey(customerId),
        })
        setAnonymous()
        return
      }
      setCheckoutFeedback(decision.feedback)
      if (decision.type === 'refresh-cart') await refreshCartAfterCheckoutError()
    } finally {
      if (checkoutAbortRef.current === controller) {
        checkoutAbortRef.current = null
      }
      if (mountedRef.current) {
        checkoutRunningRef.current = false
        setCheckoutPending(false)
      }
    }
  }

  const clearCheckoutFeedback = () => {
    setCheckoutFeedback(initialCheckoutFeedback)
  }

  return (
    <CartView
      cart={query.data}
      checkoutState={checkoutState}
      onApplyCoupon={(code) => {
        clearCheckoutFeedback()
        return operations.execute({ code, kind: 'apply-coupon' })
      }}
      onCheckout={handleCheckout}
      onDelete={(itemId) => {
        clearCheckoutFeedback()
        void operations.execute({ itemId, kind: 'delete' })
      }}
      onRefreshCart={refreshCartAfterCheckoutError}
      onRemoveCoupon={() => {
        clearCheckoutFeedback()
        return operations.execute({ kind: 'remove-coupon' })
      }}
      onUpdate={(itemId, quantity) => {
        clearCheckoutFeedback()
        return operations.execute({ itemId, kind: 'update', quantity })
      }}
      operationState={operationState}
    />
  )
}

export function CartPage() {
  const { refresh, state: sessionState } = useSession()

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

  return (
    <CustomerCartPage
      key={sessionState.user.id}
      customerId={sessionState.user.id}
    />
  )
}
