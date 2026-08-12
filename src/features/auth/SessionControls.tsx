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
        Login
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-1 whitespace-nowrap text-right sm:gap-3">
      {state.user.role === 'customer' ? (
        <>
          <Link
            className="inline-flex min-h-11 items-center text-[10px] font-semibold tracking-[0.02em] underline-offset-4 hover:underline sm:text-[11px] sm:tracking-[0.06em]"
            href="/orders"
          >
            Orders
          </Link>
          <Link
            className="inline-flex min-h-11 items-center text-[10px] font-semibold tracking-[0.02em] underline-offset-4 hover:underline sm:text-[11px] sm:tracking-[0.06em]"
            href="/cart"
          >
            Cart
          </Link>
        </>
      ) : (
        <>
          <Link
            className="inline-flex min-h-11 items-center text-[10px] font-semibold tracking-[0.02em] underline-offset-4 hover:underline sm:text-[11px] sm:tracking-[0.06em]"
            href="/admin/products"
          >
            Products
          </Link>
          <Link
            className="inline-flex min-h-11 items-center text-[10px] font-semibold tracking-[0.02em] underline-offset-4 hover:underline sm:text-[11px] sm:tracking-[0.06em]"
            href="/admin/orders"
          >
            Orders
          </Link>
        </>
      )}
      <div className="shrink-0">
        <p
          className="hidden max-w-40 truncate text-[10px] text-muted sm:block sm:text-[11px]"
          title={state.user.email}
        >
          {state.user.email}
        </p>
        <button
          className="inline-flex min-h-11 items-center text-[10px] font-semibold tracking-[0.02em] underline underline-offset-4 disabled:cursor-wait disabled:opacity-60 sm:min-h-0 sm:tracking-[0.06em]"
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
          {isLoggingOut ? 'ログアウト中…' : 'Logout'}
        </button>
        {logoutError ? (
          <p
            aria-live="assertive"
            className="mt-1 text-[10px] text-red-700"
            role="alert"
          >
            失敗しました。再度お試しください。
          </p>
        ) : null}
      </div>
    </div>
  )
}
