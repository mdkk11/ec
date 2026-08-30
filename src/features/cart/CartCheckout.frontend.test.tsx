import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSession } from '@/features/auth/SessionProvider'
import { orderFixture } from '@/features/orders/order-fixtures'
import { server } from '@/test/msw/server'

import { CartPage } from './CartPage'
import { cartFixture, stockConflictCartFixture } from './cart-fixtures'
import { cartResponse, customer, renderWithProviders } from './cart-frontend-test-helpers'

const router = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))

beforeEach(() => {
  router.push.mockClear()
})

const secondCustomer = {
  ...customer,
  email: 'second-customer@example.test',
  id: '10000000-0000-4000-8000-000000000002',
}

function CustomerSwitcher() {
  const { setAuthenticated } = useSession()
  return (
    <button onClick={() => setAuthenticated(secondCustomer)} type="button">
      利用者を切り替える
    </button>
  )
}

describe('カート画面', () => {
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
    expect(screen.getByLabelText('リネンブレンド オーバーシャツの数量')).toBeDisabled()
    expect(screen.getByLabelText('クーポンコード')).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('注文を確定しています')

    releaseOrder?.()
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(`/orders/${orderFixture.id}/complete`),
    )
  })

  it('ORDER-007: 在庫409後に最新cartを1回取得し、自動再送しない', async () => {
    let cartRequestCount = 0
    let orderRequestCount = 0
    server.use(
      http.get('/api/cart', () => {
        cartRequestCount += 1
        return cartResponse(cartRequestCount === 1 ? cartFixture : stockConflictCartFixture)
      }),
      http.post('/api/orders', () => {
        orderRequestCount += 1
        return HttpResponse.json(
          {
            code: 'STOCK_CONFLICT',
            message: '在庫が変更されました。最新のカートを確認してください。',
          },
          { status: 409 },
        )
      }),
    )
    renderWithProviders(<CartPage />)

    await userEvent.click(await screen.findByRole('button', { name: '注文を確定する' }))

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
      expected: '注文内容が変更されました。最新の内容を確認し、もう一度注文を確定してください。',
      scenario: 'ORDER-006/013/014',
      status: 409,
    },
    {
      code: 'EMPTY_CART',
      expected: 'カートの内容が変更されました。最新の状態を確認してください。',
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
          return HttpResponse.json({ code, message: '注文内容を再確認してください。' }, { status })
        }),
      )
      renderWithProviders(<CartPage />)

      await userEvent.click(await screen.findByRole('button', { name: '注文を確定する' }))

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
        return cartRequestCount === 1 ? cartResponse(cartFixture) : HttpResponse.error()
      }),
      http.post('/api/orders', () =>
        HttpResponse.json(
          {
            code: 'STOCK_CONFLICT',
            message: '在庫が変更されました。最新のカートを確認してください。',
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

    await userEvent.click(await screen.findByRole('button', { name: '注文を確定する' }))

    expect(
      await screen.findByRole('heading', {
        name: 'カートを見るにはログインが必要です',
      }),
    ).toBeVisible()
    expect(client.getQueryData(['cart', customer.id])).toBeUndefined()
  })

  it.each([
    {
      expected: '時間をおいてもう一度お試しください',
      requiresConfirmation: false,
      response: () =>
        HttpResponse.json(
          {
            code: 'INTERNAL_ERROR',
            message: '注文を確定できませんでした。時間をおいてもう一度お試しください。',
          },
          { status: 500 },
        ),
      type: '500',
    },
    {
      expected: '注文結果を確認できませんでした',
      requiresConfirmation: true,
      response: () =>
        HttpResponse.json({ order: { id: 'invalid-order-response' } }, { status: 201 }),
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
      expect(screen.getByText('リネンブレンド オーバーシャツ')).toBeVisible()
      if (requiresConfirmation) {
        expect(checkout).toBeDisabled()
        expect(screen.getByRole('link', { name: '注文履歴を確認' })).toHaveAttribute(
          'href',
          '/orders',
        )
        expect(screen.getByRole('button', { name: '最新のカートを再取得' })).toBeEnabled()
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

    await userEvent.click(await screen.findByRole('button', { name: '注文を確定する' }))
    await userEvent.click(screen.getByRole('button', { name: '利用者を切り替える' }))
    await waitFor(() => expect(cartRequestCount).toBe(2))

    releaseOrder?.()
    await waitFor(() => expect(screen.getByText('リネンブレンド オーバーシャツ')).toBeVisible())
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

    await userEvent.click(await screen.findByRole('button', { name: '注文を確定する' }))
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

    expect(await screen.findByRole('alert')).toHaveTextContent('注文結果を確認できませんでした')
    expect(screen.getByText('リネンブレンド オーバーシャツ')).toBeVisible()
    expect(checkout).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: '最新のカートを再取得' }))
    await waitFor(() => expect(checkout).toBeEnabled())

    await userEvent.click(checkout)
    await waitFor(() => expect(orderRequestCount).toBe(2))
    expect(router.push).toHaveBeenCalledWith(`/orders/${orderFixture.id}/complete`)
  })
})
