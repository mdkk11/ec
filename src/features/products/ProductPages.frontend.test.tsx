import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { server } from '@/test/msw/server'

import { ProductDetailPage } from './ProductDetailPage'
import { ProductListPage } from './ProductListPage'
import {
  outOfStockProductFixture,
  productFixture,
  productListResponseFixture,
  productResponseFixture,
} from './product-fixtures'

describe('商品一覧', () => {
  it('PRODUCT-010: 商品名・価格・在庫状態と詳細導線を表示する', async () => {
    server.use(
      http.get('/api/products', () =>
        HttpResponse.json(productListResponseFixture()),
      ),
    )

    const user = userEvent.setup()
    render(<ProductListPage />)

    expect(screen.getByRole('status')).toHaveTextContent(
      '商品を読み込んでいます',
    )
    const detailLink = await screen.findByRole('link', {
      name: `${productFixture.name}の詳細を見る`,
    })
    expect(detailLink).toHaveAttribute(
      'href',
      `/products/${productFixture.id}`,
    )
    expect(screen.getByText('4点')).toBeVisible()
    expect(screen.getByText('¥28,600')).toBeVisible()
    expect(screen.getByText('在庫切れ')).toBeVisible()

    await user.tab()
    expect(screen.getByRole('link', { name: 'ホーム' })).toHaveFocus()
    await user.tab()
    expect(detailLink).toHaveFocus()

    const onNavigate = vi.fn()
    detailLink.addEventListener('click', (event) => {
      event.preventDefault()
      onNavigate()
    })
    await user.keyboard('{Enter}')
    expect(onNavigate).toHaveBeenCalledOnce()
  })

  it('PRODUCT-002: 商品0件では空状態と待つ説明を表示する', async () => {
    server.use(
      http.get('/api/products', () =>
        HttpResponse.json(productListResponseFixture([])),
      ),
    )

    render(<ProductListPage />)

    expect(
      await screen.findByRole('heading', {
        name: '公開中の商品はまだありません',
      }),
    ).toBeVisible()
    expect(screen.getByText(/もうしばらくお待ちください/u)).toBeVisible()
    expect(screen.getByText('0点')).toBeVisible()
  })

  it('PRODUCT-003: 一覧APIの応答待ちを支援技術へ通知する', async () => {
    let releaseResponse: (() => void) | undefined
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve
    })
    server.use(
      http.get('/api/products', async () => {
        await responseGate
        return HttpResponse.json(productListResponseFixture([]))
      }),
    )

    render(<ProductListPage />)

    expect(screen.getByRole('status')).toHaveTextContent(
      '商品を読み込んでいます',
    )
    releaseResponse?.()
    expect(
      await screen.findByRole('heading', {
        name: '公開中の商品はまだありません',
      }),
    ).toBeVisible()
  })

  it('PRODUCT-004/005: 500エラーを表示し、再試行成功後に商品を表示する', async () => {
    let requestCount = 0
    server.use(
      http.get('/api/products', () => {
        requestCount += 1
        if (requestCount === 1) {
          return HttpResponse.json(
            { code: 'INTERNAL_ERROR', message: '処理に失敗しました。' },
            { status: 500 },
          )
        }
        return HttpResponse.json(
          productListResponseFixture([productFixture]),
        )
      }),
    )

    const user = userEvent.setup()
    render(<ProductListPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '商品を読み込めませんでした',
    )
    await user.click(screen.getByRole('button', { name: '再試行' }))
    expect(
      await screen.findByRole('link', {
        name: `${productFixture.name}の詳細を見る`,
      }),
    ).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('API-001: 必須fieldが欠けた応答を成功扱いしない', async () => {
    server.use(
      http.get('/api/products', () =>
        HttpResponse.json({
          items: [
            {
              availability: productFixture.availability,
              id: productFixture.id,
              imagePath: productFixture.imagePath,
              name: productFixture.name,
              price: productFixture.price,
            },
          ],
        }),
      ),
    )

    render(<ProductListPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '商品データを確認できませんでした',
    )
    expect(screen.queryByText(productFixture.name)).not.toBeInTheDocument()
  })

  it('API-002: network errorを表示し、再試行成功後に商品を表示する', async () => {
    let requestCount = 0
    server.use(
      http.get('/api/products', () => {
        requestCount += 1
        if (requestCount === 1) return HttpResponse.error()
        return HttpResponse.json(
          productListResponseFixture([productFixture]),
        )
      }),
    )

    const user = userEvent.setup()
    render(<ProductListPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'サーバーへ接続できませんでした',
    )
    await user.click(screen.getByRole('button', { name: '再試行' }))
    expect(
      await screen.findByRole('link', {
        name: `${productFixture.name}の詳細を見る`,
      }),
    ).toBeVisible()
  })
})

describe('商品詳細', () => {
  it('PRODUCT-011: 商品情報と在庫あり表示を表示する', async () => {
    server.use(
      http.get(`/api/products/${productFixture.id}`, () =>
        HttpResponse.json(productResponseFixture()),
      ),
    )

    render(<ProductDetailPage productId={productFixture.id} />)

    expect(
      await screen.findByRole('heading', { name: productFixture.name }),
    ).toBeVisible()
    expect(screen.getByText('¥28,600')).toBeVisible()
    expect(screen.getByText('在庫あり')).toBeVisible()
    expect(screen.getByText(productFixture.description)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /カート/u }),
    ).not.toBeInTheDocument()
  })

  it('PRODUCT-007: 404ではキーボードで一覧へ戻れる導線を表示する', async () => {
    server.use(
      http.get(`/api/products/${productFixture.id}`, () =>
        HttpResponse.json(
          {
            code: 'PRODUCT_NOT_FOUND',
            message: '商品が見つかりませんでした。',
          },
          { status: 404 },
        ),
      ),
    )

    const user = userEvent.setup()
    render(<ProductDetailPage productId={productFixture.id} />)

    expect(
      await screen.findByRole('heading', {
        name: '商品が見つかりませんでした',
      }),
    ).toBeVisible()
    const backLink = screen.getByRole('link', { name: '商品一覧へ戻る' })
    expect(backLink).toHaveAttribute('href', '/products')

    await user.tab()
    await user.tab()
    await user.tab()
    expect(backLink).toHaveFocus()

    const onNavigate = vi.fn()
    backLink.addEventListener('click', (event) => {
      event.preventDefault()
      onNavigate()
    })
    await user.keyboard('{Enter}')
    expect(onNavigate).toHaveBeenCalledOnce()
  })

  it('PRODUCT-008: 在庫0の商品は在庫切れと表示する', async () => {
    server.use(
      http.get(`/api/products/${outOfStockProductFixture.id}`, () =>
        HttpResponse.json(
          productResponseFixture(outOfStockProductFixture),
        ),
      ),
    )

    render(
      <ProductDetailPage productId={outOfStockProductFixture.id} />,
    )

    expect(await screen.findByText('在庫切れ')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /カート/u }),
    ).not.toBeInTheDocument()
  })

  it('PRODUCT-012: 詳細APIの応答待ちを支援技術へ通知する', async () => {
    let releaseResponse: (() => void) | undefined
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve
    })
    server.use(
      http.get(`/api/products/${productFixture.id}`, async () => {
        await responseGate
        return HttpResponse.json(productResponseFixture())
      }),
    )

    render(<ProductDetailPage productId={productFixture.id} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      '商品を読み込んでいます',
    )
    releaseResponse?.()
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: productFixture.name }),
      ).toBeVisible(),
    )
  })

  it('商品ID切替後に遅れて完了した旧レスポンスで表示を上書きしない', async () => {
    let releaseOldResponse: (() => void) | undefined
    const oldResponseGate = new Promise<void>((resolve) => {
      releaseOldResponse = resolve
    })
    server.use(
      http.get(`/api/products/${productFixture.id}`, async () => {
        await oldResponseGate
        return HttpResponse.json(productResponseFixture())
      }),
      http.get(`/api/products/${outOfStockProductFixture.id}`, () =>
        HttpResponse.json(
          productResponseFixture(outOfStockProductFixture),
        ),
      ),
    )

    const { rerender } = render(
      <ProductDetailPage productId={productFixture.id} />,
    )
    expect(screen.getByRole('status')).toBeVisible()

    rerender(
      <ProductDetailPage productId={outOfStockProductFixture.id} />,
    )
    expect(
      await screen.findByRole('heading', {
        name: outOfStockProductFixture.name,
      }),
    ).toBeVisible()

    releaseOldResponse?.()
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: productFixture.name }),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('heading', {
          name: outOfStockProductFixture.name,
        }),
      ).toBeVisible()
    })
  })

  it('PRODUCT-013: 500エラーで再試行と一覧導線を表示する', async () => {
    let requestCount = 0
    server.use(
      http.get(`/api/products/${productFixture.id}`, () => {
        requestCount += 1
        if (requestCount === 1) {
          return HttpResponse.json(
            { code: 'INTERNAL_ERROR', message: '処理に失敗しました。' },
            { status: 500 },
          )
        }
        return HttpResponse.json(productResponseFixture())
      }),
    )

    const user = userEvent.setup()
    render(<ProductDetailPage productId={productFixture.id} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '商品を読み込めませんでした',
    )
    expect(
      screen.getByRole('link', { name: '商品一覧へ戻る' }),
    ).toHaveAttribute('href', '/products')
    await user.click(screen.getByRole('button', { name: '再試行' }))
    expect(
      await screen.findByRole('heading', { name: productFixture.name }),
    ).toBeVisible()
  })
})
