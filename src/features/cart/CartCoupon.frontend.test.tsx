import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { server } from '@/test/msw/server'

import { appliedCouponFixture, cartFixture, expiredCouponFixture } from './cart-fixtures'
import { cartResponse, renderWithProviders } from './cart-frontend-test-helpers'
import { CartPage } from './CartPage'

const router = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))

describe('クーポン操作', () => {
  it('COUPON-001/007: クーポンを適用して割引を表示し、解除できる', async () => {
    server.use(
      http.get('/api/cart', () => cartResponse(cartFixture)),
      http.put('/api/cart/coupon', () => cartResponse(appliedCouponFixture)),
      http.delete('/api/cart/coupon', () => cartResponse({ ...cartFixture, version: 5 })),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const input = await screen.findByLabelText('クーポンコード')
    await user.type(input, 'welcome15')
    await user.click(screen.getByRole('button', { name: 'クーポンを適用' }))

    expect(await screen.findByText('WELCOME15')).toBeVisible()
    expect(screen.getByText('−¥11,880')).toBeVisible()
    expect(screen.getByText('¥67,320')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'クーポンを解除' }))
    expect(await screen.findByLabelText('クーポンコード')).toBeVisible()
    expect(screen.queryByText('−¥11,880')).not.toBeInTheDocument()
  })

  it.each([
    ['COUPON-002', 404, 'COUPON_NOT_FOUND', 'クーポンが見つかりませんでした。'],
    ['COUPON-003', 400, 'COUPON_INACTIVE', 'このクーポンは現在利用できません。'],
    ['COUPON-004', 400, 'COUPON_NOT_STARTED', 'このクーポンはまだ利用できません。'],
    ['COUPON-005', 400, 'COUPON_EXPIRED', 'このクーポンの利用期間は終了しました。'],
    ['COUPON-006', 400, 'COUPON_MINIMUM_NOT_MET', 'クーポンの最低購入額に達していません。'],
  ])('%s: 原因別エラーを表示して入力を保持する', async (_scenario, status, code, message) => {
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
    await user.click(screen.getByRole('button', { name: 'クーポンを適用' }))

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

    const quantity = await screen.findByLabelText('リネンブレンド オーバーシャツの数量')
    await user.selectOptions(quantity, '3')
    await user.type(screen.getByLabelText('クーポンコード'), 'WELCOME15')
    await user.dblClick(screen.getByRole('button', { name: 'クーポンを適用' }))

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
    const firstQuantity = await screen.findByLabelText(`${firstItem.name}の数量`)
    await user.selectOptions(firstQuantity, '3')

    const secondQuantity = screen.getByLabelText(`${secondItem.name}の数量`)
    await user.selectOptions(secondQuantity, '2')
    await user.type(screen.getByLabelText('クーポンコード'), 'WELCOME15')
    await user.click(screen.getByRole('button', { name: 'クーポンを適用' }))
    await user.selectOptions(secondQuantity, '3')

    expect(requestOrder).toEqual([`quantity:${firstItem.id}:3`])
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
      http.put('/api/cart/coupon', () => cartResponse({ ...appliedCouponFixture, version: 4 })),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    const input = await screen.findByLabelText('クーポンコード')
    await user.type(input, 'WELCOME15')
    await user.click(screen.getByRole('button', { name: 'クーポンを適用' }))

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
    await user.click(screen.getByRole('button', { name: 'クーポンを適用' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('一時的なエラーです。')
    expect(input).toHaveValue('WELCOME15')

    await user.click(screen.getByRole('button', { name: 'クーポンを適用' }))
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
    expect(await screen.findByRole('alert')).toHaveTextContent('サーバーへ接続できませんでした。')
    expect(screen.getByText('WELCOME15')).toBeVisible()

    await user.click(removeButton)
    expect(await screen.findByLabelText('クーポンコード')).toBeVisible()
    expect(removeCount).toBe(2)
  })

  it('COUPON-009: 期限切れissueを表示し、解除操作を提供する', async () => {
    server.use(
      http.get('/api/cart', () => cartResponse(expiredCouponFixture)),
      http.delete('/api/cart/coupon', () => cartResponse({ ...cartFixture, version: 5 })),
    )
    const user = userEvent.setup()
    renderWithProviders(<CartPage />)

    expect(await screen.findByText('適用中のクーポンは期限切れです。')).toBeVisible()
    expect(screen.getByText(/問題を解消すると/u)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'クーポンを解除' }))
    expect(await screen.findByLabelText('クーポンコード')).toBeVisible()
  })
})
