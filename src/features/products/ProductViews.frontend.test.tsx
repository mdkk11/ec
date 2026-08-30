import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ProductDetailError from '@/app/products/[productId]/error'
import ProductDetailLoading from '@/app/products/[productId]/loading'
import ProductDetailNotFound from '@/app/products/[productId]/not-found'
import ProductListError from '@/app/products/error'
import ProductListLoading from '@/app/products/loading'
import ProductListNotFound from '@/app/products/not-found'
import { publicCategoryCatalog } from '@/features/categories/category-catalog'

import { ProductDetailView } from './ProductDetailView'
import { ProductListView } from './ProductListView'
import { outOfStockProductFixture, productFixture, productListFixture } from './product-fixtures'

describe('商品一覧', () => {
  it('PRODUCT-010: 商品名・価格・在庫状態とキーボードで使える詳細導線を表示する', async () => {
    const user = userEvent.setup()
    render(
      <ProductListView
        categories={publicCategoryCatalog}
        items={productListFixture}
        selectedCategory={null}
        status="success"
      />,
    )

    const detailLink = screen.getByRole('link', {
      name: `${productFixture.name}の詳細を見る`,
    })
    expect(detailLink).toHaveAttribute('href', `/products/${productFixture.id}`)
    expect(screen.getByText('4点')).toBeVisible()
    expect(screen.getByText('¥28,600')).toBeVisible()
    expect(screen.getByText('在庫切れ')).toBeVisible()

    const categoryNavigation = screen.getByRole('navigation', {
      name: '商品カテゴリ',
    })
    const categoryLinks = within(categoryNavigation).getAllByRole('link')
    expect(categoryLinks.map((link) => link.textContent)).toEqual([
      'ALL ITEMS',
      ...publicCategoryCatalog.map(({ name }) => name),
    ])
    expect(categoryLinks[0]).toHaveAttribute('aria-current', 'page')

    for (const link of [
      screen.getByRole('link', { name: 'ホーム' }),
      ...categoryLinks,
      detailLink,
    ]) {
      await user.tab()
      expect(link).toHaveFocus()
    }

    const onNavigate = vi.fn()
    detailLink.addEventListener('click', (event) => {
      event.preventDefault()
      onNavigate()
    })
    await user.keyboard('{Enter}')
    expect(onNavigate).toHaveBeenCalledOnce()
  })

  it('PRODUCT-015: カテゴリ選択中はURL・見出し・パンくず・currentを同期する', () => {
    const selectedCategory = publicCategoryCatalog[0]
    render(
      <ProductListView
        categories={publicCategoryCatalog}
        items={[productFixture]}
        selectedCategory={selectedCategory}
        status="success"
      />,
    )

    expect(screen.getByRole('heading', { level: 1, name: selectedCategory.name })).toBeVisible()
    expect(screen.getByText('1点')).toBeVisible()
    expect(
      within(screen.getByRole('navigation', { name: 'パンくずリスト' })).getByRole('link', {
        name: 'ALL ITEMS',
      }),
    ).toHaveAttribute('href', '/products')
    expect(
      screen.getByRole('link', { name: selectedCategory.name, current: 'page' }),
    ).toHaveAttribute('href', '/products?category=clothing')
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

  it('PRODUCT-016: 実在する空カテゴリは全件0件と異なる空状態を表示する', () => {
    const selectedCategory = publicCategoryCatalog[3]
    render(
      <ProductListView
        categories={publicCategoryCatalog}
        items={[]}
        selectedCategory={selectedCategory}
        status="success"
      />,
    )

    expect(
      screen.getByRole('heading', {
        name: `「${selectedCategory.name}」の商品はまだありません`,
      }),
    ).toBeVisible()
    expect(screen.getByText('別のカテゴリもご覧ください。')).toBeVisible()
    expect(screen.queryByText(/もうしばらくお待ち/u)).not.toBeInTheDocument()
  })

  it('PRODUCT-003: route loadingを支援技術へ通知する', () => {
    const { container } = render(<ProductListLoading />)

    const status = screen.getByRole('status')
    const busyRegion = container.querySelector('[aria-busy="true"]')
    expect(status).toHaveTextContent('商品を読み込んでいます')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(busyRegion).not.toContainElement(status)
    expect(screen.getByRole('heading', { name: 'ALL ITEMS' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: '商品カテゴリ' })).toBeVisible()
    expect(container.querySelectorAll('div[aria-hidden="true"]')).not.toHaveLength(0)
    expect(screen.queryByRole('link', { name: /の詳細を見る/u })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { current: 'page' })).not.toBeInTheDocument()
  })

  it('PRODUCT-004/005: route errorで再試行操作を表示してresetする', async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    window.history.replaceState(null, '', '/products?category=clothing')
    render(<ProductListError error={new Error('DB error')} reset={reset} />)

    expect(screen.getByRole('alert')).toHaveTextContent('商品を読み込めませんでした')
    await user.click(screen.getByRole('button', { name: '再試行' }))
    expect(reset).toHaveBeenCalledOnce()
    expect(`${window.location.pathname}${window.location.search}`).toBe(
      '/products?category=clothing',
    )
    expect(screen.queryByRole('link', { current: 'page' })).not.toBeInTheDocument()
    window.history.replaceState(null, '', '/')
  })

  it('PRODUCT-017: 不正・不明categoryのnot-foundからALL ITEMSへ戻れる', () => {
    render(<ProductListNotFound />)

    expect(screen.getByRole('heading', { name: 'カテゴリが見つかりませんでした' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'ALL ITEMSへ戻る' })).toHaveAttribute(
      'href',
      '/products',
    )
  })
})

describe('商品詳細', () => {
  it('PRODUCT-011: 商品情報と正確な在庫数を表示する', () => {
    render(<ProductDetailView product={productFixture} status="success" />)

    expect(screen.getByRole('heading', { name: productFixture.name })).toBeVisible()
    expect(screen.getByText('¥28,600')).toBeVisible()
    expect(screen.getByText('在庫 8点')).toBeVisible()
    expect(screen.getByText(productFixture.description)).toBeVisible()
    expect(screen.getByRole('img', { name: productFixture.name })).toBeVisible()
    expect(screen.queryByRole('button', { name: /カート/u })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '衣類' })).toHaveAttribute(
      'href',
      '/products?category=clothing',
    )
    expect(screen.getByRole('link', { name: '衣類の商品一覧へ戻る' })).toHaveAttribute(
      'href',
      '/products?category=clothing',
    )
  })

  it('PRODUCT-008: 在庫0の商品は在庫0点と表示する', () => {
    render(<ProductDetailView product={outOfStockProductFixture} status="success" />)

    expect(screen.getByText('在庫 0点')).toBeVisible()
    expect(screen.queryByRole('button', { name: /カート/u })).not.toBeInTheDocument()
  })

  it('PRODUCT-012: route loadingを支援技術へ通知する', () => {
    const { container } = render(<ProductDetailLoading />)

    const status = screen.getByRole('status')
    const busyRegion = container.querySelector('[aria-busy="true"]')
    expect(status).toHaveTextContent('商品を読み込んでいます')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(busyRegion).not.toContainElement(status)
    expect(screen.getByText('PRODUCT')).toBeVisible()
    expect(screen.getByRole('heading', { name: '商品説明' })).toBeVisible()
    expect(container.querySelectorAll('div[aria-hidden="true"]')).not.toHaveLength(0)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
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

    expect(screen.getByRole('alert')).toHaveTextContent('商品を読み込めませんでした')
    expect(screen.getByRole('link', { name: '商品一覧へ戻る' })).toHaveAttribute(
      'href',
      '/products',
    )

    await user.click(screen.getByRole('button', { name: '再試行' }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
