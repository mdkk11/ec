import Image from 'next/image'

import type { PreviewProduct } from '@/features/home/home-content'

export function ProductPreviewCard({ product }: { product: PreviewProduct }) {
  return (
    <article className="group min-w-0">
      <div className="relative aspect-[3/4] overflow-hidden bg-[#ebeae6]">
        <Image
          alt={product.alt}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transition-none"
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          src={product.image}
        />
      </div>
      <div className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.14em]">{product.brand}</p>
            <h3 className="mt-1.5 truncate text-sm text-muted">{product.name}</h3>
          </div>
          <span
            aria-label={`カラー: ${product.color}`}
            className="mt-0.5 size-2.5 shrink-0 rounded-full border border-black/10"
            role="img"
            style={{ backgroundColor: product.colorValue }}
          />
        </div>
        <p className="mt-2 text-sm tabular-nums">{product.price}</p>
      </div>
    </article>
  )
}
