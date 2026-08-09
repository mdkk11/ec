import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import type { AdminProductDto } from '@/contracts/product'
import {
  SessionProvider,
  type SessionState,
} from '@/features/auth/SessionProvider'
import { server } from '@/test/msw/server'

import { AdminProductEditPage } from './AdminProductEditPage'
import { AdminProductsPage } from './AdminProductsPage'
import { adminProductsQueryKey } from './admin-product-query'

const admin = {
  email: 'admin@example.test',
  id: '20000000-0000-4000-8000-000000000001',
  role: 'admin' as const,
}
const customer = {
  email: 'customer@example.test',
  id: '10000000-0000-4000-8000-000000000001',
  role: 'customer' as const,
}
const adminState: SessionState = { status: 'authenticated', user: admin }

const product: AdminProductDto = {
  availability: 'in_stock',
  description: '管理画面テスト用の商品です。',
  id: '30000000-0000-4000-8000-000000000001',
  imagePath: '/images/fixtures/product-placeholder.svg',
  isPublished: true,
  name: '管理テスト商品',
  price: 12_100,
  stock: 8,
  version: 1,
}

function renderWithProviders(
  children: ReactNode,
  initialSessionState: SessionState = adminState,
) {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <SessionProvider initialState={initialSessionState}>
          {children}
        </SessionProvider>
      </QueryClientProvider>,
    ),
  }
}

function listResponse(items: AdminProductDto[]) {
  return HttpResponse.json({ items })
}

describe('管理商品一覧・作成', () => {
  it('管理者へ公開・非公開を含む一覧と編集導線を表示する', async () => {
    server.use(http.get('/api/admin/products', () => listResponse([product])))
    renderWithProviders(<AdminProductsPage />)

    expect(await screen.findByRole('heading', { name: '商品管理' })).toBeVisible()
    expect(screen.getByText('管理テスト商品')).toBeVisible()
    expect(screen.getByText(/在庫 8.*version 1/u)).toBeVisible()
    expect(screen.getByRole('link', { name: '編集する' })).toHaveAttribute(
      'href',
      `/admin/products/${product.id}`,
    )
  })

  it('空状態と作成フォームを同時に表示する', async () => {
    server.use(http.get('/api/admin/products', () => listResponse([])))
    renderWithProviders(<AdminProductsPage />)

    expect(await screen.findByText('商品はまだありません')).toBeVisible()
    expect(screen.getByRole('button', { name: '商品を作成' })).toBeEnabled()
  })

  it('一覧取得中は支援技術へloading状態を伝える', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    server.use(
      http.get('/api/admin/products', async () => {
        await gate
        return listResponse([])
      }),
    )
    renderWithProviders(<AdminProductsPage />)

    expect(screen.getByRole('status')).toHaveTextContent('商品を読み込んでいます')
    release?.()
    expect(await screen.findByText('商品はまだありません')).toBeVisible()
  })

  it('network errorを表示し、再試行後に一覧を表示する', async () => {
    server.use(http.get('/api/admin/products', () => HttpResponse.error()))
    renderWithProviders(<AdminProductsPage />)

    expect(
      await screen.findByRole('heading', { name: '商品を読み込めませんでした' }),
    ).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('サーバーへ接続できませんでした')

    server.use(http.get('/api/admin/products', () => listResponse([product])))
    await userEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(await screen.findByText('管理テスト商品')).toBeVisible()
  })

  it('500を再試行可能な取得エラーとして表示する', async () => {
    server.use(
      http.get('/api/admin/products', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '商品を取得できませんでした。' },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<AdminProductsPage />)

    expect(
      await screen.findByRole('heading', { name: '商品を読み込めませんでした' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: '再試行' })).toBeEnabled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      '時間をおいてもう一度お試しください',
    )
  })

  it('ADMIN-002: 負数・小数をfield errorにし、HTTP送信せず最初の項目へfocusする', async () => {
    let createCount = 0
    server.use(
      http.get('/api/admin/products', () => listResponse([])),
      http.post('/api/admin/products', () => {
        createCount += 1
        return HttpResponse.json({ product }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)
    await screen.findByText('商品はまだありません')

    await user.type(screen.getByLabelText('商品名'), '入力エラー商品')
    await user.type(screen.getByLabelText('商品説明'), '入力エラーの確認です。')
    await user.clear(screen.getByLabelText('価格（円）'))
    await user.type(screen.getByLabelText('価格（円）'), '-1')
    await user.clear(screen.getByLabelText('在庫数'))
    await user.type(screen.getByLabelText('在庫数'), '1.5')
    await user.click(screen.getByRole('button', { name: '商品を作成' }))

    expect(createCount).toBe(0)
    expect(screen.getByLabelText('価格（円）')).toHaveFocus()
    expect(screen.getByText('価格は0以上で入力してください。')).toBeVisible()
    expect(screen.getByText('在庫数は整数で入力してください。')).toBeVisible()
  })

  it('ADMIN-001: 送信中の重複操作を防ぎ、作成商品を一覧へ追加する', async () => {
    let requestCount = 0
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    const created = { ...product, id: '30000000-0000-4000-8000-000000000099', isPublished: false, name: '新しい管理商品', stock: 2 }
    server.use(
      http.get('/api/admin/products', () => listResponse([product])),
      http.post('/api/admin/products', async () => {
        requestCount += 1
        await gate
        return HttpResponse.json({ product: created }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)
    await screen.findByText('管理テスト商品')

    await user.type(screen.getByLabelText('商品名'), created.name)
    await user.type(screen.getByLabelText('商品説明'), created.description)
    await user.clear(screen.getByLabelText('価格（円）'))
    await user.type(screen.getByLabelText('価格（円）'), String(created.price))
    await user.clear(screen.getByLabelText('在庫数'))
    await user.type(screen.getByLabelText('在庫数'), String(created.stock))
    const submit = screen.getByRole('button', { name: '商品を作成' })
    await user.click(submit)
    expect(submit).toBeDisabled()
    expect(requestCount).toBe(1)

    release?.()
    expect(await screen.findByText('新しい管理商品')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('作成しました')
    expect(requestCount).toBe(1)
  })

  it('未認証・customerでは管理APIを呼ばない', async () => {
    let requestCount = 0
    server.use(http.get('/api/admin/products', () => {
      requestCount += 1
      return listResponse([product])
    }))

    const anonymousView = renderWithProviders(
      <AdminProductsPage />,
      { status: 'anonymous' },
    )
    expect(screen.getByText('商品管理にはログインが必要です')).toBeVisible()
    anonymousView.unmount()

    renderWithProviders(
      <AdminProductsPage />,
      { status: 'authenticated', user: customer },
    )
    expect(screen.getByText('この画面は管理者専用です。')).toBeVisible()
    expect(requestCount).toBe(0)
  })
})

describe('管理商品編集・在庫', () => {
  it('商品情報を変更fieldだけで更新する', async () => {
    let requestBody: unknown
    const updated = { ...product, name: '更新済み商品', version: 2 }
    server.use(
      http.get('/api/admin/products', () => listResponse([product])),
      http.patch('/api/admin/products/:productId', async ({ request }) => {
        requestBody = await request.json()
        return HttpResponse.json({ product: updated })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductEditPage productId={product.id} />)

    const nameInput = await screen.findByLabelText('商品名')
    await user.clear(nameInput)
    await user.type(nameInput, updated.name)
    await user.click(screen.getByRole('button', { name: '商品情報を更新' }))

    expect(await screen.findByRole('status')).toHaveTextContent('更新しました')
    expect(requestBody).toEqual({ expectedVersion: 1, name: updated.name })
    expect(screen.getByText('version 2')).toBeVisible()
  })

  it('在庫更新後のversionを共有し、未送信の商品情報を保持する', async () => {
    const stockUpdated = { ...product, stock: 10, version: 2 }
    const metadataUpdated = {
      ...stockUpdated,
      name: '在庫更新前から入力中の商品名',
      version: 3,
    }
    let metadataRequest: unknown
    server.use(
      http.get('/api/admin/products', () => listResponse([product])),
      http.patch('/api/admin/products/:productId/stock', () =>
        HttpResponse.json({ product: stockUpdated }),
      ),
      http.patch('/api/admin/products/:productId', async ({ request }) => {
        metadataRequest = await request.json()
        return HttpResponse.json({ product: metadataUpdated })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductEditPage productId={product.id} />)

    const nameInput = await screen.findByLabelText('商品名')
    await user.clear(nameInput)
    await user.type(nameInput, metadataUpdated.name)
    const stockInput = screen.getByLabelText('在庫数')
    await user.clear(stockInput)
    await user.type(stockInput, '10')
    await user.click(screen.getByRole('button', { name: '在庫を更新' }))

    expect(await screen.findByText('version 2')).toBeVisible()
    expect(nameInput).toHaveValue(metadataUpdated.name)
    await user.click(screen.getByRole('button', { name: '商品情報を更新' }))

    expect(await screen.findByText('version 3')).toBeVisible()
    expect(metadataRequest).toEqual({
      expectedVersion: 2,
      name: metadataUpdated.name,
    })
  })

  it('ADMIN-005: 在庫競合で入力を保持し、最新値の明示反映まで更新を停止する', async () => {
    const latest = { ...product, stock: 4, version: 2 }
    let listCount = 0
    server.use(
      http.get('/api/admin/products', () => {
        listCount += 1
        return listResponse(listCount === 1 ? [product] : [latest])
      }),
      http.patch('/api/admin/products/:productId/stock', () =>
        HttpResponse.json(
          { code: 'VERSION_CONFLICT', message: '競合しました。' },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductEditPage productId={product.id} />)

    const stockInput = await screen.findByLabelText('在庫数')
    await user.clear(stockInput)
    await user.type(stockInput, '10')
    await user.click(screen.getByRole('button', { name: '在庫を更新' }))

    expect(await screen.findByText('最新の商品情報を確認してください')).toBeVisible()
    expect(stockInput).toHaveValue(10)
    expect(screen.getByText('version 2')).toBeVisible()
    expect(screen.getByRole('button', { name: '在庫を更新' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '最新値をフォームへ反映' }))
    expect(stockInput).toHaveValue(4)
    expect(screen.queryByText('最新の商品情報を確認してください')).not.toBeInTheDocument()
  })

  it('ADMIN-004: 商品情報の競合でも入力を保持して最新値の確認を求める', async () => {
    const latest = { ...product, name: '別の管理者による商品名', version: 2 }
    let listCount = 0
    server.use(
      http.get('/api/admin/products', () => {
        listCount += 1
        return listResponse(listCount === 1 ? [product] : [latest])
      }),
      http.patch('/api/admin/products/:productId', () =>
        HttpResponse.json(
          { code: 'VERSION_CONFLICT', message: '競合しました。' },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductEditPage productId={product.id} />)

    const nameInput = await screen.findByLabelText('商品名')
    await user.clear(nameInput)
    await user.type(nameInput, '入力中の商品名')
    await user.click(screen.getByRole('button', { name: '商品情報を更新' }))

    expect(await screen.findByText('最新の商品情報を確認してください')).toBeVisible()
    expect(nameInput).toHaveValue('入力中の商品名')
    expect(screen.getAllByText('別の管理者による商品名')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: '最新値をフォームへ反映' }))
    expect(nameInput).toHaveValue('別の管理者による商品名')
  })

  it('古いbackground GETがmutation成功後のcacheとversionを巻き戻さない', async () => {
    let listCount = 0
    let releaseOld: (() => void) | undefined
    const oldGate = new Promise<void>((resolve) => { releaseOld = resolve })
    const updated = { ...product, name: '最新の商品名', version: 2 }
    server.use(
      http.get('/api/admin/products', async () => {
        listCount += 1
        if (listCount === 2) await oldGate
        return listResponse([product])
      }),
      http.patch('/api/admin/products/:productId', () =>
        HttpResponse.json({ product: updated }),
      ),
    )
    const user = userEvent.setup()
    const { client } = renderWithProviders(
      <AdminProductEditPage productId={product.id} />,
    )
    const nameInput = await screen.findByLabelText('商品名')

    const background = client.refetchQueries({
      queryKey: adminProductsQueryKey(admin.id),
    })
    await waitFor(() => expect(listCount).toBe(2))
    await user.clear(nameInput)
    await user.type(nameInput, updated.name)
    await user.click(screen.getByRole('button', { name: '商品情報を更新' }))
    expect(await screen.findByText('version 2')).toBeVisible()

    releaseOld?.()
    await background
    await waitFor(() => {
      const cached = client.getQueryData<AdminProductDto[]>(
        adminProductsQueryKey(admin.id),
      )
      expect(cached?.[0]).toMatchObject({ name: updated.name, version: 2 })
    })
  })

  it('mutation中に開始した古いGETも成功後のcacheを巻き戻さない', async () => {
    let listCount = 0
    let releaseMutation: (() => void) | undefined
    let releaseBackground: (() => void) | undefined
    const mutationGate = new Promise<void>((resolve) => {
      releaseMutation = resolve
    })
    const backgroundGate = new Promise<void>((resolve) => {
      releaseBackground = resolve
    })
    const updated = { ...product, name: 'mutation後の最新商品', version: 2 }
    server.use(
      http.get('/api/admin/products', async () => {
        listCount += 1
        if (listCount === 2) await backgroundGate
        return listResponse([product])
      }),
      http.patch('/api/admin/products/:productId', async () => {
        await mutationGate
        return HttpResponse.json({ product: updated })
      }),
    )
    const user = userEvent.setup()
    const { client } = renderWithProviders(
      <AdminProductEditPage productId={product.id} />,
    )
    const nameInput = await screen.findByLabelText('商品名')
    await user.clear(nameInput)
    await user.type(nameInput, updated.name)
    await user.click(screen.getByRole('button', { name: '商品情報を更新' }))

    const background = client.refetchQueries({
      queryKey: adminProductsQueryKey(admin.id),
    })
    await waitFor(() => expect(listCount).toBe(2))
    releaseMutation?.()
    expect(await screen.findByText('version 2')).toBeVisible()

    releaseBackground?.()
    await background
    await waitFor(() => {
      const cached = client.getQueryData<AdminProductDto[]>(
        adminProductsQueryKey(admin.id),
      )
      expect(cached?.[0]).toMatchObject({
        name: updated.name,
        version: 2,
      })
    })
  })

  it('409回復中の401ではログイン導線へ戻る', async () => {
    let listCount = 0
    server.use(
      http.get('/api/admin/products', () => {
        listCount += 1
        return listCount === 1
          ? listResponse([product])
          : HttpResponse.json(
              { code: 'UNAUTHENTICATED', message: 'ログインが必要です。' },
              { status: 401 },
            )
      }),
      http.patch('/api/admin/products/:productId/stock', () =>
        HttpResponse.json(
          { code: 'VERSION_CONFLICT', message: '競合しました。' },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductEditPage productId={product.id} />)

    const stockInput = await screen.findByLabelText('在庫数')
    await user.clear(stockInput)
    await user.type(stockInput, '10')
    await user.click(screen.getByRole('button', { name: '在庫を更新' }))

    expect(
      await screen.findByText('商品管理にはログインが必要です'),
    ).toBeVisible()
  })
})
