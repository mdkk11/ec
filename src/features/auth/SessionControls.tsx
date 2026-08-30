'use client'

import Link from 'next/link'
import { useState } from 'react'

import { useSession } from './SessionProvider'

export function SessionControls() {
  const { logout, refresh, state } = useSession()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState(false)

  if (state.status === 'loading') {
    return (
      <p
        aria-live="polite"
        className="text-[10px] font-medium tracking-[0.08em] text-muted sm:text-[11px]"
      >
        認証確認中…
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="text-right">
        <p className="text-[10px] text-red-700" role="status">
          認証状態を確認できません
        </p>
        <button
          className="mt-1 text-[10px] font-semibold underline underline-offset-4"
          onClick={() => void refresh()}
          type="button"
        >
          再試行
        </button>
      </div>
    )
  }

  if (state.status === 'anonymous') {
    return (
      <Link
        className="inline-flex min-h-11 items-center text-[10px] font-semibold tracking-[0.04em] underline-offset-4 hover:underline sm:text-[11px] sm:tracking-[0.08em]"
        href="/login"
      >
        ログイン
      </Link>
    )
  }

  const admin = state.user.role === 'admin'

  return (
    <div className="flex items-center gap-2 whitespace-nowrap text-right">
      {!admin ? (
        <Link
          aria-label="カート"
          className="inline-flex size-11 items-center justify-center"
          href="/cart"
        >
          <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
            <path
              d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20.5 7H6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
            <circle cx="10" cy="19" fill="currentColor" r="1" />
            <circle cx="18" cy="19" fill="currentColor" r="1" />
          </svg>
        </Link>
      ) : null}
      <details className="relative">
        <summary
          className="flex min-h-11 cursor-pointer list-none items-center text-[10px] font-semibold tracking-[0.04em] underline-offset-4 hover:underline sm:text-[11px] sm:tracking-[0.08em]"
          role="button"
        >
          マイページ
        </summary>
        <div className="absolute right-0 top-full z-50 mt-2 w-64 border border-line bg-surface p-4 text-left shadow-lg">
          <p className="break-all text-xs text-muted">{state.user.email}</p>
          <nav aria-label="マイページ" className="mt-4 grid gap-1">
            {admin ? (
              <Link
                className="inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline"
                href="/admin/products"
              >
                商品管理
              </Link>
            ) : null}
            <Link
              className="inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline"
              href={admin ? '/admin/orders' : '/orders'}
            >
              注文履歴
            </Link>
          </nav>
          <button
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4 disabled:cursor-wait disabled:opacity-60"
            disabled={isLoggingOut}
            onClick={async () => {
              if (isLoggingOut) return
              setLogoutError(false)
              setIsLoggingOut(true)
              try {
                await logout()
              } catch {
                setLogoutError(true)
              } finally {
                setIsLoggingOut(false)
              }
            }}
            type="button"
          >
            {isLoggingOut ? 'ログアウト中…' : 'ログアウト'}
          </button>
          {logoutError ? (
            <p aria-live="assertive" className="mt-1 text-xs text-red-700" role="alert">
              失敗しました。再度お試しください。
            </p>
          ) : null}
        </div>
      </details>
    </div>
  )
}
