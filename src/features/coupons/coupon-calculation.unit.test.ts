import { describe, expect, it } from 'vitest'

import { Temporal } from '@/lib/date-time/temporal'

import {
  calculateDiscountAmount,
  evaluateCoupon,
  normalizeCouponCode,
} from './coupon-calculation'

const startsAt = Temporal.Instant.from('2026-01-01T00:00:00Z')
const endsAt = Temporal.Instant.from('2026-02-01T00:00:00Z')
const baseCoupon = {
  code: 'SAVE15',
  discountPercent: 15,
  endsAt,
  isActive: true,
  minimumSubtotal: 10_000,
  startsAt,
}

describe('クーポン計算', () => {
  it('UNIT-COUPON-001: 割引額を整数円へ切り捨てる', () => {
    expect(calculateDiscountAmount(10_001, 15)).toBe(1_500)
  })

  it('UNIT-COUPON-002: 小計0円・100%でも0円を返す', () => {
    expect(calculateDiscountAmount(0, 100)).toBe(0)
  })

  it('UNIT-COUPON-003: 開始日時を利用可能期間に含める', () => {
    expect(evaluateCoupon(baseCoupon, 10_000, startsAt)).toBeNull()
  })

  it('UNIT-COUPON-004: 終了日時を利用可能期間に含めない', () => {
    expect(evaluateCoupon(baseCoupon, 10_000, endsAt)).toBe(
      'COUPON_EXPIRED',
    )
  })

  it('UNIT-COUPON-005/006: 最低購入額と同額を許可し、1円未満を拒否する', () => {
    const now = Temporal.Instant.from('2026-01-15T00:00:00Z')
    expect(evaluateCoupon(baseCoupon, 10_000, now)).toBeNull()
    expect(evaluateCoupon(baseCoupon, 9_999, now)).toBe(
      'COUPON_MINIMUM_NOT_MET',
    )
  })

  it.each([
    [{ ...baseCoupon, isActive: false }, 'COUPON_INACTIVE'],
    [
      baseCoupon,
      'COUPON_NOT_STARTED',
      Temporal.Instant.from('2025-12-31T23:59:59.999999999Z'),
    ],
    [baseCoupon, 'COUPON_EXPIRED', endsAt],
  ] as const)(
    'UNIT-COUPON-007: 条件ごとの原因コードを返す',
    (coupon, expected, evaluatedAt = Temporal.Instant.from('2026-01-15T00:00:00Z')) => {
      expect(evaluateCoupon(coupon, 10_000, evaluatedAt)).toBe(expected)
    },
  )

  it('コードの前後空白を除去して大文字へ正規化する', () => {
    expect(normalizeCouponCode('  welcome15  ')).toBe('WELCOME15')
  })

  it('MAX_SAFE_INTEGER近傍でもBigIntで中間積を正確に計算する', () => {
    expect(calculateDiscountAmount(Number.MAX_SAFE_INTEGER, 15)).toBe(
      1_351_079_888_211_148,
    )
  })

  it('安全な整数ではない金額を拒否する', () => {
    expect(() =>
      calculateDiscountAmount(Number.MAX_SAFE_INTEGER + 1, 15),
    ).toThrow('安全')
  })
})
