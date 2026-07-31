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
        className="text-[11px] font-semibold tracking-[0.08em] underline-offset-4 hover:underline"
        href="/login"
      >
        ログイン
      </Link>
    )
  }

  return (
    <div className="flex max-w-52 items-center gap-3 text-right sm:max-w-72">
      {state.user.role === 'customer' ? (
        <>
          <Link
            className="text-[11px] font-semibold tracking-[0.06em] underline-offset-4 hover:underline"
            href="/orders"
          >
            注文履歴
          </Link>
          <Link
            className="text-[11px] font-semibold tracking-[0.06em] underline-offset-4 hover:underline"
            href="/cart"
          >
            カート
          </Link>
        </>
      ) : null}
      <div>
        <p
          className="truncate text-[10px] text-muted sm:text-[11px]"
          title={state.user.email}
        >
          {state.user.email}
        </p>
        <button
          className="mt-1 text-[10px] font-semibold tracking-[0.06em] underline underline-offset-4 disabled:cursor-wait disabled:opacity-60"
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
