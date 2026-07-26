'use client'

import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { CartDto } from '@/contracts/cart'
import { useSession } from '@/features/auth/SessionProvider'
import {
  addCartItem,
  applyCartCoupon,
  deleteCartItem,
  removeCartCoupon,
  updateCartItem,
} from '@/lib/api-client/cart'
import { ApiClientError } from '@/lib/api-client/request-json'

export const cartQueryKey = (customerId: string) =>
  ['cart', customerId] as const

export type CartOperation =
  | { kind: 'add'; productId: string; quantity: number }
  | { code: string; kind: 'apply-coupon' }
  | { itemId: string; kind: 'delete' }
  | { kind: 'remove-coupon' }
  | { itemId: string; kind: 'update'; quantity: number }

type PendingOperation = {
  id: number
  operation: CartOperation
}

type OperationFailure = PendingOperation & {
  error: unknown
}

type OperationState = {
  errors: OperationFailure[]
  pending: PendingOperation[]
}

type CartOperationContextValue = {
  execute: (operation: CartOperation) => Promise<CartDto | null>
  state: OperationState
}

type QueueTask = PendingOperation & {
  customerId: string
  resolve: (cart: CartDto | null) => void
  sessionGeneration: number
}

const CartOperationContext =
  createContext<CartOperationContextValue | null>(null)

function operationFingerprint(operation: CartOperation) {
  return JSON.stringify(operation)
}

function operationTarget(operation: CartOperation) {
  if (operation.kind === 'add') return `product:${operation.productId}`
  if (
    operation.kind === 'apply-coupon' ||
    operation.kind === 'remove-coupon'
  ) {
    return 'coupon'
  }
  return `item:${operation.itemId}`
}

function isQueuedUpdateForSameItem(
  task: QueueTask,
  operation: CartOperation,
) {
  return (
    task.operation.kind === 'update' &&
    operation.kind === 'update' &&
    task.operation.itemId === operation.itemId
  )
}

export function CartOperationProvider({
  children,
}: {
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  const { setAnonymous, state: sessionState } = useSession()
  const [state, setState] = useState<OperationState>({
    errors: [],
    pending: [],
  })
  const controllerRef = useRef<AbortController | null>(null)
  const currentCustomerRef = useRef<string | null>(null)
  const currentTaskRef = useRef<QueueTask | null>(null)
  const nextTaskIdRef = useRef(0)
  const previousCustomerRef = useRef<string | null>(null)
  const processingRef = useRef(false)
  const queueRef = useRef<QueueTask[]>([])
  const sessionGenerationRef = useRef(0)

  const mutation = useMutation({
    mutationFn: async ({
      operation,
      signal,
    }: {
      operation: CartOperation
      signal: AbortSignal
    }) => {
      if (operation.kind === 'add') {
        return addCartItem(
          {
            productId: operation.productId,
            quantity: operation.quantity,
          },
          signal,
        )
      }
      if (operation.kind === 'update') {
        return updateCartItem(
          operation.itemId,
          { quantity: operation.quantity },
          signal,
        )
      }
      if (operation.kind === 'delete') {
        return deleteCartItem(operation.itemId, signal)
      }
      if (operation.kind === 'apply-coupon') {
        return applyCartCoupon({ code: operation.code }, signal)
      }
      return removeCartCoupon(signal)
    },
    retry: false,
  })

  const customerId =
    sessionState.status === 'authenticated' &&
    sessionState.user.role === 'customer'
      ? sessionState.user.id
      : null

  useEffect(() => {
    currentCustomerRef.current = customerId
    const previousCustomer = previousCustomerRef.current
    if (previousCustomer && previousCustomer !== customerId) {
      sessionGenerationRef.current += 1
      controllerRef.current?.abort()
      for (const task of queueRef.current) task.resolve(null)
      queueRef.current = []
      setState({ errors: [], pending: [] })
      queryClient.removeQueries({
        queryKey: cartQueryKey(previousCustomer),
      })
    }
    previousCustomerRef.current = customerId
  }, [customerId, queryClient])

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    try {
      while (queueRef.current.length > 0) {
        const task = queueRef.current.shift()
        if (!task) continue
        currentTaskRef.current = task

        if (
          task.customerId !== currentCustomerRef.current ||
          task.sessionGeneration !== sessionGenerationRef.current
        ) {
          task.resolve(null)
          setState((current) => ({
            ...current,
            pending: current.pending.filter(({ id }) => id !== task.id),
          }))
          continue
        }

        await queryClient.cancelQueries({
          queryKey: cartQueryKey(task.customerId),
        })
        const controller = new AbortController()
        controllerRef.current = controller

        try {
          const { cart } = await mutation.mutateAsync({
            operation: task.operation,
            signal: controller.signal,
          })
          if (
            task.customerId !== currentCustomerRef.current ||
            task.sessionGeneration !== sessionGenerationRef.current
          ) {
            task.resolve(null)
            continue
          }

          const current = queryClient.getQueryData<CartDto>(
            cartQueryKey(task.customerId),
          )
          if (!current || cart.version >= current.version) {
            queryClient.setQueryData(cartQueryKey(task.customerId), cart)
          } else {
            await queryClient.refetchQueries({
              queryKey: cartQueryKey(task.customerId),
              type: 'active',
            })
          }
          task.resolve(cart)
        } catch (error) {
          if (
            task.customerId !== currentCustomerRef.current ||
            task.sessionGeneration !== sessionGenerationRef.current
          ) {
            task.resolve(null)
            continue
          }

          if (error instanceof ApiClientError && error.status === 401) {
            queryClient.removeQueries({
              queryKey: cartQueryKey(task.customerId),
            })
            setAnonymous()
          }

          const hasNewerOperationForTarget = queueRef.current.some(
            ({ operation }) =>
              operationTarget(operation) ===
              operationTarget(task.operation),
          )
          if (!hasNewerOperationForTarget) {
            setState((current) => ({
              ...current,
              errors: [
                ...current.errors.filter(
                  ({ operation }) =>
                    operationTarget(operation) !==
                    operationTarget(task.operation),
                ),
                {
                  error,
                  id: task.id,
                  operation: task.operation,
                },
              ],
            }))
          }
          task.resolve(null)
        } finally {
          controllerRef.current = null
          currentTaskRef.current = null
          setState((current) => ({
            ...current,
            pending: current.pending.filter(({ id }) => id !== task.id),
          }))
        }
      }
    } finally {
      processingRef.current = false
    }
  }, [mutation, queryClient, setAnonymous])

  const execute = useCallback(
    (operation: CartOperation) => {
      if (!customerId) return Promise.resolve(null)
      const fingerprint = operationFingerprint(operation)
      const duplicateCurrent =
        currentTaskRef.current &&
        operationFingerprint(currentTaskRef.current.operation) === fingerprint
      const duplicateQueued = queueRef.current.some(
        (task) =>
          operationFingerprint(task.operation) === fingerprint,
      )
      if (duplicateCurrent || duplicateQueued) {
        return Promise.resolve(null)
      }

      return new Promise<CartDto | null>((resolve) => {
        const task: QueueTask = {
          customerId,
          id: nextTaskIdRef.current + 1,
          operation,
          resolve,
          sessionGeneration: sessionGenerationRef.current,
        }
        nextTaskIdRef.current = task.id

        const replaceIndex = queueRef.current.findIndex((queuedTask) =>
          isQueuedUpdateForSameItem(queuedTask, operation),
        )
        let replacedTask: QueueTask | undefined
        if (replaceIndex >= 0) {
          replacedTask = queueRef.current[replaceIndex]
          queueRef.current[replaceIndex] = task
          replacedTask?.resolve(null)
        } else {
          queueRef.current.push(task)
        }

        const target = operationTarget(operation)
        setState((current) => ({
          errors: current.errors.filter(
            ({ operation: failedOperation }) =>
              operationTarget(failedOperation) !== target,
          ),
          pending: [
            ...current.pending.filter(
              ({ id }) => id !== replacedTask?.id,
            ),
            { id: task.id, operation },
          ],
        }))
        void processQueue()
      })
    },
    [customerId, processQueue],
  )

  const value = useMemo(
    () => ({ execute, state }),
    [execute, state],
  )

  return (
    <CartOperationContext.Provider value={value}>
      {children}
    </CartOperationContext.Provider>
  )
}

export function useCartOperations() {
  const context = useContext(CartOperationContext)
  if (!context) {
    throw new Error(
      'useCartOperationsはCartOperationProvider内で使用してください。',
    )
  }
  return context
}
