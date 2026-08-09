import type { Metadata } from 'next'

import { AdminOrdersPage } from '@/features/admin/AdminOrdersPage'

export const metadata: Metadata = {
  title: '注文管理',
}

export default function Page() {
  return <AdminOrdersPage />
}
