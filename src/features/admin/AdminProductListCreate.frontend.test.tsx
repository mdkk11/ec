import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/test/msw/server'

import { AdminProductsPage } from './AdminProductsPage'
import {
  listResponse,
  product,
  renderWithProviders,
} from './admin-product-frontend-test-helpers'

const customer = {
  email: 'customer@example.test',
  id: '10000000-0000-4000-8000-000000000001',
  role: 'customer' as const,
}

describe('管理商品一覧・作成', () => {
  it('管理者へ公開・非公開を含む一覧と編集導線を表示する', async () => {
    server.use(http.get('/api/admin/products', () => listResponse([product])))
    renderWithProviders(<AdminProductsPage />)

    expect(await screen.findByRole('heading', { name: '商品管理' })).toBeVisible()
    expect(screen.getByText('管理テスト商品')).toBeVisible()
    expect(
      screen.getByRole('img', { name: '管理テスト商品' }),
    ).toHaveAttribute('src', expect.stringContaining(product.imagePath))
    expect(screen.getByText(/在庫 8.*version 1/u)).toBeVisible()
    expect(screen.getByRole('link', { name: '編集する' })).toHaveAttribute(
      'href',
      `/admin/products/${product.id}`,
    )
  })

  it('空状態と作成フォームを同時に表示する', async () => {
    server.use(http.get('/api/admin/products', () => listResponse([])))
    renderWithProviders(<AdminProductsPage />)

    expect(await screen.findByText('商品はまだありません')).toBeVisible()
    expect(screen.getByRole('button', { name: '商品を作成' })).toBeEnabled()
  })

  it('一覧取得中は支援技術へloading状態を伝える', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    server.use(
      http.get('/api/admin/products', async () => {
        await gate
        return listResponse([])
      }),
    )
    renderWithProviders(<AdminProductsPage />)

    expect(screen.getByRole('status')).toHaveTextContent('商品を読み込んでいます')
    release?.()
    expect(await screen.findByText('商品はまだありません')).toBeVisible()
  })

  it('network errorを表示し、再試行後に一覧を表示する', async () => {
    server.use(http.get('/api/admin/products', () => HttpResponse.error()))
    renderWithProviders(<AdminProductsPage />)

    expect(
      await screen.findByRole('heading', { name: '商品を読み込めませんでした' }),
    ).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('サーバーへ接続できませんでした')

    server.use(http.get('/api/admin/products', () => listResponse([product])))
    await userEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(await screen.findByText('管理テスト商品')).toBeVisible()
  })

  it('500を再試行可能な取得エラーとして表示する', async () => {
    server.use(
      http.get('/api/admin/products', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: '商品を取得できませんでした。' },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<AdminProductsPage />)

    expect(
      await screen.findByRole('heading', { name: '商品を読み込めませんでした' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: '再試行' })).toBeEnabled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      '時間をおいてもう一度お試しください',
    )
  })

  it('ADMIN-002: 負数・小数をfield errorにし、HTTP送信せず最初の項目へfocusする', async () => {
    let createCount = 0
    server.use(
      http.get('/api/admin/products', () => listResponse([])),
      http.post('/api/admin/products', () => {
        createCount += 1
        return HttpResponse.json({ product }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)
    await screen.findByText('商品はまだありません')

    await user.selectOptions(screen.getByLabelText('カテゴリ'), product.categoryId)
    await user.type(screen.getByLabelText('商品名'), '入力エラー商品')
    await user.type(screen.getByLabelText('商品説明'), '入力エラーの確認です。')
    await user.clear(screen.getByLabelText('価格（円）'))
    await user.type(screen.getByLabelText('価格（円）'), '-1')
    await user.clear(screen.getByLabelText('在庫数'))
    await user.type(screen.getByLabelText('在庫数'), '1.5')
    await user.click(screen.getByRole('button', { name: '商品を作成' }))

    expect(createCount).toBe(0)
    expect(screen.getByLabelText('価格（円）')).toHaveFocus()
    expect(screen.getByText('価格は0以上で入力してください。')).toBeVisible()
    expect(screen.getByText('在庫数は整数で入力してください。')).toBeVisible()
  })

  it('ADMIN-001: 送信中の重複操作を防ぎ、作成商品を一覧へ追加する', async () => {
    let requestCount = 0
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    const created = { ...product, id: '30000000-0000-4000-8000-000000000099', isPublished: false, name: '新しい管理商品', stock: 2 }
    server.use(
      http.get('/api/admin/products', () => listResponse([product])),
      http.post('/api/admin/products', async () => {
        requestCount += 1
        await gate
        return HttpResponse.json({ product: created }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)
    await screen.findByText('管理テスト商品')

    await user.selectOptions(screen.getByLabelText('カテゴリ'), created.categoryId)
    await user.type(screen.getByLabelText('商品名'), created.name)
    await user.type(screen.getByLabelText('商品説明'), created.description)
    await user.clear(screen.getByLabelText('価格（円）'))
    await user.type(screen.getByLabelText('価格（円）'), String(created.price))
    await user.clear(screen.getByLabelText('在庫数'))
    await user.type(screen.getByLabelText('在庫数'), String(created.stock))
    const submit = screen.getByRole('button', { name: '商品を作成' })
    await user.click(submit)
    expect(submit).toBeDisabled()
    expect(requestCount).toBe(1)

    release?.()
    expect(await screen.findByText('新しい管理商品')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('作成しました')
    expect(requestCount).toBe(1)
  })

  it('カテゴリ未選択では送信せずselectへfocusする', async () => {
    let requestCount = 0
    server.use(
      http.get('/api/admin/products', () => listResponse([])),
      http.post('/api/admin/products', () => {
        requestCount += 1
        return HttpResponse.json({ product }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)
    await screen.findByText('商品はまだありません')

    await user.type(screen.getByLabelText('商品名'), 'カテゴリ未選択商品')
    await user.type(screen.getByLabelText('商品説明'), 'カテゴリ必須の確認です。')
    await user.click(screen.getByRole('button', { name: '商品を作成' }))

    expect(requestCount).toBe(0)
    expect(screen.getByLabelText('カテゴリ')).toHaveFocus()
    expect(screen.getByText('カテゴリを選択してください。')).toBeVisible()
  })

  it('未認証・customerでは管理APIを呼ばない', async () => {
    let requestCount = 0
    server.use(http.get('/api/admin/products', () => {
      requestCount += 1
      return listResponse([product])
    }))

    const anonymousView = renderWithProviders(
      <AdminProductsPage />,
      { status: 'anonymous' },
    )
    expect(screen.getByText('商品管理にはログインが必要です')).toBeVisible()
    anonymousView.unmount()

    renderWithProviders(
      <AdminProductsPage />,
      { status: 'authenticated', user: customer },
    )
    expect(screen.getByText('この画面は管理者専用です。')).toBeVisible()
    expect(requestCount).toBe(0)
  })
})
