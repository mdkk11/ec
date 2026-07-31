'use client'

import { OrderDetailErrorView } from '@/features/orders/OrderDetailErrorView'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <OrderDetailErrorView onRetry={reset} />
}
