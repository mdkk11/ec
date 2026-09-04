import type { Metadata } from 'next'

import { AdminProductEditPage } from '@/features/admin/AdminProductEditPage'

export const metadata: Metadata = {
  title: '商品編集',
}

export default async function Page({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params
  return <AdminProductEditPage productId={productId} />
}
