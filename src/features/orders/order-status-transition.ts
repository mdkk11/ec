import type { OrderStatus } from '@/contracts/order'

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  cancelled: [],
  completed: [],
  processing: ['shipped', 'cancelled'],
  received: ['processing', 'cancelled'],
  shipped: ['completed'],
}

export function getAllowedOrderStatuses(status: OrderStatus) {
  return transitions[status]
}

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
) {
  return transitions[from].includes(to)
}
