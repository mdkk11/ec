import Image from 'next/image'
import Link from 'next/link'

import type { ProductDto } from '@/contracts/product'

import { formatPrice } from './format-price'

export function ProductCard({ product }: { product: ProductDto }) {
  const outOfStock = product.availability === 'out_of_stock'

  return (
    <article className="group min-w-0">
      <Link
        aria-label={`${product.name}の詳細を見る`}
        className="block"
        href={`/products/${product.id}`}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-[#ebeae6]">
          <Image
            alt={product.name}
            className={`object-cover transition-transform duration-500 ease-out motion-reduce:transition-none ${
              outOfStock
                ? 'opacity-70 grayscale-[20%]'
                : 'group-hover:scale-[1.025]'
            }`}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            src={product.imagePath}
          />
          {outOfStock ? (
            <span className="absolute bottom-3 left-3 bg-surface px-3 py-2 text-[10px] font-semibold tracking-[0.12em]">
              在庫切れ
            </span>
          ) : null}
        </div>
        <div className="pt-4">
          <h2 className="text-sm leading-6">{product.name}</h2>
          <p className="mt-2 text-sm tabular-nums text-muted">
            {formatPrice(product.price)}
          </p>
        </div>
      </Link>
    </article>
  )
}
