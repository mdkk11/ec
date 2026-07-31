'use client'

import { OrderHistoryView } from '@/features/orders/OrderHistoryView'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <OrderHistoryView onRetry={reset} status="error" />
}
