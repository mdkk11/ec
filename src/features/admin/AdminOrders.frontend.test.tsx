import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import type { OrderDto } from '@/contracts/order'
import { SessionProvider, type SessionState } from '@/features/auth/SessionProvider'
import { server } from '@/test/msw/server'

import { adminOrderFixture } from './admin-order-fixtures'
import { adminOrdersQueryKey } from './admin-order-query'
import { AdminOrdersPage } from './AdminOrdersPage'

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

function renderWithProviders(children: ReactNode, initialSessionState: SessionState = adminState) {
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
        <SessionProvider initialState={initialSessionState}>{children}</SessionProvider>
      </QueryClientProvider>,
    ),
  }
}

function listResponse(items: OrderDto[]) {
  return HttpResponse.json({ items })
}

describe('管理注文一覧', () => {
  it('AUTH-014: 認証待機中は注文管理の構造と認証状態を通知する', () => {
    renderWithProviders(<AdminOrdersPage />, { status: 'loading' })

    const status = screen.getByRole('status')
    const busyRegion = document.querySelector('[aria-busy="true"]')
    expect(status).toHaveTextContent('認証状態を確認しています。しばらくお待ちください。')
    expect(busyRegion).not.toBeNull()
    expect(busyRegion).not.toContainElement(status)
    expect(screen.getByRole('heading', { name: '注文管理' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: '注文' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: '状態を更新' })).toBeVisible()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('ADMIN-006: 状態と許可された変更先を表示し更新できる', async () => {
    let updateCount = 0
    const updated = { ...adminOrderFixture, status: 'processing' as const, version: 2 }
    server.use(
      http.get('/api/admin/orders', () => listResponse([adminOrderFixture])),
      http.patch('/api/admin/orders/:orderId/status', async () => {
        updateCount += 1
        return HttpResponse.json({ order: updated })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminOrdersPage />)

    expect(await screen.findByText(adminOrderFixture.id)).toBeVisible()
    expect(screen.getByText('受付')).toBeVisible()
    const select = screen.getByLabelText(`注文 ${adminOrderFixture.id} の変更先状態`)
    await user.selectOptions(select, 'processing')
    await user.click(screen.getByRole('button', { name: '状態を更新' }))

    expect(updateCount).toBe(1)
    expect(await screen.findByRole('cell', { name: /処理中/u })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('更新しました')
  })

  it('ADMIN-011: 空状態を表示する', async () => {
    server.use(http.get('/api/admin/orders', () => listResponse([])))
    renderWithProviders(<AdminOrdersPage />)

    expect(await screen.findByText('注文はまだありません')).toBeVisible()
  })

  it('ADMIN-011: loading状態を支援技術へ通知する', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get('/api/admin/orders', async () => {
        await gate
        return listResponse([])
      }),
    )
    renderWithProviders(<AdminOrdersPage />)

    const status = screen.getByRole('status')
    const busyRegion = document.querySelector('[aria-busy="true"]')
    expect(status).toHaveTextContent('注文一覧を読み込んでいます。しばらくお待ちください。')
    expect(busyRegion).not.toBeNull()
    expect(busyRegion).not.toContainElement(status)
    expect(screen.getByRole('heading', { name: '注文管理' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: '注文' })).toBeVisible()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    release?.()
    expect(await screen.findByText('注文はまだありません')).toBeVisible()
  })

  it('APIエラーを表示し、再試行後に一覧を表示する', async () => {
    server.use(
      http.get('/api/admin/orders', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '注文を取得できませんでした。' },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<AdminOrdersPage />)

    expect(await screen.findByText('注文一覧を読み込めませんでした')).toBeVisible()
    server.use(http.get('/api/admin/orders', () => listResponse([adminOrderFixture])))
    await userEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(await screen.findByText(adminOrderFixture.id)).toBeVisible()
  })

  it('network errorを専用文言で表示する', async () => {
    server.use(http.get('/api/admin/orders', () => HttpResponse.error()))
    renderWithProviders(<AdminOrdersPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('サーバーへ接続できませんでした')
  })

  it('未認証・customerでは管理APIを呼ばない', () => {
    const anonymousState: SessionState = { status: 'anonymous' }
    const { unmount } = renderWithProviders(<AdminOrdersPage />, anonymousState)
    expect(screen.getByText('注文管理にはログインが必要です')).toBeVisible()
    unmount()

    renderWithProviders(<AdminOrdersPage />, { status: 'authenticated', user: customer })
    expect(screen.getByText('この画面は管理者専用です。')).toBeVisible()
  })
})

describe('管理注文の更新中・競合', () => {
  it('送信中の二重操作を防ぐ', async () => {
    let release: (() => void) | undefined
    let updateCount = 0
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get('/api/admin/orders', () => listResponse([adminOrderFixture])),
      http.patch('/api/admin/orders/:orderId/status', async () => {
        updateCount += 1
        await gate
        return HttpResponse.json({
          order: { ...adminOrderFixture, status: 'processing', version: 2 },
        })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminOrdersPage />)
    await screen.findByText(adminOrderFixture.id)
    await user.selectOptions(
      screen.getByLabelText(`注文 ${adminOrderFixture.id} の変更先状態`),
      'processing',
    )
    const submit = screen.getByRole('button', { name: '状態を更新' })
    await user.click(submit)
    expect(submit).toBeDisabled()
    expect(updateCount).toBe(1)
    release?.()
    expect(await screen.findByRole('cell', { name: /処理中/u })).toBeVisible()
  })

  it('ADMIN-008: 409後は最新状態を確認するまで再送しない', async () => {
    let updateCount = 0
    let listCount = 0
    const latest = { ...adminOrderFixture, status: 'processing' as const, version: 2 }
    server.use(
      http.get('/api/admin/orders', () => {
        listCount += 1
        return listResponse(listCount === 1 ? [adminOrderFixture] : [latest])
      }),
      http.patch('/api/admin/orders/:orderId/status', () => {
        updateCount += 1
        return HttpResponse.json(
          { code: 'VERSION_CONFLICT', message: '最新状態を確認してください。' },
          { status: 409 },
        )
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminOrdersPage />)
    await screen.findByText(adminOrderFixture.id)
    await user.selectOptions(
      screen.getByLabelText(`注文 ${adminOrderFixture.id} の変更先状態`),
      'processing',
    )
    await user.click(screen.getByRole('button', { name: '状態を更新' }))

    expect(await screen.findByText('最新状態を確認してください')).toBeVisible()
    expect(screen.getByText('現在は「処理中」です。')).toBeVisible()
    expect(updateCount).toBe(1)
    await user.click(screen.getByRole('button', { name: '最新状態を確認' }))
    expect(screen.getByLabelText(`注文 ${adminOrderFixture.id} の変更先状態`)).toHaveValue('')
    expect(updateCount).toBe(1)
  })

  it('更新中に開始した古いGETで成功後の状態とversionを巻き戻さない', async () => {
    let listCount = 0
    let releaseMutation: (() => void) | undefined
    let releaseBackground: (() => void) | undefined
    const mutationGate = new Promise<void>((resolve) => {
      releaseMutation = resolve
    })
    const backgroundGate = new Promise<void>((resolve) => {
      releaseBackground = resolve
    })
    const updated = {
      ...adminOrderFixture,
      status: 'processing' as const,
      version: 2,
    }
    server.use(
      http.get('/api/admin/orders', async () => {
        listCount += 1
        if (listCount === 2) await backgroundGate
        return listResponse([adminOrderFixture])
      }),
      http.patch('/api/admin/orders/:orderId/status', async () => {
        await mutationGate
        return HttpResponse.json({ order: updated })
      }),
    )
    const user = userEvent.setup()
    const { client } = renderWithProviders(<AdminOrdersPage />)
    await screen.findByText(adminOrderFixture.id)
    await user.selectOptions(
      screen.getByLabelText(`注文 ${adminOrderFixture.id} の変更先状態`),
      'processing',
    )
    await user.click(screen.getByRole('button', { name: '状態を更新' }))

    const background = client.refetchQueries({
      queryKey: adminOrdersQueryKey(admin.id),
    })
    await waitFor(() => expect(listCount).toBe(2))
    releaseMutation?.()
    expect(await screen.findByRole('cell', { name: /処理中/u })).toBeVisible()

    releaseBackground?.()
    await background
    await waitFor(() => {
      const cached = client.getQueryData<OrderDto[]>(adminOrdersQueryKey(admin.id))
      expect(cached?.[0]).toMatchObject({ status: 'processing', version: 2 })
    })
  })
})
