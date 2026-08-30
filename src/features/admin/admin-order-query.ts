import type { OrderDto } from '@/contracts/order'

export function adminOrdersQueryKey(adminId: string) {
  return ['admin-orders', adminId] as const
}

export function replaceAdminOrder(items: OrderDto[] | undefined, order: OrderDto) {
  if (!items) return [order]
  return items.map((item) => (item.id === order.id ? order : item))
}
