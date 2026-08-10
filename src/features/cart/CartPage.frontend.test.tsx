import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { server } from '@/test/msw/server'

import { CartPage } from './CartPage'
import {
  cartFixture,
  emptyCartFixture,
  stockConflictCartFixture,
} from './cart-fixtures'
import {
  cartResponse,
  customer,
  renderWithProviders,
} from './cart-frontend-test-helpers'

const router = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))

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
})

function itemUnitPrice() {
  return cartFixture.items[0]!.unitPrice
}
