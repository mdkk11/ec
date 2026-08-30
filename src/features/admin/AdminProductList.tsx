import Image from 'next/image'
import Link from 'next/link'

import type { AdminProductDto } from '@/contracts/product'
import { formatPrice } from '@/features/products/format-price'

export function AdminProductList({ items }: { items: AdminProductDto[] }) {
  return (
    <section>
      <h2 className="font-serif text-3xl">商品一覧</h2>
      <p className="mt-2 text-sm text-muted">{items.length}件</p>
      {items.length === 0 ? (
        <div className="mt-6 border border-line bg-surface p-8 text-center">
          <h3 className="font-serif text-2xl">商品はまだありません</h3>
          <p className="mt-3 text-sm text-muted">右のフォームから最初の商品を作成してください。</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {items.map((product) => (
            <li
              className="grid gap-4 py-5 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center"
              key={product.id}
            >
              <div className="relative aspect-[3/4] w-20 overflow-hidden bg-[#ebeae6]">
                <Image
                  alt={product.name}
                  className="object-cover"
                  fill
                  sizes="80px"
                  src={product.imagePath}
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-2xl">{product.name}</h3>
                  <span
                    className={`text-xs font-semibold ${
                      product.isPublished ? 'text-ink' : 'text-accent'
                    }`}
                  >
                    {product.isPublished ? '公開' : '非公開'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {formatPrice(product.price)} / 在庫 {product.stock} / version {product.version}
                </p>
              </div>
              <Link className="button-secondary" href={`/admin/products/${product.id}`}>
                編集する
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
