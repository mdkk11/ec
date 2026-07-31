import type { OrderStatus } from '@/contracts/order'
import { Temporal } from '@/lib/date-time/temporal'

export function orderStatusLabel(status: OrderStatus) {
  switch (status) {
    case 'received':
      return '受付'
    case 'processing':
      return '処理中'
    case 'shipped':
      return '発送済み'
    case 'completed':
      return '完了'
    case 'cancelled':
      return '取消'
  }
}

export function formatOrderDate(createdAt: string) {
  const date = Temporal.Instant.from(createdAt).toZonedDateTimeISO(
    'Asia/Tokyo',
  )
  return `${date.year}年${date.month}月${date.day}日 ${String(date.hour).padStart(2, '0')}:${String(date.minute).padStart(2, '0')}`
}
