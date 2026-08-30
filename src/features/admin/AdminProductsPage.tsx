'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'

import {
  createAdminProductRequestSchema,
  type CreateAdminProductRequest,
} from '@/contracts/product'
import { useSession } from '@/features/auth/SessionProvider'
import { createAdminProduct, getAdminProducts } from '@/lib/api-client/admin-product'
import { ApiClientError } from '@/lib/api-client/request-json'

import {
  AdminProductForm,
  type AdminProductFieldErrors,
  type AdminProductFormField,
  type AdminProductFormValues,
} from './AdminProductForm'
import { AdminProductList } from './AdminProductList'
import { AdminProductsLoadingView } from './AdminProductLoadingViews'
import { AdminLoginRequired, AdminProductStatusPage } from './AdminProductStatusPage'
import { adminProductsQueryKey } from './admin-product-query'
import { useAdminRequestCoordinator } from './use-admin-request-coordinator'

const initialValues: AdminProductFormValues = {
  categoryId: '',
  description: '',
  imagePath: '/images/fixtures/product-placeholder.svg',
  isPublished: false,
  name: '',
  price: '0',
  stock: '0',
}

function collectFieldErrors(error: { issues: { message: string; path: PropertyKey[] }[] }) {
  const errors: AdminProductFieldErrors = {}
  for (const issue of error.issues) {
    const field = issue.path[0]
    if (
      field !== 'categoryId' &&
      field !== 'name' &&
      field !== 'description' &&
      field !== 'price' &&
      field !== 'imagePath' &&
      field !== 'isPublished' &&
      field !== 'stock'
    )
      continue
    errors[field] ??= []
    errors[field]?.push(issue.message)
  }
  return errors
}

function parseValues(values: AdminProductFormValues) {
  return createAdminProductRequestSchema.safeParse({
    ...values,
    price: values.price.trim() === '' ? Number.NaN : Number(values.price),
    stock: values.stock.trim() === '' ? Number.NaN : Number(values.stock),
  })
}

function focusFirstError(errors: AdminProductFieldErrors, prefix: string) {
  const first = ['categoryId', 'name', 'description', 'price', 'stock', 'imagePath'].find(
    (field) => errors[field as AdminProductFormField],
  )
  if (first) document.getElementById(`${prefix}-${first}`)?.focus()
}

export function AdminProductsPage() {
  const queryClient = useQueryClient()
  const { setAnonymous, state: sessionState } = useSession()
  const adminId =
    sessionState.status === 'authenticated' && sessionState.user.role === 'admin'
      ? sessionState.user.id
      : null
  const queryKey = adminProductsQueryKey(adminId ?? 'disabled')
  const requestCoordinator = useAdminRequestCoordinator()
  const query = useQuery({
    enabled: adminId !== null,
    queryFn: ({ signal }) =>
      requestCoordinator.runGuardedQuery(async () => {
        const { items } = await getAdminProducts(signal)
        return items
      }),
    queryKey,
  })
  const [values, setValues] = useState(initialValues)
  const [fieldErrors, setFieldErrors] = useState<AdminProductFieldErrors>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (query.error instanceof ApiClientError && query.error.status === 401) {
      setAnonymous()
    }
  }, [query.error, setAnonymous])

  function handleChange(field: AdminProductFormField, value: boolean | string) {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!adminId || requestCoordinator.isOperationRunning()) return

    setErrorMessage(null)
    setStatusMessage(null)
    const parsed = parseValues(values)
    if (!parsed.success) {
      const errors = collectFieldErrors(parsed.error)
      setFieldErrors(errors)
      focusFirstError(errors, 'create-product')
      return
    }

    const { revision, signal } = requestCoordinator.beginOperation()
    setPending(true)
    setFieldErrors({})
    await queryClient.cancelQueries({ queryKey })
    if (!requestCoordinator.isCurrentOperation(revision)) return

    try {
      const { product } = await createAdminProduct(parsed.data as CreateAdminProductRequest, signal)
      if (!requestCoordinator.isCurrentOperation(revision)) return
      queryClient.setQueryData(queryKey, (items: typeof query.data) => [
        product,
        ...(items ?? []).filter((item) => item.id !== product.id),
      ])
      setValues(initialValues)
      setStatusMessage(`${product.name}を作成しました。`)
    } catch (error) {
      if (!requestCoordinator.isCurrentOperation(revision)) return
      if (error instanceof ApiClientError && error.status === 401) {
        setAnonymous()
        return
      }
      if (error instanceof ApiClientError && error.fieldErrors) {
        setFieldErrors(error.fieldErrors as AdminProductFieldErrors)
      }
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : '商品を作成できませんでした。もう一度お試しください。',
      )
    } finally {
      if (requestCoordinator.finishOperation(revision)) setPending(false)
    }
  }

  if (sessionState.status === 'loading') {
    return (
      <AdminProductsLoadingView statusMessage="認証状態を確認しています。しばらくお待ちください。" />
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
  if (sessionState.status === 'anonymous') return <AdminLoginRequired />
  if (sessionState.user.role !== 'admin') {
    return (
      <AdminProductStatusPage title="商品管理を利用できません">
        この画面は管理者専用です。
      </AdminProductStatusPage>
    )
  }
  if (query.isPending) {
    return (
      <AdminProductsLoadingView statusMessage="商品を読み込んでいます。しばらくお待ちください。" />
    )
  }
  if (!query.data) {
    return (
      <AdminProductStatusPage
        action={() => void query.refetch()}
        role="alert"
        title="商品を読み込めませんでした"
      >
        {query.error instanceof ApiClientError && query.error.kind === 'network'
          ? 'サーバーへ接続できませんでした。'
          : '時間をおいてもう一度お試しください。'}
      </AdminProductStatusPage>
    )
  }

  return (
    <section className="page-wrap py-12 sm:py-16 lg:py-20">
      <p className="label text-accent">ADMINISTRATION</p>
      <h1 className="mt-4 font-serif text-4xl sm:text-5xl">商品管理</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
        商品の作成、公開状態、価格と在庫を管理します。
      </p>

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,32rem)]">
        <AdminProductList items={query.data} />

        <section>
          <h2 className="font-serif text-3xl">新しい商品</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            作成時は非公開です。内容を確認してから公開できます。
          </p>
          <div className="mt-6">
            <AdminProductForm
              errorMessage={errorMessage}
              fieldErrors={fieldErrors}
              idPrefix="create-product"
              includeStock
              mode="create"
              onChange={handleChange}
              onSubmit={(event) => void handleSubmit(event)}
              pending={pending}
              statusMessage={statusMessage}
              values={values}
            />
          </div>
        </section>
      </div>
    </section>
  )
}
