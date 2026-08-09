import type { AdminProductDto } from '@/contracts/product'

export function adminProductsQueryKey(adminId: string) {
  return ['admin-products', adminId] as const
}

export function replaceAdminProduct(
  items: AdminProductDto[] | undefined,
  product: AdminProductDto,
) {
  if (!items) return [product]
  const index = items.findIndex((item) => item.id === product.id)
  if (index === -1) return [product, ...items]
  return items.map((item) => (item.id === product.id ? product : item))
}
