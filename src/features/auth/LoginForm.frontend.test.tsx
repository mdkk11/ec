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
      http.get('/api/session', () =>
        HttpResponse.json(
          {
            code: 'UNAUTHENTICATED',
            message: 'ログインが必要です。',
          },
          { status: 401 },
        ),
      ),
      http.post('/api/session', () =>
        HttpResponse.json({ user: authenticatedUser }),
      ),
    )

    const user = userEvent.setup()
    render(
      <SessionProvider>
        <SiteHeader />
        <LoginPage />
      </SessionProvider>,
    )

    expect(await screen.findByRole('link', { name: 'ログイン' })).toBeVisible()
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(await screen.findByText(authenticatedUser.email)).toBeVisible()
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('古い初期session応答でlogin成功状態を上書きしない', async () => {
    let releaseInitialSession: (() => void) | undefined
    const initialSessionGate = new Promise<void>((resolve) => {
      releaseInitialSession = resolve
    })
    server.use(
      http.get('/api/session', async () => {
        await initialSessionGate
        return HttpResponse.json(
          {
            code: 'UNAUTHENTICATED',
            message: 'ログインが必要です。',
          },
          { status: 401 },
        )
      }),
      http.post('/api/session', () =>
        HttpResponse.json({ user: authenticatedUser }),
      ),
    )

    const user = userEvent.setup()
    render(
      <SessionProvider>
        <SiteHeader />
        <LoginPage />
      </SessionProvider>,
    )

    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'ログイン' }))
    expect(await screen.findByText(authenticatedUser.email)).toBeVisible()

    releaseInitialSession?.()
    await waitFor(() =>
      expect(screen.getByText(authenticatedUser.email)).toBeVisible(),
    )
  })

  it('logoutの500では認証表示を維持して再試行可能なerrorを表示する', async () => {
    server.use(
      http.get('/api/session', () =>
        HttpResponse.json({ user: authenticatedUser }),
      ),
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
      <SessionProvider>
        <SiteHeader />
      </SessionProvider>,
    )

    expect(await screen.findByText(authenticatedUser.email)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'ログアウト' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '失敗しました。再度お試しください。',
    )
    expect(screen.getByText(authenticatedUser.email)).toBeVisible()
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeEnabled()
  })
})
