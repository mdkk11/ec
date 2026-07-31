import type { Metadata } from 'next'

import { OrderAccessView } from '@/features/orders/OrderAccessView'
import { OrderHistoryView } from '@/features/orders/OrderHistoryView'
import { loadOrderHistoryPageData } from '@/features/orders/server/order-page-data'

export const metadata: Metadata = {
  title: '注文履歴',
}

export const dynamic = 'force-dynamic'

export default async function Page() {
  const data = await loadOrderHistoryPageData()
  if (data.access.status !== 'authorized') {
    return <OrderAccessView status={data.access.status} />
  }
  return <OrderHistoryView items={data.items ?? []} status="success" />
}
