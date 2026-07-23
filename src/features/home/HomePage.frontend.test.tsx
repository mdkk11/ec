import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('Vite試作から引き継いだトップページの主要コンテンツを表示する', () => {
    render(<HomePage />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Made for quieter days.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Curated for now' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'New essentials' })).toBeInTheDocument()
    expect(screen.getByText('リネンブレンド オーバーシャツ')).toBeInTheDocument()
    expect(screen.getByText('メールマガジン登録は準備中です')).toBeInTheDocument()
  })

  it('対象外のデモ操作を表示しない', () => {
    render(<HomePage />)

    expect(screen.queryByRole('button', { name: /カートに追加/u })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /お気に入り/u })).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })
})
