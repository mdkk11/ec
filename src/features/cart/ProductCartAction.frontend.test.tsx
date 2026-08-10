import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { server } from '@/test/msw/server'

import { ProductCartAction } from './ProductCartAction'
import { cartFixture } from './cart-fixtures'
import {
  cartResponse,
  renderWithProviders,
} from './cart-frontend-test-helpers'

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
