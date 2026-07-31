import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { orderIdSchema } from '@/contracts/order'
import { OrderAccessView } from '@/features/orders/OrderAccessView'
import { OrderDetailView } from '@/features/orders/OrderDetailView'
import { loadOrderDetailPageData } from '@/features/orders/server/order-page-data'

export const metadata: Metadata = {
  title: '注文詳細',
}

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const parsedId = orderIdSchema.safeParse(orderId)
  if (!parsedId.success) notFound()

  const data = await loadOrderDetailPageData(parsedId.data)
  if (data.access.status !== 'authorized') {
    return <OrderAccessView status={data.access.status} />
  }
  if (!data.order) notFound()
  return <OrderDetailView order={data.order} />
}
