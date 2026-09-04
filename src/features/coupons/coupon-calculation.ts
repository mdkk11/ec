import type { Temporal } from '@/lib/date-time/temporal'

export type CouponConditionCode =
  | 'COUPON_INACTIVE'
  | 'COUPON_NOT_STARTED'
  | 'COUPON_EXPIRED'
  | 'COUPON_MINIMUM_NOT_MET'

export type CouponTerms = {
  code: string
  discountPercent: number
  minimumSubtotal: number
  startsAt: Temporal.Instant
  endsAt: Temporal.Instant
  isActive: boolean
}

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase()
}

function assertMoney(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('クーポンの金額は安全な0以上の整数で指定してください。')
  }
}

export function calculateDiscountAmount(subtotal: number, discountPercent: number) {
  assertMoney(subtotal)
  if (!Number.isSafeInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
    throw new RangeError('割引率は1以上100以下の整数で指定してください。')
  }

  const discount = (BigInt(subtotal) * BigInt(discountPercent)) / 100n
  if (discount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('クーポンの割引額が安全な整数範囲を超えています。')
  }
  return Number(discount)
}

export function evaluateCoupon(
  coupon: CouponTerms,
  subtotal: number,
  evaluatedAt: Temporal.Instant,
): CouponConditionCode | null {
  assertMoney(subtotal)
  if (!coupon.isActive) return 'COUPON_INACTIVE'
  if (evaluatedAt.epochNanoseconds < coupon.startsAt.epochNanoseconds) {
    return 'COUPON_NOT_STARTED'
  }
  if (evaluatedAt.epochNanoseconds >= coupon.endsAt.epochNanoseconds) {
    return 'COUPON_EXPIRED'
  }
  if (subtotal < coupon.minimumSubtotal) {
    return 'COUPON_MINIMUM_NOT_MET'
  }
  return null
}
