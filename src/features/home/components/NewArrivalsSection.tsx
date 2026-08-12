import { ProductPreviewCard } from '@/features/home/components/ProductPreviewCard'
import { previewProducts } from '@/features/home/home-content'

export function NewArrivalsSection() {
  return (
    <section
      aria-labelledby="new-heading"
      className="page-wrap section-space pt-24 lg:pt-36"
      id="new"
    >
      <div className="section-heading border-b border-line pb-6">
        <div>
          <p className="label text-accent">JUST ARRIVED</p>
          <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl" id="new-heading">
            New essentials
          </h2>
        </div>
        <p className="text-xs font-semibold tracking-[0.08em] text-muted">
          {previewProducts.length} ITEMS
        </p>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
        {previewProducts.map((product) => (
          <ProductPreviewCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
