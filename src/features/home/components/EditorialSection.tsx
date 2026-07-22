import Image from 'next/image'

import { editorialItems } from '@/features/home/home-content'

export function EditorialSection() {
  return (
    <section aria-labelledby="edit-heading" className="page-wrap section-space" id="edit">
      <div className="section-heading">
        <div>
          <p className="label text-muted">THE SEASONAL EDIT</p>
          <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl" id="edit-heading">
            Curated for now
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-7 text-muted">
          色、素材、佇まいから選んだ、今の暮らしに馴染む3つの編集。
        </p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
        {editorialItems.map((item, index) => (
          <article
            className={`group block ${index === 1 ? 'lg:translate-y-16' : ''}`}
            key={item.title}
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-[#e5e2dc]">
              <Image
                alt=""
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transition-none"
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                src={item.image}
              />
            </div>
            <div className="mt-4 flex items-start justify-between border-t border-ink pt-4">
              <div>
                <p className="label text-muted">EDIT {item.number}</p>
                <h3 className="mt-2 font-serif text-2xl sm:text-3xl">{item.title}</h3>
                <p className="mt-2 text-sm text-muted">{item.caption}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
