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
    expect(
      screen.getByRole('img', { name: 'リネンブレンド オーバーシャツ' }),
    ).toHaveAttribute('src', expect.stringContaining('linen-overshirt.jpg'))
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

  it('CART-016: 現在庫までの数量だけを選択肢に表示する', async () => {
    server.use(
      http.get('/api/cart', () =>
        cartResponse({
          ...cartFixture,
          items: [
            {
              ...cartFixture.items[0]!,
              availableStock: 3,
              quantity: 2,
            },
          ],
        }),
      ),
    )
    renderWithProviders(<CartPage />)

    const quantityInput = await screen.findByLabelText(
      'リネンブレンド オーバーシャツの数量',
    )
    expect(
      Array.from(quantityInput.querySelectorAll('option'), (option) =>
        option.textContent?.trim(),
      ),
    ).toEqual(['1点', '2点', '3点'])
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
    await user.selectOptions(quantityInput, '4')
    expect(screen.getByRole('status')).toHaveTextContent('更新しています')

    await user.selectOptions(quantityInput, '3')

    expect(requestCount).toBe(1)
    expect(quantityInput).toHaveValue('3')
    expect(screen.getAllByText('¥57,200')).toHaveLength(3)
    releaseFirst?.()
    await waitFor(() => expect(requestCount).toBe(2))
    expect(quantityInput).toHaveValue('3')
    expect(screen.getAllByText('¥114,400')).toHaveLength(3)
    releaseSecond?.()
    expect(await screen.findAllByText('¥85,800')).toHaveLength(3)
    expect(
      screen.getByLabelText('リネンブレンド オーバーシャツの数量'),
    ).toHaveValue('3')
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
    await user.selectOptions(firstQuantity, '3')

    const secondQuantity = screen.getByLabelText(
      'スエード コートスニーカーの数量',
    )
    await user.selectOptions(secondQuantity, '2')

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

  it('CART-009: 実行中の古い失敗を後続の最新希望値へ表示しない', async () => {
    let patchCount = 0
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
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
        patchCount += 1
        const { quantity } = (await request.json()) as { quantity: number }
        if (patchCount === 1) {
          await firstGate
          return HttpResponse.json(
            { code: 'INTERNAL_ERROR', message: '古い操作の失敗です。' },
            { status: 500 },
          )
        }
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
          version: 4,
        })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const quantityInput = await screen.findByLabelText(
      'リネンブレンド オーバーシャツの数量',
    )
    await user.selectOptions(quantityInput, '4')
    await user.selectOptions(quantityInput, '3')
    releaseFirst?.()

    expect(await screen.findAllByText('¥85,800')).toHaveLength(3)
    expect(quantityInput).toHaveValue('3')
    expect(screen.queryByText('古い操作の失敗です。')).not.toBeInTheDocument()
    expect(patchCount).toBe(2)
  })

  it('CART-003/CART-016: 在庫超過時は確定済み合計と希望値を維持し、明示的な再取得で選択肢を更新する', async () => {
    let getCount = 0
    server.use(
      http.get('/api/cart', () => {
        getCount += 1
        if (getCount === 2) return HttpResponse.error()
        const cart = {
          ...cartFixture,
          items: [
            {
              ...cartFixture.items[0]!,
              availableStock: getCount === 1 ? 8 : 2,
            },
          ],
          subtotal: 57_200,
          total: 57_200,
        }
        return cartResponse(cart)
      }),
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
    await user.selectOptions(quantityInput, '4')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '注文可能な数量を超えています',
    )
    expect(quantityInput).toHaveValue('4')
    expect(screen.getAllByText('¥57,200')).toHaveLength(3)
    await user.click(
      screen.getByRole('button', { name: '最新のカートを再取得' }),
    )

    await waitFor(() => expect(getCount).toBe(2))
    expect(
      await screen.findByText(/最新のカートを取得できませんでした/u),
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: '最新のカートを再取得' }),
    )
    await waitFor(() => expect(getCount).toBe(3))
    expect(quantityInput).toHaveValue('2')
    expect(screen.queryByRole('option', { name: '4点' })).not.toBeInTheDocument()
    expect(screen.queryByText('注文可能な数量を超えています')).not.toBeInTheDocument()
  })

  it.each([
    {
      failure: () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '一時的なエラーです。' },
          { status: 500 },
        ),
      message: '一時的なエラー',
      name: '500',
    },
    {
      failure: () => HttpResponse.error(),
      message: 'サーバーへ接続できませんでした',
      name: '通信失敗',
    },
  ])('CART-008: $nameでは同じ希望数量を再試行する', async ({ failure, message }) => {
    let patchCount = 0
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
        patchCount += 1
        const { quantity } = (await request.json()) as { quantity: number }
        if (patchCount === 1) return failure()
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
          version: 4,
        })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const quantityInput = await screen.findByLabelText(
      'リネンブレンド オーバーシャツの数量',
    )
    await user.selectOptions(quantityInput, '4')

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(quantityInput).toHaveValue('4')
    expect(screen.getAllByText('¥57,200')).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: '再試行' }))

    expect(await screen.findAllByText('¥114,400')).toHaveLength(3)
    expect(patchCount).toBe(2)
  })

  it('CART-008: 4xxでは同じ操作の再試行を表示しない', async () => {
    server.use(
      http.get('/api/cart', () => cartResponse(cartFixture)),
      http.patch('/api/cart/items/:itemId', () =>
        HttpResponse.json(
          { code: 'CART_ITEM_NOT_FOUND', message: '明細が見つかりません。' },
          { status: 404 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    await user.selectOptions(
      await screen.findByLabelText('リネンブレンド オーバーシャツの数量'),
      '4',
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '明細が見つかりません',
    )
    expect(screen.queryByRole('button', { name: '再試行' })).not.toBeInTheDocument()
  })

  it('CART-004/CART-010/CART-017: issueを表示し、再取得後に利用可能へ戻す', async () => {
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
    expect(
      screen.getByRole('combobox', {
        name: 'リネンブレンド オーバーシャツの数量',
      }),
    ).toHaveValue('3')
    expect(screen.getByRole('option', { name: '3点（在庫超過）' })).toBeDisabled()
    await client.refetchQueries({ queryKey: ['cart', customer.id] })

    await waitFor(() =>
      expect(
        screen.queryByText(/在庫が変更されました/u),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByText('リネンブレンド オーバーシャツ')).toBeVisible()
  })

  it('CART-018: 在庫0・非公開では数量変更を無効にし、削除は利用できる', async () => {
    const unavailableCart = {
      ...cartFixture,
      checkoutToken: null,
      issues: [
        { code: 'STOCK_CONFLICT' as const, itemId: cartFixture.items[0]!.id },
        {
          code: 'PRODUCT_UNAVAILABLE' as const,
          itemId: cartFixture.items[1]!.id,
        },
      ],
      items: [
        {
          ...cartFixture.items[0]!,
          availability: 'out_of_stock' as const,
          availableStock: 0,
        },
        {
          ...cartFixture.items[1]!,
          availability: 'unpublished' as const,
        },
      ],
    }
    server.use(http.get('/api/cart', () => cartResponse(unavailableCart)))
    renderWithProviders(<CartPage />)

    expect(
      await screen.findByLabelText('リネンブレンド オーバーシャツの数量'),
    ).toBeDisabled()
    expect(
      screen.getByLabelText('スエード コートスニーカーの数量'),
    ).toBeDisabled()
    for (const deleteButton of screen.getAllByRole('button', {
      name: /を削除$/u,
    })) {
      expect(deleteButton).toBeEnabled()
    }
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
