'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import type { OrderDto, OrderStatus } from '@/contracts/order'
import { useSession } from '@/features/auth/SessionProvider'
import {
  getAdminOrders,
  updateAdminOrderStatus,
} from '@/lib/api-client/admin-order'
import { ApiClientError } from '@/lib/api-client/request-json'

import { AdminOrderTable } from './AdminOrderTable'
import {
  AdminLoginRequired,
  AdminProductStatusPage,
} from './AdminProductStatusPage'
import { adminOrdersQueryKey, replaceAdminOrder } from './admin-order-query'
import { useAdminRequestCoordinator } from './use-admin-request-coordinator'

type ConflictState = {
  latest: OrderDto | null
  orderId: string
  requestedStatus: OrderStatus
}

export function AdminOrdersPage() {
  const queryClient = useQueryClient()
  const { setAnonymous, state: sessionState } = useSession()
  const adminId =
    sessionState.status === 'authenticated' && sessionState.user.role === 'admin'
      ? sessionState.user.id
      : null
  const queryKey = adminOrdersQueryKey(adminId ?? 'disabled')
  const requestCoordinator = useAdminRequestCoordinator()
  const query = useQuery({
    enabled: adminId !== null,
    queryFn: ({ signal }) =>
      requestCoordinator.runGuardedQuery(async () => {
        const { items } = await getAdminOrders(signal)
        return items
      }),
    queryKey,
  })
  const [selectedStatuses, setSelectedStatuses] = useState<
    Record<string, OrderStatus | undefined>
  >({})
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    if (query.error instanceof ApiClientError && query.error.status === 401) {
      setAnonymous()
    }
  }, [query.error, setAnonymous])

  async function loadConflictLatest(
    revision: number,
    orderId: string,
    requestedStatus: OrderStatus,
  ) {
    await queryClient.cancelQueries({ queryKey })
    const signal = requestCoordinator.nextOperationSignal(revision)
    if (!signal) return
    try {
      const { items } = await getAdminOrders(signal)
      if (!requestCoordinator.isCurrentOperation(revision)) return
      queryClient.setQueryData(queryKey, items)
      setConflict({
        latest: items.find((item) => item.id === orderId) ?? null,
        orderId,
        requestedStatus,
      })
    } catch (error) {
      if (!requestCoordinator.isCurrentOperation(revision)) return
      if (error instanceof ApiClientError && error.status === 401) {
        setAnonymous()
        return
      }
      setConflict({ latest: null, orderId, requestedStatus })
      setErrorMessage(
        '競合を検出しましたが、最新の注文を取得できませんでした。時間をおいて再試行してください。',
      )
    }
  }

  async function handleUpdate(orderId: string) {
    if (
      !adminId ||
      requestCoordinator.isOperationRunning() ||
      pendingOrderId ||
      conflict?.orderId === orderId
    ) return
    const requestedStatus = selectedStatuses[orderId]
    const current = query.data?.find((item) => item.id === orderId)
    if (!requestedStatus || !current) return

    const { revision, signal } = requestCoordinator.beginOperation()
    setPendingOrderId(orderId)
    setErrorMessage(null)
    setStatusMessage(null)
    await queryClient.cancelQueries({ queryKey })
    if (!requestCoordinator.isCurrentOperation(revision)) return

    try {
      const { order } = await updateAdminOrderStatus(
        orderId,
        { expectedVersion: current.version, status: requestedStatus },
        signal,
      )
      if (!requestCoordinator.isCurrentOperation(revision)) return
      queryClient.setQueryData(queryKey, (items: OrderDto[] | undefined) =>
        replaceAdminOrder(items, order),
      )
      setSelectedStatuses((items) => ({ ...items, [orderId]: undefined }))
      setStatusMessage('注文状態を更新しました。')
    } catch (error) {
      if (!requestCoordinator.isCurrentOperation(revision)) return
      if (error instanceof ApiClientError && error.status === 401) {
        setAnonymous()
        return
      }
      if (error instanceof ApiClientError && error.status === 409) {
        await loadConflictLatest(revision, orderId, requestedStatus)
      } else {
        setErrorMessage(
          error instanceof ApiClientError
            ? error.message
            : '注文状態を更新できませんでした。もう一度お試しください。',
        )
      }
    } finally {
      if (requestCoordinator.finishOperation(revision)) setPendingOrderId(null)
    }
  }

  function acknowledgeConflict() {
    if (!conflict) return
    setSelectedStatuses((items) => ({ ...items, [conflict.orderId]: undefined }))
    setConflict(null)
    setErrorMessage(null)
  }

  if (sessionState.status === 'loading') {
    return (
      <AdminProductStatusPage role="status" title="認証状態を確認しています">
        しばらくお待ちください。
      </AdminProductStatusPage>
    )
  }
  if (sessionState.status === 'error') {
    return (
      <AdminProductStatusPage
        action={() => window.location.reload()}
        role="alert"
        title="認証状態を確認できませんでした"
      >
        時間をおいてもう一度お試しください。
      </AdminProductStatusPage>
    )
  }
  if (sessionState.status === 'anonymous') {
    return <AdminLoginRequired resource="注文管理" />
  }
  if (sessionState.user.role !== 'admin') {
    return (
      <AdminProductStatusPage title="注文管理を利用できません">
        この画面は管理者専用です。
      </AdminProductStatusPage>
    )
  }

  const tableStatus = query.isPending
    ? 'loading'
    : query.data
      ? 'success'
      : 'error'

  return (
    <section className="page-wrap py-12 sm:py-16 lg:py-20">
      <p className="label text-accent">ADMINISTRATION</p>
      <h1 className="mt-4 font-serif text-4xl sm:text-5xl">注文管理</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
        注文状態を確認し、受付から順方向へ更新します。受付中または処理中の注文は取消できます。
      </p>
      {errorMessage ? (
        <p aria-live="assertive" className="mt-6 text-sm text-accent" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {statusMessage ? (
        <p aria-live="polite" className="mt-6 text-sm text-accent" role="status">
          {statusMessage}
        </p>
      ) : null}
      <div className="mt-10">
        <AdminOrderTable
          conflictLatest={conflict?.latest}
          conflictOrderId={conflict?.orderId}
          errorMessage={
            query.error instanceof ApiClientError && query.error.kind === 'network'
              ? 'サーバーへ接続できませんでした。'
              : undefined
          }
          items={query.data}
          onAcknowledgeConflict={acknowledgeConflict}
          onRetry={() => void query.refetch()}
          onSelectStatus={(orderId, status) =>
            setSelectedStatuses((items) => ({
              ...items,
              [orderId]: status || undefined,
            }))
          }
          onUpdate={(orderId) => void handleUpdate(orderId)}
          pendingOrderId={pendingOrderId}
          selectedStatuses={selectedStatuses}
          status={tableStatus}
        />
      </div>
    </section>
  )
}
