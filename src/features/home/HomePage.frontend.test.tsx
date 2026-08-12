import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HomePage } from './HomePage'
import { previewProducts } from './home-content'

describe('HomePage', () => {
  it('Vite試作から引き継いだトップページの主要コンテンツを表示する', () => {
    render(<HomePage />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Made for quieter days.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Curated for now' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'New essentials' })).toBeInTheDocument()
    expect(screen.getByText('リネンブレンド オーバーシャツ')).toBeInTheDocument()
    expect(screen.getByText('8 ITEMS')).toBeInTheDocument()
    expect(screen.getByText('メールマガジン登録は準備中です')).toBeInTheDocument()
  })

  it('主要CTAと新着8商品を実在する商品ルートへ接続する', () => {
    render(<HomePage />)

    expect(screen.getByRole('link', { name: /新着を見る/u })).toHaveAttribute(
      'href',
      '/products',
    )

    const expectedHrefs = previewProducts.map((product) => `/products/${product.id}`)
    expect(previewProducts).toHaveLength(8)
    expect(new Set(expectedHrefs).size).toBe(8)

    for (const product of previewProducts) {
      expect(
        screen.getByRole('link', { name: `${product.name}の詳細を見る` }),
      ).toHaveAttribute('href', `/products/${product.id}`)
    }
  })

  it('対象外のデモ操作を表示しない', () => {
    render(<HomePage />)

    expect(screen.queryByRole('button', { name: /カートに追加/u })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /お気に入り/u })).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })
})
