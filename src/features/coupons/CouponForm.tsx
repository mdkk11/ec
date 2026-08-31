'use client'

import { useState } from 'react'

import { Button } from '@/components/button/Button'
import type { AppliedCouponDto, CheckoutIssueDto } from '@/contracts/cart'

type CouponIssueCode = Extract<
  CheckoutIssueDto['code'],
  'COUPON_INACTIVE' | 'COUPON_NOT_STARTED' | 'COUPON_EXPIRED' | 'COUPON_MINIMUM_NOT_MET'
>

type CouponFormProps = {
  coupon: AppliedCouponDto | null
  disabled?: boolean
  errorMessage?: string | null
  issueCode?: CouponIssueCode | null
  onApply: (code: string) => Promise<unknown> | void
  onRemove: () => Promise<unknown> | void
  pending?: 'apply' | 'remove' | null
}

function couponIssueMessage(code: CouponIssueCode) {
  switch (code) {
    case 'COUPON_INACTIVE':
      return '適用中のクーポンは現在利用できません。'
    case 'COUPON_NOT_STARTED':
      return '適用中のクーポンはまだ利用期間前です。'
    case 'COUPON_EXPIRED':
      return '適用中のクーポンは期限切れです。'
    case 'COUPON_MINIMUM_NOT_MET':
      return '商品小計がクーポンの最低購入額を下回っています。'
  }
}

export function CouponForm({
  coupon,
  disabled = false,
  errorMessage = null,
  issueCode = null,
  onApply,
  onRemove,
  pending = null,
}: CouponFormProps) {
  const [code, setCode] = useState('')
  const applying = pending === 'apply'
  const removing = pending === 'remove'

  return (
    <section
      aria-busy={pending !== null}
      aria-labelledby="coupon-heading"
      className="mt-6 border-t border-line pt-6"
    >
      <h3 className="text-sm font-semibold" id="coupon-heading">
        クーポン
      </h3>
      {coupon ? (
        <div className="mt-3">
          <p className="text-sm">
            <span className="font-semibold">{coupon.code}</span>
            <span className="ml-2 text-muted">{coupon.discountPercent}%割引</span>
          </p>
          {issueCode ? (
            <p className="mt-2 text-sm leading-6 text-accent" role="status">
              {couponIssueMessage(issueCode)}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted" role="status">
              クーポンを適用しました。
            </p>
          )}
          <Button
            className="mt-3"
            disabled={disabled || pending !== null}
            onClick={() => void onRemove()}
            variant="text"
          >
            {removing ? '解除中…' : 'クーポンを解除'}
          </Button>
        </div>
      ) : (
        <form
          className="mt-3"
          onSubmit={(event) => {
            void (async () => {
              event.preventDefault()
              const result = await onApply(code)
              if (result) setCode('')
            })()
          }}
        >
          <label className="grid gap-2 text-xs font-semibold" htmlFor="coupon-code">
            クーポンコード
            <input
              autoComplete="off"
              className="h-12 border border-line bg-surface px-4 text-base uppercase"
              disabled={disabled || pending !== null}
              id="coupon-code"
              onChange={(event) => setCode(event.target.value)}
              value={code}
            />
          </label>
          <Button
            className="mt-3 w-full"
            disabled={disabled || pending !== null || code.trim().length === 0}
            type="submit"
            variant="secondary"
          >
            {applying ? '適用中…' : 'クーポンを適用'}
          </Button>
        </form>
      )}
      {errorMessage ? (
        <p className="mt-3 text-sm leading-6 text-accent" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {pending ? (
        <p aria-live="polite" className="sr-only" role="status">
          クーポンを{applying ? '適用' : '解除'}しています。
        </p>
      ) : null}
    </section>
  )
}
