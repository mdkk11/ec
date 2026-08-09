'use client'

import {
  CancelledError,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import Link from 'next/link'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/button/Button'
import {
  createAdminProductRequestSchema,
  updateAdminProductStockRequestSchema,
  type AdminProductDto,
  type UpdateAdminProductRequest,
} from '@/contracts/product'
import { useSession } from '@/features/auth/SessionProvider'
import {
  getAdminProducts,
  updateAdminProduct,
  updateAdminProductStock,
} from '@/lib/api-client/admin-product'
import { ApiClientError } from '@/lib/api-client/request-json'

import {
  AdminProductForm,
  type AdminProductFieldErrors,
  type AdminProductFormField,
  type AdminProductFormValues,
} from './AdminProductForm'
import {
  AdminLoginRequired,
  AdminProductStatusPage,
} from './AdminProductStatusPage'
import {
  adminProductsQueryKey,
  replaceAdminProduct,
} from './admin-product-query'

type PendingOperation = 'metadata' | 'refresh' | 'stock' | null
type ConflictState = {
  latest: AdminProductDto | null
  refreshFailed: boolean
}

function valuesFromProduct(product: AdminProductDto): AdminProductFormValues {
  return {
    description: product.description,
    imagePath: product.imagePath,
    isPublished: product.isPublished,
    name: product.name,
    price: String(product.price),
    stock: String(product.stock),
  }
}

function collectMetadataErrors(error: {
  issues: { message: string; path: PropertyKey[] }[]
}) {
  const errors: AdminProductFieldErrors = {}
  for (const issue of error.issues) {
    const field = issue.path[0]
    if (
      field !== 'name' &&
      field !== 'description' &&
      field !== 'price' &&
      field !== 'imagePath' &&
      field !== 'isPublished'
    ) continue
    errors[field] ??= []
    errors[field]?.push(issue.message)
  }
  return errors
}

function focusFirstMetadataError(errors: AdminProductFieldErrors) {
  const first = ['name', 'description', 'price', 'imagePath'].find(
    (field) => errors[field as AdminProductFormField],
  )
  if (first) document.getElementById(`edit-product-${first}`)?.focus()
}

function parseMetadata(values: AdminProductFormValues) {
  return createAdminProductRequestSchema.safeParse({
    ...values,
    price: values.price.trim() === '' ? Number.NaN : Number(values.price),
    stock: 0,
  })
}

function metadataChanges(
  product: AdminProductDto,
  values: AdminProductFormValues,
): Omit<UpdateAdminProductRequest, 'expectedVersion'> {
  const changes: Omit<UpdateAdminProductRequest, 'expectedVersion'> = {}
  const price = Number(values.price)
  if (values.name !== product.name) changes.name = values.name
  if (values.description !== product.description) {
    changes.description = values.description
  }
  if (price !== product.price) changes.price = price
  if (values.imagePath !== product.imagePath) changes.imagePath = values.imagePath
  if (values.isPublished !== product.isPublished) {
    changes.isPublished = values.isPublished
  }
  return changes
}

export function AdminProductEditPage({ productId }: { productId: string }) {
  const queryClient = useQueryClient()
  const { setAnonymous, state: sessionState } = useSession()
  const adminId =
    sessionState.status === 'authenticated' && sessionState.user.role === 'admin'
      ? sessionState.user.id
      : null
  const queryKey = adminProductsQueryKey(adminId ?? 'disabled')
  const runningRef = useRef(false)
  const queryGenerationRef = useRef(0)
  const query = useQuery({
    enabled: adminId !== null,
    queryFn: async ({ signal }) => {
      const generation = queryGenerationRef.current
      const startedDuringMutation = runningRef.current
      try {
        const { items } = await getAdminProducts(signal)
        if (
          startedDuringMutation ||
          queryGenerationRef.current !== generation
        ) {
          throw new CancelledError()
        }
        return items
      } catch (error) {
        if (
          startedDuringMutation ||
          queryGenerationRef.current !== generation
        ) {
          throw new CancelledError()
        }
        throw error
      }
    },
    queryKey,
  })
  const product = query.data?.find((item) => item.id === productId) ?? null
  const [values, setValues] = useState<AdminProductFormValues | null>(null)
  const [fieldErrors, setFieldErrors] = useState<AdminProductFieldErrors>({})
  const [stockError, setStockError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingOperation>(null)
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const initializedProductRef = useRef<string | null>(null)
  const revisionRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => {
    revisionRef.current += 1
    queryGenerationRef.current += 1
    controllerRef.current?.abort()
  }, [])

  useEffect(() => {
    if (product && initializedProductRef.current !== product.id) {
      initializedProductRef.current = product.id
      setValues(valuesFromProduct(product))
    }
  }, [product])

  useEffect(() => {
    if (query.error instanceof ApiClientError && query.error.status === 401) {
      setAnonymous()
    }
  }, [query.error, setAnonymous])

  function handleChange(field: AdminProductFormField, value: boolean | string) {
    setValues((current) => current ? { ...current, [field]: value } : current)
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    if (field === 'stock') setStockError(null)
  }

  function beginOperation(kind: Exclude<PendingOperation, null>) {
    const revision = revisionRef.current + 1
    revisionRef.current = revision
    runningRef.current = true
    queryGenerationRef.current += 1
    setPending(kind)
    setOperationError(null)
    setStatusMessage(null)
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    return { controller, revision }
  }

  function finishOperation(revision: number) {
    if (revisionRef.current !== revision) return
    runningRef.current = false
    setPending(null)
  }

  async function loadConflictLatest(revision: number) {
    await queryClient.cancelQueries({ queryKey })
    if (revisionRef.current !== revision) return
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const { items } = await getAdminProducts(controller.signal)
      if (revisionRef.current !== revision) return
      queryClient.setQueryData(queryKey, items)
      setConflict({
        latest: items.find((item) => item.id === productId) ?? null,
        refreshFailed: false,
      })
    } catch (error) {
      if (revisionRef.current !== revision) return
      if (error instanceof ApiClientError && error.status === 401) {
        setAnonymous()
        return
      }
      setConflict({ latest: null, refreshFailed: true })
      setOperationError(
        '競合を検出しましたが、最新の商品を取得できませんでした。入力内容は保持されています。',
      )
    }
  }

  function applySuccessfulProduct(
    updated: AdminProductDto,
    current: AdminProductDto,
    kind: 'metadata' | 'stock',
  ) {
    queryClient.setQueryData(queryKey, (items: typeof query.data) =>
      replaceAdminProduct(items, updated),
    )
    setValues((draft) => {
      if (!draft) return valuesFromProduct(updated)
      if (kind === 'metadata') {
        return {
          ...draft,
          description: updated.description,
          imagePath: updated.imagePath,
          isPublished: updated.isPublished,
          name: updated.name,
          price: String(updated.price),
          stock:
            draft.stock === String(current.stock)
              ? String(updated.stock)
              : draft.stock,
        }
      }
      return { ...draft, stock: String(updated.stock) }
    })
  }

  async function handleMetadataSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!product || !values || runningRef.current || conflict) return

    const parsed = parseMetadata(values)
    if (!parsed.success) {
      const errors = collectMetadataErrors(parsed.error)
      setFieldErrors(errors)
      focusFirstMetadataError(errors)
      return
    }
    const changes = metadataChanges(product, values)
    if (Object.keys(changes).length === 0) return

    const { controller, revision } = beginOperation('metadata')
    setFieldErrors({})
    await queryClient.cancelQueries({ queryKey })
    try {
      const { product: updated } = await updateAdminProduct(
        product.id,
        { ...changes, expectedVersion: product.version },
        controller.signal,
      )
      if (revisionRef.current !== revision) return
      applySuccessfulProduct(updated, product, 'metadata')
      setStatusMessage('商品情報を更新しました。')
    } catch (error) {
      if (revisionRef.current !== revision) return
      if (error instanceof ApiClientError && error.status === 401) {
        setAnonymous()
        return
      }
      if (error instanceof ApiClientError && error.code === 'VERSION_CONFLICT') {
        await loadConflictLatest(revision)
        return
      }
      if (error instanceof ApiClientError && error.fieldErrors) {
        setFieldErrors(error.fieldErrors as AdminProductFieldErrors)
      }
      setOperationError(
        error instanceof ApiClientError
          ? error.message
          : '商品情報を更新できませんでした。もう一度お試しください。',
      )
    } finally {
      finishOperation(revision)
    }
  }

  async function handleStockSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!product || !values || runningRef.current || conflict) return

    const parsed = updateAdminProductStockRequestSchema.safeParse({
      expectedVersion: product.version,
      stock: values.stock.trim() === '' ? Number.NaN : Number(values.stock),
    })
    if (!parsed.success) {
      const issue = parsed.error.issues.find((candidate) => candidate.path[0] === 'stock')
      setStockError(issue?.message ?? '在庫数を確認してください。')
      document.getElementById('edit-product-stock')?.focus()
      return
    }
    if (parsed.data.stock === product.stock) return

    const { controller, revision } = beginOperation('stock')
    setStockError(null)
    await queryClient.cancelQueries({ queryKey })
    try {
      const { product: updated } = await updateAdminProductStock(
        product.id,
        parsed.data,
        controller.signal,
      )
      if (revisionRef.current !== revision) return
      applySuccessfulProduct(updated, product, 'stock')
      setStatusMessage('在庫数を更新しました。')
    } catch (error) {
      if (revisionRef.current !== revision) return
      if (error instanceof ApiClientError && error.status === 401) {
        setAnonymous()
        return
      }
      if (error instanceof ApiClientError && error.code === 'VERSION_CONFLICT') {
        await loadConflictLatest(revision)
        return
      }
      if (error instanceof ApiClientError && error.fieldErrors?.stock?.[0]) {
        setStockError(error.fieldErrors.stock[0])
      }
      setOperationError(
        error instanceof ApiClientError
          ? error.message
          : '在庫数を更新できませんでした。もう一度お試しください。',
      )
    } finally {
      finishOperation(revision)
    }
  }

  async function retryConflictRefresh() {
    if (runningRef.current) return
    const { revision } = beginOperation('refresh')
    await loadConflictLatest(revision)
    finishOperation(revision)
  }

  function acceptLatest() {
    if (!conflict?.latest) return
    setValues(valuesFromProduct(conflict.latest))
    setFieldErrors({})
    setStockError(null)
    setOperationError(null)
    setConflict(null)
    setStatusMessage('最新値を反映しました。変更内容を確認してください。')
  }

  if (sessionState.status === 'loading') {
    return <AdminProductStatusPage role="status" title="認証状態を確認しています">しばらくお待ちください。</AdminProductStatusPage>
  }
  if (sessionState.status === 'error') {
    return <AdminProductStatusPage action={() => window.location.reload()} role="alert" title="認証状態を確認できませんでした">時間をおいてもう一度お試しください。</AdminProductStatusPage>
  }
  if (sessionState.status === 'anonymous') return <AdminLoginRequired />
  if (sessionState.user.role !== 'admin') {
    return <AdminProductStatusPage title="商品管理を利用できません">この画面は管理者専用です。</AdminProductStatusPage>
  }
  if (query.isPending) {
    return <AdminProductStatusPage role="status" title="商品を読み込んでいます">しばらくお待ちください。</AdminProductStatusPage>
  }
  if (!query.data) {
    return <AdminProductStatusPage action={() => void query.refetch()} role="alert" title="商品を読み込めませんでした">時間をおいてもう一度お試しください。</AdminProductStatusPage>
  }
  if (!product || !values) {
    return (
      <AdminProductStatusPage title="商品が見つかりませんでした">
        <Link className="button-secondary mt-4" href="/admin/products">商品管理へ戻る</Link>
      </AdminProductStatusPage>
    )
  }

  const changes = metadataChanges(product, values)
  const metadataUnchanged = Object.keys(changes).length === 0
  const stockUnchanged = values.stock === String(product.stock)
  const blocked = conflict !== null

  return (
    <section className="page-wrap py-12 sm:py-16 lg:py-20">
      <Link className="text-sm underline underline-offset-4" href="/admin/products">商品管理へ戻る</Link>
      <p className="label mt-8 text-accent">ADMINISTRATION</p>
      <h1 className="mt-4 font-serif text-4xl sm:text-5xl">{product.name}</h1>
      <p className="mt-3 text-sm text-muted">version {product.version}</p>

      {conflict?.refreshFailed ? (
        <section className="mt-8 border border-accent bg-[#fff8f5] p-5" role="alert">
          <h2 className="font-serif text-2xl">最新値を取得できませんでした</h2>
          <p className="mt-2 text-sm leading-6 text-muted">入力内容は保持しています。最新値を取得するまで更新は送信できません。</p>
          <Button className="mt-5" disabled={pending !== null} onClick={() => void retryConflictRefresh()} variant="secondary">
            最新値を再取得
          </Button>
        </section>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          <h2 className="font-serif text-3xl">商品情報と公開状態</h2>
          <div className="mt-6">
            <AdminProductForm
              blocked={blocked}
              conflictProduct={conflict?.latest}
              errorMessage={operationError}
              fieldErrors={fieldErrors}
              idPrefix="edit-product"
              mode="edit"
              onAcceptLatest={acceptLatest}
              onChange={handleChange}
              onSubmit={(event) => void handleMetadataSubmit(event)}
              pending={pending === 'metadata' || pending === 'refresh'}
              statusMessage={statusMessage}
              submitDisabled={metadataUnchanged || pending !== null}
              values={values}
            />
          </div>
        </section>

        <section>
          <h2 className="font-serif text-3xl">在庫</h2>
          <form
            aria-busy={pending === 'stock'}
            className="mt-6 border border-line bg-surface p-6"
            noValidate
            onSubmit={(event) => void handleStockSubmit(event)}
          >
            <label className="text-sm font-semibold" htmlFor="edit-product-stock">在庫数</label>
            <input
              aria-describedby={stockError ? 'edit-product-stock-error' : undefined}
              aria-invalid={stockError ? true : undefined}
              className="mt-2 min-h-12 w-full border border-line bg-surface px-4 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20 disabled:bg-canvas disabled:text-muted"
              disabled={blocked || pending !== null}
              id="edit-product-stock"
              inputMode="numeric"
              min={0}
              onChange={(event) => handleChange('stock', event.target.value)}
              step={1}
              type="number"
              value={values.stock}
            />
            {stockError ? <p className="mt-2 text-sm text-accent" id="edit-product-stock-error" role="alert">{stockError}</p> : null}
            <p className="mt-4 text-sm leading-6 text-muted">注文や取消でも商品versionが更新されます。</p>
            <Button className="mt-6 w-full" disabled={blocked || pending !== null || stockUnchanged} type="submit">
              {pending === 'stock' ? '在庫を更新しています…' : '在庫を更新'}
            </Button>
          </form>
        </section>
      </div>
    </section>
  )
}
