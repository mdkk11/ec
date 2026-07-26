import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ProductDetailError from '@/app/products/[productId]/error'
import ProductDetailLoading from '@/app/products/[productId]/loading'
import ProductDetailNotFound from '@/app/products/[productId]/not-found'
import ProductListError from '@/app/products/error'
import ProductListLoading from '@/app/products/loading'

import { ProductDetailView } from './ProductDetailView'
import { ProductListView } from './ProductListView'
import {
  outOfStockProductFixture,
  productFixture,
  productListFixture,
} from './product-fixtures'

describe('商品一覧', () => {
  it('PRODUCT-010: 商品名・価格・在庫状態とキーボードで使える詳細導線を表示する', async () => {
    const user = userEvent.setup()
    render(<ProductListView items={productListFixture} status="success" />)

    const detailLink = screen.getByRole('link', {
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

  it('PRODUCT-002: 商品0件では空状態と待つ説明を表示する', () => {
    render(<ProductListView items={[]} status="success" />)

    expect(
      screen.getByRole('heading', {
        name: '公開中の商品はまだありません',
      }),
    ).toBeVisible()
    expect(screen.getByText(/もうしばらくお待ちください/u)).toBeVisible()
    expect(screen.getByText('0点')).toBeVisible()
  })

  it('PRODUCT-003: route loadingを支援技術へ通知する', () => {
    render(<ProductListLoading />)

    expect(screen.getByRole('status')).toHaveTextContent(
      '商品を読み込んでいます',
    )
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('PRODUCT-004/005: route errorで再試行操作を表示してresetする', async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    render(<ProductListError error={new Error('DB error')} reset={reset} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      '商品を読み込めませんでした',
    )
    await user.click(screen.getByRole('button', { name: '再試行' }))
    expect(reset).toHaveBeenCalledOnce()
  })
})

describe('商品詳細', () => {
  it('PRODUCT-011: 商品情報と在庫あり表示を表示する', () => {
    render(<ProductDetailView product={productFixture} status="success" />)

    expect(
      screen.getByRole('heading', { name: productFixture.name }),
    ).toBeVisible()
    expect(screen.getByText('¥28,600')).toBeVisible()
    expect(screen.getByText('在庫あり')).toBeVisible()
    expect(screen.getByText(productFixture.description)).toBeVisible()
    expect(
      screen.getByRole('img', { name: productFixture.name }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /カート/u }),
    ).not.toBeInTheDocument()
  })

  it('PRODUCT-008: 在庫0の商品は在庫切れと表示する', () => {
    render(
      <ProductDetailView
        product={outOfStockProductFixture}
        status="success"
      />,
    )

    expect(screen.getByText('在庫切れ')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /カート/u }),
    ).not.toBeInTheDocument()
  })

  it('PRODUCT-012: route loadingを支援技術へ通知する', () => {
    render(<ProductDetailLoading />)

    expect(screen.getByRole('status')).toHaveTextContent(
      '商品を読み込んでいます',
    )
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('PRODUCT-007: not-foundではキーボードで一覧へ戻れる', async () => {
    const user = userEvent.setup()
    render(<ProductDetailNotFound />)

    expect(
      screen.getByRole('heading', {
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

  it('PRODUCT-013: route errorで再試行と一覧導線を表示してresetする', async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    render(<ProductDetailError error={new Error('DB error')} reset={reset} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      '商品を読み込めませんでした',
    )
    expect(
      screen.getByRole('link', { name: '商品一覧へ戻る' }),
    ).toHaveAttribute('href', '/products')

    await user.click(screen.getByRole('button', { name: '再試行' }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
