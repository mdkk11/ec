import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import OrderError from '@/app/orders/error'
import OrderLoading from '@/app/orders/loading'
import OrderDetailError from '@/app/orders/[orderId]/error'
import OrderDetailLoading from '@/app/orders/[orderId]/loading'
import OrderCompleteError from '@/app/orders/[orderId]/complete/error'

import { OrderAccessView } from './OrderAccessView'
import { OrderDetailView } from './OrderDetailView'
import { OrderHistoryView } from './OrderHistoryView'
import { orderFixture } from './order-fixtures'

describe('注文履歴', () => {
  it('ORDER-010: 空状態から商品一覧へ移動できる', () => {
    render(<OrderHistoryView items={[]} status="success" />)

    expect(screen.getByText('注文履歴はありません')).toBeVisible()
    expect(screen.getByRole('link', { name: '商品一覧を見る' })).toHaveAttribute(
      'href',
      '/products',
    )
  })

  it('ORDER-011: loading状態を支援技術へ通知する', () => {
    const { container } = render(<OrderLoading />)

    const status = screen.getByRole('status')
    const busyRegion = container.querySelector('[aria-busy="true"]')
    expect(status).toHaveTextContent('注文履歴を読み込んでいます')
    expect(busyRegion).not.toContainElement(status)
    expect(screen.getByRole('heading', { name: '注文履歴' })).toBeVisible()
    expect(container.querySelectorAll('div[aria-hidden="true"]')).not.toHaveLength(0)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('ORDER-011: error境界からresetを実行できる', async () => {
    const reset = vi.fn()
    render(<OrderError error={new Error('注文履歴取得失敗')} reset={reset} />)

    expect(screen.getByRole('alert')).toHaveTextContent('注文履歴を読み込めませんでした')
    await userEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('履歴からsnapshot注文の詳細へ移動できる', () => {
    render(<OrderHistoryView items={[orderFixture]} status="success" />)

    expect(screen.getByText(orderFixture.id)).toBeVisible()
    expect(screen.getByText('¥67,320')).toBeVisible()
    expect(screen.getByRole('link', { name: '注文詳細を見る' })).toHaveAttribute(
      'href',
      `/orders/${orderFixture.id}`,
    )
  })
})

describe('注文詳細と完了', () => {
  it('ORDER-015: 注文詳細loadingを実画面の構造で表示する', () => {
    const { container } = render(<OrderDetailLoading />)

    const status = screen.getByRole('status')
    const busyRegion = container.querySelector('[aria-busy="true"]')
    expect(status).toHaveTextContent('注文詳細を読み込んでいます。しばらくお待ちください。')
    expect(busyRegion).not.toContainElement(status)
    expect(screen.getByRole('heading', { name: '注文詳細' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '確定内容' })).toBeVisible()
    expect(container.querySelectorAll('div[aria-hidden="true"]')).not.toHaveLength(0)
    expect(screen.getByRole('link', { name: '注文履歴を見る' })).toHaveAttribute('href', '/orders')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('ORDER-008: 現在の商品ではなく注文時snapshotを表示する', () => {
    render(<OrderDetailView order={orderFixture} />)

    expect(
      screen.getByRole('heading', {
        name: '注文時のリネンブレンド オーバーシャツ',
      }),
    ).toBeVisible()
    expect(screen.getByText(/クーポン WELCOME15/u)).toBeVisible()
    expect(screen.getByText('¥67,320')).toBeVisible()
  })

  it('注文完了を通知し注文履歴への導線を表示する', () => {
    render(<OrderDetailView order={orderFixture} variant="complete" />)

    expect(screen.getByRole('heading', { name: 'ご注文を受け付けました' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('注文内容を保存しました')
    expect(screen.getByRole('link', { name: '注文履歴を見る' })).toHaveAttribute('href', '/orders')
  })

  it.each([
    {
      Component: OrderDetailError,
      expected: '注文詳細を読み込めませんでした',
      name: '詳細',
    },
    {
      Component: OrderCompleteError,
      expected: '注文完了内容を読み込めませんでした',
      name: '完了',
    },
  ])('$name画面のerror境界からresetを実行できる', async ({ Component, expected }) => {
    const reset = vi.fn()
    render(<Component error={new Error('注文取得失敗')} reset={reset} />)

    expect(screen.getByRole('alert')).toHaveTextContent(expected)
    await userEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('期限切れsession相当ではログイン導線を表示する', () => {
    render(<OrderAccessView status="unauthenticated" />)

    expect(
      screen.getByRole('heading', {
        name: '注文を見るにはログインが必要です',
      }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'ログイン' })).toHaveAttribute('href', '/login')
  })
})
