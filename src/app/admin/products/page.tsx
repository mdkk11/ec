import type { Metadata } from 'next'

import { AdminProductsPage } from '@/features/admin/AdminProductsPage'

export const metadata: Metadata = {
  title: '商品管理',
}

export default function Page() {
  return <AdminProductsPage />
}
