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

const initialCheckoutFeedback = {
  confirmationRequired: false,
  errorMessage: null as string | null,
  message: null as string | null,
  refreshFailed: false,
}

export function CartPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const {
    refresh,
    setAnonymous,
    state: sessionState,
  } = useSession()
  const operations = useCartOperations()
  const [checkoutFeedback, setCheckoutFeedback] = useState(
    initialCheckoutFeedback,
  )
  const [checkoutPending, setCheckoutPending] = useState(false)
  const [checkoutRefreshPending, setCheckoutRefreshPending] =
    useState(false)
  const customerId =
    sessionState.status === 'authenticated' &&
    sessionState.user.role === 'customer'
      ? sessionState.user.id
      : null
  const checkoutAbortRef = useRef<AbortController | null>(null)
  const checkoutRunningRef = useRef(false)
  const currentCustomerRef = useRef(customerId)
  const mountedRef = useRef(false)
  const query = useQuery({
    enabled: customerId !== null,
    queryFn: ({ signal }) => getCart(signal).then(({ cart }) => cart),
    queryKey: cartQueryKey(customerId ?? 'disabled'),
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

  useEffect(() => {
    if (currentCustomerRef.current !== customerId) {
      checkoutAbortRef.current?.abort()
      checkoutAbortRef.current = null
      checkoutRunningRef.current = false
      setCheckoutPending(false)
      setCheckoutRefreshPending(false)
      setCheckoutFeedback(initialCheckoutFeedback)
    }
    currentCustomerRef.current = customerId
  }, [customerId])

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

  const refreshCartAfterCheckoutError = async (
    requestCustomerId: string,
  ) => {
    setCheckoutRefreshPending(true)
    const result = await query.refetch()
    if (
      !mountedRef.current ||
      currentCustomerRef.current !== requestCustomerId
    ) {
      return
    }

    if (
      result.error instanceof ApiClientError &&
      result.error.status === 401
    ) {
      queryClient.removeQueries({
        queryKey: cartQueryKey(requestCustomerId),
      })
      setAnonymous()
      return
    }
    setCheckoutFeedback((current) => ({
      ...current,
      confirmationRequired: result.isError
        ? current.confirmationRequired
        : false,
      errorMessage:
        !result.isError && current.confirmationRequired
          ? null
          : current.errorMessage,
      message:
        !result.isError && current.confirmationRequired
          ? '最新のカートを取得しました。注文履歴も確認してから、もう一度お試しください。'
          : current.message,
      refreshFailed: result.isError,
    }))
    setCheckoutRefreshPending(false)
  }

  const handleCheckout = async (checkoutToken: string) => {
    if (
      !customerId ||
      checkoutRunningRef.current ||
      operations.state.pending.length > 0 ||
      query.data?.checkoutToken !== checkoutToken
    ) {
      return
    }

    const requestCustomerId = customerId
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
      if (
        !mountedRef.current ||
        currentCustomerRef.current !== requestCustomerId
      ) {
        return
      }

      queryClient.removeQueries({
        queryKey: cartQueryKey(requestCustomerId),
      })
      router.push(`/orders/${order.id}/complete`)
    } catch (error) {
      if (
        !mountedRef.current ||
        currentCustomerRef.current !== requestCustomerId
      ) {
        return
      }

      if (error instanceof ApiClientError && error.status === 401) {
        queryClient.removeQueries({
          queryKey: cartQueryKey(requestCustomerId),
        })
        setAnonymous()
        return
      }

      if (
        error instanceof ApiClientError &&
        (error.code === 'CHECKOUT_CHANGED' ||
          error.code === 'STOCK_CONFLICT' ||
          error.code === 'EMPTY_CART')
      ) {
        const message =
          error.code === 'STOCK_CONFLICT'
            ? '在庫が変更されました。最新のカートを確認し、数量を調整してください。'
            : error.code === 'EMPTY_CART'
              ? 'カートの内容が変更されました。最新の状態を確認してください。'
              : '注文内容が変更されました。最新の内容を確認し、もう一度注文を確定してください。'
        setCheckoutFeedback({
          confirmationRequired: false,
          errorMessage: null,
          message,
          refreshFailed: false,
        })
        await refreshCartAfterCheckoutError(requestCustomerId)
        return
      }

      const confirmationRequired =
        error instanceof ApiClientError &&
        (error.kind === 'network' || error.kind === 'invalid_response')
      setCheckoutFeedback({
        confirmationRequired,
        errorMessage: confirmationRequired
          ? '注文結果を確認できませんでした。注文履歴または最新のカートを確認してから、もう一度お試しください。'
          : error instanceof ApiClientError
            ? error.message
            : '注文を確定できませんでした。時間をおいてもう一度お試しください。',
        message: null,
        refreshFailed: false,
      })
    } finally {
      if (checkoutAbortRef.current === controller) {
        checkoutAbortRef.current = null
      }
      if (
        mountedRef.current &&
        currentCustomerRef.current === requestCustomerId
      ) {
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
      onRefreshCart={() =>
        customerId ? refreshCartAfterCheckoutError(customerId) : undefined
      }
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
