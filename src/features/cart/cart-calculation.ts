import { createHash } from 'node:crypto'

import type {
  CartDto,
  CartItemDto,
  CheckoutIssueDto,
} from '@/contracts/cart'

export type CartRecord = {
  id: string
  version: number
  items: Array<{
    id: string
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

export function calculateCart(record: CartRecord): CartDto {
  const sortedItems = [...record.items].sort((left, right) =>
    left.productId.localeCompare(right.productId),
  )
  const items: CartItemDto[] = sortedItems.map((item) => ({
    availability: availabilityFor(item),
    id: item.id,
    lineTotal: multiplyMoney(item.unitPrice, item.quantity),
    name: item.name,
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }))
  const subtotal = items.reduce(
    (sum, item) => addMoney(sum, item.lineTotal),
    0,
  )
  const issues: CheckoutIssueDto[] = []
  for (const item of sortedItems) {
    if (!item.isPublished) {
      issues.push({ code: 'PRODUCT_UNAVAILABLE', itemId: item.id })
    } else if (item.quantity > item.stock) {
      issues.push({ code: 'STOCK_CONFLICT', itemId: item.id })
    }
  }
  const discountAmount = 0
  const total = subtotal

  const checkoutToken =
    items.length === 0 || issues.length > 0
      ? null
      : createCheckoutToken({
          discountAmount,
          items: sortedItems,
          subtotal,
          total,
          version: record.version,
        })

  return {
    checkoutToken,
    coupon: null,
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
    coupon: null,
    subtotal: input.subtotal,
    discountAmount: input.discountAmount,
    total: input.total,
  }

  return createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex')
}
