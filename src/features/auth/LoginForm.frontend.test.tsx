import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SiteHeader } from '@/components/layout/SiteHeader'
import { server } from '@/test/msw/server'

import { LoginForm } from './LoginForm'
import { LoginPage } from './LoginPage'
import { SessionProvider } from './SessionProvider'

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))

const authenticatedUser = {
  email: 'customer@example.test',
  id: '10000000-0000-4000-8000-000000000001',
  role: 'customer' as const,
}

const adminUser = {
  email: 'admin@example.test',
  id: '20000000-0000-4000-8000-000000000001',
  role: 'admin' as const,
}

async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText('メールアドレス'),
    authenticatedUser.email,
  )
  await user.type(
    screen.getByLabelText('パスワード'),
    'CustomerPass123!',
  )
}

beforeEach(() => {
  router.push.mockReset()
  router.replace.mockReset()
})

describe('ログインフォーム', () => {
  it('AUTH-003: 空欄ではHTTP送信せずfield errorを表示して先頭項目へfocusする', async () => {
    const user = userEvent.setup()
    const onAuthenticated = vi.fn()
    render(<LoginForm onAuthenticated={onAuthenticated} />)

    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(screen.getByLabelText('メールアドレス')).toHaveFocus()
    expect(
      screen.getByText('メールアドレスを入力してください。'),
    ).toBeVisible()
    expect(screen.getByText('パスワードを入力してください。')).toBeVisible()
    expect(onAuthenticated).not.toHaveBeenCalled()
  })

  it('AUTH-004: login中の連続操作を無効化しrequestを1回だけ送る', async () => {
    let requestCount = 0
    let releaseResponse: (() => void) | undefined
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve
    })
    server.use(
      http.post('/api/session', async () => {
        requestCount += 1
        await responseGate
        return HttpResponse.json({ user: authenticatedUser })
      }),
    )

    const user = userEvent.setup()
    render(<LoginForm onAuthenticated={vi.fn()} />)
    await fillCredentials(user)

    const button = screen.getByRole('button', { name: 'ログイン' })
    await user.dblClick(button)

    expect(
      screen.getByRole('button', { name: 'ログイン中…' }),
    ).toBeDisabled()
    expect(requestCount).toBe(1)

    releaseResponse?.()
    await waitFor(() => expect(button).toBeEnabled())
  })

  it('AUTH-011: 500でも入力を保持し再試行可能なerrorを表示する', async () => {
    server.use(
      http.post('/api/session', () =>
        HttpResponse.json(
          {
            code: 'INTERNAL_ERROR',
            message: '処理に失敗しました。',
          },
          { status: 500 },
        ),
      ),
    )

    const user = userEvent.setup()
    render(<LoginForm onAuthenticated={vi.fn()} />)
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '入力内容を保ったまま、もう一度お試しください。',
    )
    expect(screen.getByLabelText('メールアドレス')).toHaveValue(
      authenticatedUser.email,
    )
    expect(screen.getByLabelText('パスワード')).toHaveValue(
      'CustomerPass123!',
    )
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeEnabled()
  })

  it('AUTH-002補助: invalid credentialsを共通messageで表示する', async () => {
    server.use(
      http.post('/api/session', () =>
        HttpResponse.json(
          {
            code: 'INVALID_CREDENTIALS',
            message: 'メールアドレスまたはパスワードが正しくありません。',
          },
          { status: 401 },
        ),
      ),
    )

    const user = userEvent.setup()
    render(<LoginForm onAuthenticated={vi.fn()} />)
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'メールアドレスまたはパスワードが正しくありません。',
    )
  })

  it('AUTH-012: 実API clientの成功結果をheaderへ反映してtopへ遷移する', async () => {
    server.use(
      http.post('/api/session', () =>
        HttpResponse.json({ user: authenticatedUser }),
      ),
    )

    const user = userEvent.setup()
    render(
      <SessionProvider initialState={{ status: 'anonymous' }}>
        <SiteHeader />
        <LoginPage />
      </SessionProvider>,
    )

    expect(await screen.findByRole('link', { name: 'ログイン' })).toBeVisible()
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    await user.click(await screen.findByRole('button', { name: 'マイページ' }))
    expect(screen.getByText(authenticatedUser.email)).toBeVisible()
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('Server Componentから渡された購入者状態を開き、role別導線を表示する', async () => {
    const user = userEvent.setup()
    render(
      <SessionProvider
        initialState={{ status: 'authenticated', user: authenticatedUser }}
      >
        <SiteHeader />
      </SessionProvider>,
    )

    expect(screen.getByRole('link', { name: 'ALL ITEMS' })).toHaveAttribute('href', '/products')
    expect(screen.getByRole('link', { name: 'カート' })).toHaveAttribute('href', '/cart')
    const menu = screen.getByRole('button', { name: 'マイページ' })
    await user.click(menu)
    expect(screen.getByText(authenticatedUser.email)).toBeVisible()
    expect(screen.getByRole('link', { name: 'オーダー' })).toHaveAttribute('href', '/orders')
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeVisible()
  })

  it('管理者メニューには管理導線だけを表示し、カートを表示しない', async () => {
    const user = userEvent.setup()
    render(
      <SessionProvider initialState={{ status: 'authenticated', user: adminUser }}>
        <SiteHeader />
      </SessionProvider>,
    )

    expect(screen.getByRole('link', { name: 'ALL ITEMS' })).toHaveAttribute('href', '/products')
    await user.click(screen.getByRole('button', { name: 'マイページ' }))
    expect(screen.getByText(adminUser.email)).toBeVisible()
    expect(screen.getByRole('link', { name: '商品管理' })).toHaveAttribute(
      'href',
      '/admin/products',
    )
    expect(screen.getByRole('link', { name: 'オーダー' })).toHaveAttribute(
      'href',
      '/admin/orders',
    )
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'カート' })).not.toBeInTheDocument()
  })

  it('logoutの500では認証表示を維持して再試行可能なerrorを表示する', async () => {
    server.use(
      http.delete('/api/session', () =>
        HttpResponse.json(
          {
            code: 'INTERNAL_ERROR',
            message: '処理に失敗しました。',
          },
          { status: 500 },
        ),
      ),
    )

    const user = userEvent.setup()
    render(
      <SessionProvider
        initialState={{ status: 'authenticated', user: authenticatedUser }}
      >
        <SiteHeader />
      </SessionProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'マイページ' }))
    expect(screen.getByText(authenticatedUser.email)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'ログアウト' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '失敗しました。再度お試しください。',
    )
    expect(screen.getByText(authenticatedUser.email)).toBeVisible()
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeEnabled()
  })

  it('logout送信中は重複操作を防ぎ、支援技術へ状態を伝える', async () => {
    let requestCount = 0
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.delete('/api/session', async () => {
        requestCount += 1
        await gate
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    render(
      <SessionProvider
        initialState={{ status: 'authenticated', user: authenticatedUser }}
      >
        <SiteHeader />
      </SessionProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'マイページ' }))
    const logout = screen.getByRole('button', { name: 'ログアウト' })
    await user.dblClick(logout)

    expect(
      screen.getByRole('button', { name: 'ログアウト中…' }),
    ).toBeDisabled()
    expect(requestCount).toBe(1)
    release?.()
    expect(await screen.findByRole('link', { name: 'ログイン' })).toBeVisible()
  })
})
