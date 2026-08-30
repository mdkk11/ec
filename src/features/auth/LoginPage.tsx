'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { LoginForm } from './LoginForm'
import { useSession } from './SessionProvider'

export function LoginPage() {
  const router = useRouter()
  const { setAuthenticated, state } = useSession()

  useEffect(() => {
    if (state.status === 'authenticated') router.replace('/')
  }, [router, state.status])

  return (
    <section className="page-wrap py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-semibold tracking-[0.16em] text-muted">ACCOUNT</p>
        <h1 className="mt-3 font-serif text-5xl leading-none sm:text-6xl">ログイン</h1>
        <p className="mt-5 text-sm leading-7 text-muted">
          登録済みのメールアドレスとパスワードを入力してください。
        </p>
        <LoginForm
          onAuthenticated={(user) => {
            setAuthenticated(user)
          }}
        />
      </div>
    </section>
  )
}
