import { createHash } from 'node:crypto'

import type { AppliedCouponDto, CartDto, CartItemDto, CheckoutIssueDto } from '@/contracts/cart'
import { calculateDiscountAmount, evaluateCoupon } from '@/features/coupons/coupon-calculation'
import { Temporal } from '@/lib/date-time/temporal'

export type CartCouponRecord = {
  code: string
  discountPercent: number
  minimumSubtotal: number
  startsAt: string
  endsAt: string
  isActive: boolean
}

export type CartRecord = {
  id: string
  version: number
  coupon: CartCouponRecord | null
  items: Array<{
    id: string
    imagePath: string
    productId: string
    name: string
    unitPrice: number
    quantity: number
    isPublished: boolean
    stock: number
  }>
}

function availabilityFor(item: CartRecord['items'][number]) {
  if (!item.isPublished) return 'unpublished' as const
  if (item.stock === 0) return 'out_of_stock' as const
  return 'available' as const
}

function multiplyMoney(left: number, right: number) {
  const result = left * right
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('カートの金額が安全な整数範囲を超えています。')
  }
  return result
}

function addMoney(left: number, right: number) {
  const result = left + right
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('カートの金額が安全な整数範囲を超えています。')
  }
  return result
}

function assertSafeInteger(value: number) {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError('カートの数値が安全な整数範囲を超えています。')
  }
}

function couponDto(coupon: CartCouponRecord): AppliedCouponDto {
  return {
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    minimumSubtotal: coupon.minimumSubtotal,
    startsAt: coupon.startsAt,
    endsAt: coupon.endsAt,
  }
}

export function calculateCart(record: CartRecord, evaluatedAt: Temporal.Instant): CartDto {
  const sortedItems = [...record.items].sort((left, right) =>
    left.productId.localeCompare(right.productId),
  )
  const items: CartItemDto[] = sortedItems.map((item) => ({
    availability: availabilityFor(item),
    availableStock: item.stock,
    id: item.id,
    imagePath: item.imagePath,
    lineTotal: multiplyMoney(item.unitPrice, item.quantity),
    name: item.name,
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }))
  const subtotal = items.reduce((sum, item) => addMoney(sum, item.lineTotal), 0)
  const issues: CheckoutIssueDto[] = []
  for (const item of sortedItems) {
    if (!item.isPublished) {
      issues.push({ code: 'PRODUCT_UNAVAILABLE', itemId: item.id })
    } else if (item.quantity > item.stock) {
      issues.push({ code: 'STOCK_CONFLICT', itemId: item.id })
    }
  }
  let discountAmount = 0
  if (record.coupon) {
    const couponIssue = evaluateCoupon(
      {
        ...record.coupon,
        startsAt: Temporal.Instant.from(record.coupon.startsAt),
        endsAt: Temporal.Instant.from(record.coupon.endsAt),
      },
      subtotal,
      evaluatedAt,
    )
    if (couponIssue) {
      issues.push({ code: couponIssue })
    } else {
      discountAmount = calculateDiscountAmount(subtotal, record.coupon.discountPercent)
    }
  }
  const total = subtotal - discountAmount

  const checkoutToken =
    items.length === 0 || issues.length > 0
      ? null
      : createCheckoutToken({
          discountAmount,
          coupon: record.coupon,
          items: sortedItems,
          subtotal,
          total,
          version: record.version,
        })

  return {
    checkoutToken,
    coupon: record.coupon ? couponDto(record.coupon) : null,
    discountAmount,
    id: record.id,
    issues,
    items,
    subtotal,
    total,
    version: record.version,
  }
}

export function createCheckoutToken(input: {
  discountAmount: number
  coupon: CartCouponRecord | null
  items: CartRecord['items']
  subtotal: number
  total: number
  version: number
}) {
  assertSafeInteger(input.version)
  assertSafeInteger(input.subtotal)
  assertSafeInteger(input.discountAmount)
  assertSafeInteger(input.total)
  for (const item of input.items) {
    assertSafeInteger(item.quantity)
    assertSafeInteger(item.unitPrice)
  }

  const canonical = {
    version: input.version,
    items: [...input.items]
      .sort((left, right) => left.productId.localeCompare(right.productId))
      .map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        name: item.name,
        unitPrice: item.unitPrice,
        isPublished: item.isPublished,
      })),
    coupon: input.coupon
      ? {
          code: input.coupon.code,
          discountPercent: input.coupon.discountPercent,
          minimumSubtotal: input.coupon.minimumSubtotal,
          startsAt: input.coupon.startsAt,
          endsAt: input.coupon.endsAt,
          isActive: input.coupon.isActive,
        }
      : null,
    subtotal: input.subtotal,
    discountAmount: input.discountAmount,
    total: input.total,
  }

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}
