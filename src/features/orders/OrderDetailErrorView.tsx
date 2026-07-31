'use client'

import { Button } from '@/components/button/Button'

export function OrderDetailErrorView({
  onRetry,
  variant = 'detail',
}: {
  onRetry: () => void
  variant?: 'complete' | 'detail'
}) {
  const subject = variant === 'complete' ? '注文完了内容' : '注文詳細'

  return (
    <section className="page-wrap py-16 sm:py-24">
      <div
        aria-live="assertive"
        className="mx-auto max-w-xl text-center"
        role="alert"
      >
        <h1 className="font-serif text-4xl sm:text-5xl">
          {subject}を読み込めませんでした
        </h1>
        <p className="mt-5 text-sm leading-7 text-muted">
          時間をおいて、もう一度お試しください。
        </p>
        <Button className="mt-8" onClick={onRetry}>
          再試行
        </Button>
      </div>
    </section>
  )
}
