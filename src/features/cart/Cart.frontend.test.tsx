import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CartDto } from '@/contracts/cart'
import {
  SessionProvider,
  type SessionState,
  useSession,
} from '@/features/auth/SessionProvider'
import { orderFixture } from '@/features/orders/order-fixtures'
import { server } from '@/test/msw/server'

import { CartOperationProvider } from './CartOperationProvider'
import { CartPage } from './CartPage'
import { ProductCartAction } from './ProductCartAction'
import {
  appliedCouponFixture,
  cartFixture,
  emptyCartFixture,
  expiredCouponFixture,
  stockConflictCartFixture,
} from './cart-fixtures'

const router = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))

beforeEach(() => {
  router.push.mockClear()
})

const customer = {
  email: 'customer@example.test',
  id: '10000000-0000-4000-8000-000000000001',
  role: 'customer' as const,
}
const authenticatedState: SessionState = {
  status: 'authenticated',
  user: customer,
}
const secondCustomer = {
  ...customer,
  email: 'second-customer@example.test',
  id: '10000000-0000-4000-8000-000000000002',
}

function CustomerSwitcher() {
  const { setAuthenticated } = useSession()
  return (
    <button
      onClick={() => setAuthenticated(secondCustomer)}
      type="button"
    >
      利用者を切り替える
    </button>
  )
}

function renderWithProviders(
  children: ReactNode,
  initialSessionState: SessionState = authenticatedState,
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
          <CartOperationProvider>{children}</CartOperationProvider>
        </SessionProvider>
      </QueryClientProvider>,
    ),
  }
}

function cartResponse(cart: CartDto) {
  return HttpResponse.json({ cart })
}

describe('カート画面', () => {
  it('API-002: network errorを表示し、明示的な再試行後にカートを表示する', async () => {
    server.use(http.get('/api/cart', () => HttpResponse.error()))
    renderWithProviders(<CartPage />)

    expect(
      await screen.findByRole('heading', {
        name: 'カートを読み込めませんでした',
      }),
    ).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'サーバーへ接続できませんでした',
    )

    server.use(http.get('/api/cart', () => cartResponse(cartFixture)))
    await userEvent.click(screen.getByRole('button', { name: '再試行' }))

    expect(await screen.findByRole('heading', { name: 'カート' })).toBeVisible()
    expect(screen.getByText('リネンブレンド オーバーシャツ')).toBeVisible()
  })

  it('CART-006: 空状態から商品一覧へ移動できる', async () => {
    server.use(http.get('/api/cart', () => cartResponse(emptyCartFixture)))
    renderWithProviders(<CartPage />)

    expect(await screen.findByText('カートは空です')).toBeVisible()
    expect(screen.getByRole('link', { name: '商品一覧を見る' })).toHaveAttribute(
      'href',
      '/products',
    )
  })

  it('CART-005: 商品を削除して空状態へ更新する', async () => {
    server.use(
      http.get('/api/cart', () => cartResponse(cartFixture)),
      http.delete('/api/cart/items/:itemId', () =>
        cartResponse({ ...emptyCartFixture, version: 4 }),
      ),
    )
    renderWithProviders(<CartPage />)

    await screen.findByText('リネンブレンド オーバーシャツ')
    await userEvent.click(
      screen.getAllByRole('button', { name: /を削除$/u })[0]!,
    )

    expect(await screen.findByText('カートは空です')).toBeVisible()
  })

  it('CART-007/CART-009: 新しい数量操作を直列化し、最新希望値で確定する', async () => {
    let requestCount = 0
    let releaseFirst: (() => void) | undefined
    let releaseSecond: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve
    })
    server.use(
      http.get('/api/cart', () =>
        cartResponse({
          ...cartFixture,
          items: [cartFixture.items[0]!],
          subtotal: 57_200,
          total: 57_200,
        }),
      ),
      http.patch('/api/cart/items/:itemId', async ({ request }) => {
        requestCount += 1
        const { quantity } = (await request.json()) as { quantity: number }
        if (requestCount === 1) await firstGate
        if (requestCount === 2) await secondGate
        const item = {
          ...cartFixture.items[0]!,
          lineTotal: itemUnitPrice() * quantity,
          quantity,
        }
        return cartResponse({
          ...cartFixture,
          items: [item],
          subtotal: item.lineTotal,
          total: item.lineTotal,
          version: quantity === 3 ? 5 : 4,
        })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const quantityInput = await screen.findByLabelText(
      'リネンブレンド オーバーシャツの数量',
    )
    await user.clear(quantityInput)
    await user.type(quantityInput, '2')
    await user.click(
      screen.getByRole('button', {
        name: 'リネンブレンド オーバーシャツの数量を更新',
      }),
    )
    expect(screen.getByRole('status')).toHaveTextContent('更新しています')

    await user.clear(quantityInput)
    await user.type(quantityInput, '3')
    await user.click(
      screen.getByRole('button', {
        name: 'リネンブレンド オーバーシャツの数量を更新',
      }),
    )

    expect(requestCount).toBe(1)
    expect(quantityInput).toHaveValue(3)
    expect(screen.getAllByText('¥57,200')).toHaveLength(3)
    releaseFirst?.()
    await waitFor(() => expect(requestCount).toBe(2))
    expect(quantityInput).toHaveValue(3)
    expect(screen.getAllByText('¥57,200')).toHaveLength(3)
    releaseSecond?.()
    expect(await screen.findAllByText('¥85,800')).toHaveLength(3)
    expect(
      screen.getByLabelText('リネンブレンド オーバーシャツの数量'),
    ).toHaveValue(3)
    expect(screen.getAllByText('¥85,800')).toHaveLength(3)
  })

  it('CART-007: 別明細の操作を待機中も各明細の削除を無効化する', async () => {
    let requestCount = 0
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    server.use(
      http.get('/api/cart', () => cartResponse(cartFixture)),
      http.patch('/api/cart/items/:itemId', async () => {
        requestCount += 1
        if (requestCount === 1) await firstGate
        return cartResponse({
          ...cartFixture,
          version: cartFixture.version + requestCount,
        })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const firstQuantity = await screen.findByLabelText(
      'リネンブレンド オーバーシャツの数量',
    )
    await user.clear(firstQuantity)
    await user.type(firstQuantity, '3')
    await user.click(
      screen.getByRole('button', {
        name: 'リネンブレンド オーバーシャツの数量を更新',
      }),
    )

    const secondQuantity = screen.getByLabelText(
      'スエード コートスニーカーの数量',
    )
    await user.clear(secondQuantity)
    await user.type(secondQuantity, '2')
    await user.click(
      screen.getByRole('button', {
        name: 'スエード コートスニーカーの数量を更新',
      }),
    )

    expect(requestCount).toBe(1)
    expect(
      screen.getByRole('button', {
        name: 'リネンブレンド オーバーシャツを削除',
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: 'スエード コートスニーカーを削除',
      }),
    ).toBeDisabled()

    releaseFirst?.()
    await waitFor(() => expect(requestCount).toBe(2))
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'スエード コートスニーカーを削除',
        }),
      ).toBeEnabled(),
    )
  })

  it('CART-003/CART-008: 更新失敗時は確定済み合計を維持し再試行できる', async () => {
    server.use(
      http.get('/api/cart', () =>
        cartResponse({
          ...cartFixture,
          items: [cartFixture.items[0]!],
          subtotal: 57_200,
          total: 57_200,
        }),
      ),
      http.patch('/api/cart/items/:itemId', () =>
        HttpResponse.json(
          {
            code: 'QUANTITY_EXCEEDS_STOCK',
            fieldErrors: {
              quantity: ['注文可能な数量を超えています。'],
            },
            message: '注文可能な数量を超えています。',
          },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const quantityInput = await screen.findByLabelText(
      'リネンブレンド オーバーシャツの数量',
    )
    await user.clear(quantityInput)
    await user.type(quantityInput, '4')
    await user.click(
      screen.getByRole('button', {
        name: 'リネンブレンド オーバーシャツの数量を更新',
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '注文可能な数量を超えています',
    )
    expect(quantityInput).toHaveValue(4)
    expect(screen.getAllByText('¥57,200')).toHaveLength(3)
    expect(
      screen.getByRole('button', {
        name: 'リネンブレンド オーバーシャツの数量を更新',
      }),
    ).toBeEnabled()
  })

  it('CART-004/CART-010: issueを表示し、再取得後に利用可能へ戻す', async () => {
    let requestCount = 0
    server.use(
      http.get('/api/cart', () => {
        requestCount += 1
        return cartResponse(
          requestCount === 1 ? stockConflictCartFixture : cartFixture,
        )
      }),
    )
    const { client } = renderWithProviders(<CartPage />)

    expect(
      await screen.findByText(/在庫が変更されました/u),
    ).toBeVisible()
    await client.refetchQueries({ queryKey: ['cart', customer.id] })

    await waitFor(() =>
      expect(
        screen.queryByText(/在庫が変更されました/u),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByText('リネンブレンド オーバーシャツ')).toBeVisible()
  })

  it('AUTH-010: adminではカートAPIを呼ばず購入者専用表示にする', async () => {
    const handler = vi.fn(() => cartResponse(cartFixture))
    server.use(
      http.get('/api/cart', handler),
      http.post('/api/cart/items', handler),
      http.patch('/api/cart/items/:itemId', handler),
      http.delete('/api/cart/items/:itemId', handler),
      http.put('/api/cart/coupon', handler),
      http.delete('/api/cart/coupon', handler),
    )
    renderWithProviders(<CartPage />, {
      status: 'authenticated',
      user: { ...customer, role: 'admin' },
    })

    expect(
      screen.getByRole('heading', { name: 'カートは購入者専用です' }),
    ).toBeVisible()
    expect(handler).not.toHaveBeenCalled()
  })

  it('ORDER-003: 注文送信を1回に抑え、cart操作を送信中は無効化する', async () => {
    let requestCount = 0
    let releaseOrder: (() => void) | undefined
    const orderGate = new Promise<void>((resolve) => {
      releaseOrder = resolve
    })
    server.use(
      http.get('/api/cart', () => cartResponse(cartFixture)),
      http.post('/api/orders', async () => {
        requestCount += 1
        await orderGate
        return HttpResponse.json({ order: orderFixture }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const checkout = await screen.findByRole('button', {
      name: '注文を確定する',
    })
    await user.dblClick(checkout)

    expect(requestCount).toBe(1)
    expect(checkout).toBeDisabled()
    expect(
      screen.getByLabelText(
        'リネンブレンド オーバーシャツの数量',
      ),
    ).toBeDisabled()
    expect(screen.getByLabelText('クーポンコード')).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(
      '注文を確定しています',
    )

    releaseOrder?.()
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        `/orders/${orderFixture.id}/complete`,
      ),
    )
  })

  it('ORDER-007: 在庫409後に最新cartを1回取得し、自動再送しない', async () => {
    let cartRequestCount = 0
    let orderRequestCount = 0
    server.use(
      http.get('/api/cart', () => {
        cartRequestCount += 1
        return cartResponse(
          cartRequestCount === 1
            ? cartFixture
            : stockConflictCartFixture,
        )
      }),
      http.post('/api/orders', () => {
        orderRequestCount += 1
        return HttpResponse.json(
          {
            code: 'STOCK_CONFLICT',
            message:
              '在庫が変更されました。最新のカートを確認してください。',
          },
          { status: 409 },
        )
      }),
    )
    renderWithProviders(<CartPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: '注文を確定する' }),
    )

    expect(
      await screen.findByText(
        '在庫が変更されました。最新のカートを確認し、数量を調整してください。',
      ),
    ).toBeVisible()
    expect(await screen.findByText(/数量を減らして/u)).toBeVisible()
    expect(cartRequestCount).toBe(2)
    expect(orderRequestCount).toBe(1)
    expect(router.push).not.toHaveBeenCalled()
  })

  it.each([
    {
      code: 'CHECKOUT_CHANGED',
      expected:
        '注文内容が変更されました。最新の内容を確認し、もう一度注文を確定してください。',
      scenario: 'ORDER-006/013/014',
      status: 409,
    },
    {
      code: 'EMPTY_CART',
      expected:
        'カートの内容が変更されました。最新の状態を確認してください。',
      scenario: 'ORDER-002',
      status: 400,
    },
  ])(
    '$scenario: $code後は最新cartを1回取得し、自動再送しない',
    async ({ code, expected, status }) => {
      let cartRequestCount = 0
      let orderRequestCount = 0
      server.use(
        http.get('/api/cart', () => {
          cartRequestCount += 1
          return cartResponse(
            cartRequestCount === 1
              ? cartFixture
              : { ...cartFixture, version: cartFixture.version + 1 },
          )
        }),
        http.post('/api/orders', () => {
          orderRequestCount += 1
          return HttpResponse.json(
            { code, message: '注文内容を再確認してください。' },
            { status },
          )
        }),
      )
      renderWithProviders(<CartPage />)

      await userEvent.click(
        await screen.findByRole('button', { name: '注文を確定する' }),
      )

      expect(await screen.findByText(expected)).toBeVisible()
      expect(cartRequestCount).toBe(2)
      expect(orderRequestCount).toBe(1)
      expect(router.push).not.toHaveBeenCalled()
    },
  )

  it('409後のcart再取得に失敗した場合は手動再試行を表示する', async () => {
    let cartRequestCount = 0
    server.use(
      http.get('/api/cart', () => {
        cartRequestCount += 1
        return cartRequestCount === 1
          ? cartResponse(cartFixture)
          : HttpResponse.error()
      }),
      http.post('/api/orders', () =>
        HttpResponse.json(
          {
            code: 'STOCK_CONFLICT',
            message:
              '在庫が変更されました。最新のカートを確認してください。',
          },
          { status: 409 },
        ),
      ),
    )
    renderWithProviders(<CartPage />)

    const checkout = await screen.findByRole('button', {
      name: '注文を確定する',
    })
    await userEvent.click(checkout)

    const retry = await screen.findByRole('button', {
      name: '最新のカートを再取得',
    })
    expect(screen.getByText('リネンブレンド オーバーシャツ')).toBeVisible()
    expect(checkout).toBeDisabled()

    server.use(
      http.get('/api/cart', () =>
        cartResponse({
          ...cartFixture,
          checkoutToken: 'b'.repeat(64),
          version: cartFixture.version + 1,
        }),
      ),
    )
    await userEvent.click(retry)

    await waitFor(() => expect(checkout).toBeEnabled())
    expect(cartRequestCount).toBe(2)
  })

  it('注文APIの401ではsessionをanonymous化してcartを破棄する', async () => {
    server.use(
      http.get('/api/cart', () => cartResponse(cartFixture)),
      http.post('/api/orders', () =>
        HttpResponse.json(
          { code: 'UNAUTHENTICATED', message: 'ログインが必要です。' },
          { status: 401 },
        ),
      ),
    )
    const { client } = renderWithProviders(<CartPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: '注文を確定する' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'カートを見るにはログインが必要です',
      }),
    ).toBeVisible()
    expect(
      client.getQueryData(['cart', customer.id]),
    ).toBeUndefined()
  })

  it.each([
    {
      expected: '時間をおいてもう一度お試しください',
      requiresConfirmation: false,
      response: () =>
        HttpResponse.json(
          {
            code: 'INTERNAL_ERROR',
            message:
              '注文を確定できませんでした。時間をおいてもう一度お試しください。',
          },
          { status: 500 },
        ),
      type: '500',
    },
    {
      expected: '注文結果を確認できませんでした',
      requiresConfirmation: true,
      response: () =>
        HttpResponse.json(
          { order: { id: 'invalid-order-response' } },
          { status: 201 },
        ),
      type: '不正response',
    },
    {
      expected: '注文結果を確認できませんでした',
      requiresConfirmation: true,
      response: () => HttpResponse.error(),
      type: 'network',
    },
  ])(
    '注文APIの$type失敗時は現在のcartを保持する',
    async ({ expected, requiresConfirmation, response }) => {
      server.use(
        http.get('/api/cart', () => cartResponse(cartFixture)),
        http.post('/api/orders', response),
      )
      renderWithProviders(<CartPage />)

      const checkout = await screen.findByRole('button', {
        name: '注文を確定する',
      })
      await userEvent.click(checkout)

      expect(await screen.findByRole('alert')).toHaveTextContent(expected)
      expect(
        screen.getByText('リネンブレンド オーバーシャツ'),
      ).toBeVisible()
      if (requiresConfirmation) {
        expect(checkout).toBeDisabled()
        expect(
          screen.getByRole('link', { name: '注文履歴を確認' }),
        ).toHaveAttribute('href', '/orders')
        expect(
          screen.getByRole('button', { name: '最新のカートを再取得' }),
        ).toBeEnabled()
      } else {
        expect(checkout).toBeEnabled()
      }
      expect(router.push).not.toHaveBeenCalled()
    },
  )

  it('利用者切替中に返った遅延成功では完了画面へ遷移しない', async () => {
    let cartRequestCount = 0
    let releaseOrder: (() => void) | undefined
    const orderGate = new Promise<void>((resolve) => {
      releaseOrder = resolve
    })
    server.use(
      http.get('/api/cart', () => {
        cartRequestCount += 1
        return cartResponse(cartFixture)
      }),
      http.post('/api/orders', async () => {
        await orderGate
        return HttpResponse.json({ order: orderFixture }, { status: 201 })
      }),
    )
    renderWithProviders(
      <>
        <CartPage />
        <CustomerSwitcher />
      </>,
    )

    await userEvent.click(
      await screen.findByRole('button', { name: '注文を確定する' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: '利用者を切り替える' }),
    )
    await waitFor(() => expect(cartRequestCount).toBe(2))

    releaseOrder?.()
    await waitFor(() =>
      expect(
        screen.getByText('リネンブレンド オーバーシャツ'),
      ).toBeVisible(),
    )
    expect(router.push).not.toHaveBeenCalled()
  })

  it('カート画面を離れた後の遅延成功では完了画面へ遷移しない', async () => {
    let releaseOrder: (() => void) | undefined
    const orderGate = new Promise<void>((resolve) => {
      releaseOrder = resolve
    })
    server.use(
      http.get('/api/cart', () => cartResponse(cartFixture)),
      http.post('/api/orders', async () => {
        await orderGate
        return HttpResponse.json({ order: orderFixture }, { status: 201 })
      }),
    )
    const { unmount } = renderWithProviders(<CartPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: '注文を確定する' }),
    )
    unmount()
    releaseOrder?.()

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(router.push).not.toHaveBeenCalled()
  })

  it('注文APIのnetwork失敗後は最新cartの確認を経て再試行できる', async () => {
    let orderRequestCount = 0
    server.use(
      http.get('/api/cart', () => cartResponse(cartFixture)),
      http.post('/api/orders', () => {
        orderRequestCount += 1
        return orderRequestCount === 1
          ? HttpResponse.error()
          : HttpResponse.json({ order: orderFixture }, { status: 201 })
      }),
    )
    renderWithProviders(<CartPage />)

    const checkout = await screen.findByRole('button', {
      name: '注文を確定する',
    })
    await userEvent.click(checkout)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '注文結果を確認できませんでした',
    )
    expect(
      screen.getByText('リネンブレンド オーバーシャツ'),
    ).toBeVisible()
    expect(checkout).toBeDisabled()

    await userEvent.click(
      screen.getByRole('button', { name: '最新のカートを再取得' }),
    )
    await waitFor(() => expect(checkout).toBeEnabled())

    await userEvent.click(checkout)
    await waitFor(() => expect(orderRequestCount).toBe(2))
    expect(router.push).toHaveBeenCalledWith(
      `/orders/${orderFixture.id}/complete`,
    )
  })
})

describe('クーポン操作', () => {
  it('COUPON-001/007: クーポンを適用して割引を表示し、解除できる', async () => {
    server.use(
      http.get('/api/cart', () => cartResponse(cartFixture)),
      http.put('/api/cart/coupon', () =>
        cartResponse(appliedCouponFixture),
      ),
      http.delete('/api/cart/coupon', () =>
        cartResponse({ ...cartFixture, version: 5 }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const input = await screen.findByLabelText('クーポンコード')
    await user.type(input, 'welcome15')
    await user.click(
      screen.getByRole('button', { name: 'クーポンを適用' }),
    )

    expect(await screen.findByText('WELCOME15')).toBeVisible()
    expect(screen.getByText('−¥11,880')).toBeVisible()
    expect(screen.getByText('¥67,320')).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: 'クーポンを解除' }),
    )
    expect(await screen.findByLabelText('クーポンコード')).toBeVisible()
    expect(screen.queryByText('−¥11,880')).not.toBeInTheDocument()
  })

  it.each([
    ['COUPON-002', 404, 'COUPON_NOT_FOUND', 'クーポンが見つかりませんでした。'],
    ['COUPON-003', 400, 'COUPON_INACTIVE', 'このクーポンは現在利用できません。'],
    ['COUPON-004', 400, 'COUPON_NOT_STARTED', 'このクーポンはまだ利用できません。'],
    ['COUPON-005', 400, 'COUPON_EXPIRED', 'このクーポンの利用期間は終了しました。'],
    ['COUPON-006', 400, 'COUPON_MINIMUM_NOT_MET', 'クーポンの最低購入額に達していません。'],
  ])('%s: 原因別エラーを表示して入力を保持する', async (
    _scenario,
    status,
    code,
    message,
  ) => {
    server.use(
      http.get('/api/cart', () => cartResponse(cartFixture)),
      http.put('/api/cart/coupon', () =>
        HttpResponse.json(
          {
            code,
            fieldErrors: { code: ['サーバー側の任意文言'] },
            message: 'サーバー側の任意文言',
          },
          { status },
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const input = await screen.findByLabelText('クーポンコード')
    await user.type(input, 'INVALID')
    await user.click(
      screen.getByRole('button', { name: 'クーポンを適用' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(input).toHaveValue('INVALID')
    expect(screen.getAllByText('¥79,200')).toHaveLength(2)
  })

  it('適用中の二重送信を防ぎ、数量操作と受付順に実行する', async () => {
    const requestOrder: string[] = []
    let releaseQuantity: (() => void) | undefined
    const quantityGate = new Promise<void>((resolve) => {
      releaseQuantity = resolve
    })
    server.use(
      http.get('/api/cart', () => cartResponse(cartFixture)),
      http.patch('/api/cart/items/:itemId', async () => {
        requestOrder.push('quantity')
        await quantityGate
        return cartResponse({ ...cartFixture, version: 4 })
      }),
      http.put('/api/cart/coupon', () => {
        requestOrder.push('coupon')
        return cartResponse(appliedCouponFixture)
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const quantity = await screen.findByLabelText(
      'リネンブレンド オーバーシャツの数量',
    )
    await user.clear(quantity)
    await user.type(quantity, '3')
    await user.click(
      screen.getByRole('button', {
        name: 'リネンブレンド オーバーシャツの数量を更新',
      }),
    )
    await user.type(screen.getByLabelText('クーポンコード'), 'WELCOME15')
    await user.dblClick(
      screen.getByRole('button', { name: 'クーポンを適用' }),
    )

    expect(requestOrder).toEqual(['quantity'])
    releaseQuantity?.()
    await waitFor(() => expect(requestOrder).toEqual(['quantity', 'coupon']))
    expect(await screen.findByText('WELCOME15')).toBeVisible()
  })

  it('数量更新をクーポン操作の前方へ集約せず受付順を維持する', async () => {
    const requestOrder: string[] = []
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let patchCount = 0
    server.use(
      http.get('/api/cart', () => cartResponse(cartFixture)),
      http.patch('/api/cart/items/:itemId', async ({ params, request }) => {
        patchCount += 1
        const { quantity } = (await request.json()) as { quantity: number }
        requestOrder.push(`quantity:${String(params.itemId)}:${quantity}`)
        if (patchCount === 1) await firstGate
        return cartResponse({
          ...cartFixture,
          version: cartFixture.version + patchCount,
        })
      }),
      http.put('/api/cart/coupon', () => {
        requestOrder.push('coupon')
        return cartResponse({ ...appliedCouponFixture, version: 6 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const firstItem = cartFixture.items[0]!
    const secondItem = cartFixture.items[1]!
    const firstQuantity = await screen.findByLabelText(
      `${firstItem.name}の数量`,
    )
    await user.clear(firstQuantity)
    await user.type(firstQuantity, '3')
    await user.click(
      screen.getByRole('button', {
        name: `${firstItem.name}の数量を更新`,
      }),
    )

    const secondQuantity = screen.getByLabelText(
      `${secondItem.name}の数量`,
    )
    await user.clear(secondQuantity)
    await user.type(secondQuantity, '2')
    await user.click(
      screen.getByRole('button', {
        name: `${secondItem.name}の数量を更新`,
      }),
    )
    await user.type(screen.getByLabelText('クーポンコード'), 'WELCOME15')
    await user.click(
      screen.getByRole('button', { name: 'クーポンを適用' }),
    )
    await user.clear(secondQuantity)
    await user.type(secondQuantity, '3')
    await user.click(
      screen.getByRole('button', {
        name: `${secondItem.name}の数量を更新`,
      }),
    )

    expect(requestOrder).toEqual([
      `quantity:${firstItem.id}:3`,
    ])
    releaseFirst?.()
    await waitFor(() =>
      expect(requestOrder).toEqual([
        `quantity:${firstItem.id}:3`,
        `quantity:${secondItem.id}:2`,
        'coupon',
        `quantity:${secondItem.id}:3`,
      ]),
    )
  })

  it('古い適用応答では最新カートを再取得して入力を保持する', async () => {
    let getCount = 0
    server.use(
      http.get('/api/cart', () => {
        getCount += 1
        return cartResponse({
          ...cartFixture,
          version: getCount === 1 ? 5 : 6,
        })
      }),
      http.put('/api/cart/coupon', () =>
        cartResponse({ ...appliedCouponFixture, version: 4 }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const input = await screen.findByLabelText('クーポンコード')
    await user.type(input, 'WELCOME15')
    await user.click(
      screen.getByRole('button', { name: 'クーポンを適用' }),
    )

    await waitFor(() => expect(getCount).toBe(2))
    expect(input).toHaveValue('WELCOME15')
    expect(screen.queryByText('クーポンを適用しました。')).not.toBeInTheDocument()
  })

  it('5xx後も入力を保持して再試行できる', async () => {
    let applyCount = 0
    server.use(
      http.get('/api/cart', () => cartResponse(cartFixture)),
      http.put('/api/cart/coupon', () => {
        applyCount += 1
        return applyCount === 1
          ? HttpResponse.json(
              {
                code: 'INTERNAL_ERROR',
                message: '一時的なエラーです。',
              },
              { status: 500 },
            )
          : cartResponse(appliedCouponFixture)
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const input = await screen.findByLabelText('クーポンコード')
    await user.type(input, 'WELCOME15')
    await user.click(
      screen.getByRole('button', { name: 'クーポンを適用' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '一時的なエラーです。',
    )
    expect(input).toHaveValue('WELCOME15')

    await user.click(
      screen.getByRole('button', { name: 'クーポンを適用' }),
    )
    expect(await screen.findByText('クーポンを適用しました。')).toBeVisible()
    expect(applyCount).toBe(2)
  })

  it('解除失敗時も適用済みクーポンを保持して再試行できる', async () => {
    let removeCount = 0
    server.use(
      http.get('/api/cart', () => cartResponse(appliedCouponFixture)),
      http.delete('/api/cart/coupon', () => {
        removeCount += 1
        return removeCount === 1
          ? HttpResponse.error()
          : cartResponse({ ...cartFixture, version: 5 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const removeButton = await screen.findByRole('button', {
      name: 'クーポンを解除',
    })
    await user.click(removeButton)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'サーバーへ接続できませんでした。',
    )
    expect(screen.getByText('WELCOME15')).toBeVisible()

    await user.click(removeButton)
    expect(await screen.findByLabelText('クーポンコード')).toBeVisible()
    expect(removeCount).toBe(2)
  })

  it('COUPON-009: 期限切れissueを表示し、解除操作を提供する', async () => {
    server.use(
      http.get('/api/cart', () => cartResponse(expiredCouponFixture)),
      http.delete('/api/cart/coupon', () =>
        cartResponse({ ...cartFixture, version: 5 }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    expect(
      await screen.findByText('適用中のクーポンは期限切れです。'),
    ).toBeVisible()
    expect(screen.getByText(/問題を解消すると/u)).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'クーポンを解除' }),
    )
    expect(await screen.findByLabelText('クーポンコード')).toBeVisible()
  })
})

describe('商品詳細のカート操作', () => {
  it('CART-014: 商品追加APIを1回送信して成功Toastを表示する', async () => {
    let requestCount = 0
    let releaseResponse: (() => void) | undefined
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve
    })
    server.use(
      http.post('/api/cart/items', async ({ request }) => {
        requestCount += 1
        expect(await request.json()).toEqual({
          productId: cartFixture.items[0]!.productId,
          quantity: 1,
        })
        await responseGate
        return cartResponse(cartFixture)
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(
      <ProductCartAction
        availability="in_stock"
        productId={cartFixture.items[0]!.productId}
      />,
    )

    const doubleClick = user.dblClick(
      screen.getByRole('button', { name: '1点カートに追加' }),
    )

    await waitFor(() => expect(requestCount).toBe(1))
    expect(screen.getByRole('button', { name: '追加中…' })).toBeDisabled()
    releaseResponse?.()
    await doubleClick
    expect(
      await screen.findByText('カートへ追加しました。'),
    ).toBeVisible()
    expect(requestCount).toBe(1)
    expect(screen.getByRole('link', { name: 'カートを見る' })).toHaveAttribute(
      'href',
      '/cart',
    )
  })

  it('CART-015: 在庫0では追加操作を無効にしてAPIを送らない', async () => {
    const handler = vi.fn()
    server.use(http.post('/api/cart/items', handler))
    renderWithProviders(
      <ProductCartAction
        availability="out_of_stock"
        productId={cartFixture.items[0]!.productId}
      />,
    )

    expect(screen.getByRole('button', { name: '在庫切れ' })).toBeDisabled()
    expect(handler).not.toHaveBeenCalled()
  })
})

function itemUnitPrice() {
  return cartFixture.items[0]!.unitPrice
}
