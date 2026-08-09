import Link from 'next/link'
import type { ReactNode } from 'react'

import { Button } from '@/components/button/Button'

export function AdminProductStatusPage({
  action,
  children,
  role,
  title,
}: {
  action?: (() => void) | null
  children: ReactNode
  role?: 'alert' | 'status'
  title: string
}) {
  return (
    <section className="page-wrap py-16 sm:py-24">
      <div
        aria-live={role === 'alert' ? 'assertive' : 'polite'}
        className="mx-auto max-w-xl text-center"
        role={role}
      >
        <p className="label text-accent">ADMINISTRATION</p>
        <h1 className="mt-4 font-serif text-4xl sm:text-5xl">{title}</h1>
        <div className="mt-5 text-sm leading-7 text-muted">{children}</div>
        {action ? (
          <Button className="mt-6" onClick={action}>
            再試行
          </Button>
        ) : null}
      </div>
    </section>
  )
}

export function AdminLoginRequired({ resource = '商品管理' }: { resource?: string }) {
  return (
    <AdminProductStatusPage title={`${resource}にはログインが必要です`}>
      <Link className="button-primary mt-4" href="/login">
        ログイン
      </Link>
    </AdminProductStatusPage>
  )
}
