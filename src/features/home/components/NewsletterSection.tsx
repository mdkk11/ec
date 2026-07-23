import { ArrowRightIcon } from '@/components/icons/ArrowRightIcon'

export function NewsletterSection() {
  return (
    <section aria-labelledby="newsletter-heading" className="page-wrap py-20 sm:py-28">
      <div className="grid gap-10 border-y border-line py-12 lg:grid-cols-2 lg:items-end lg:py-16">
        <div>
          <p className="label text-muted">STAY IN THE KNOW</p>
          <h2
            className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl"
            id="newsletter-heading"
          >
            A note from MockShop
          </h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-muted">
            新着アイテム、つくり手のストーリー、季節の編集を月に2回お届けします。
          </p>
        </div>
        <div aria-label="メールマガジン登録は準備中" className="flex border-b border-line pb-3">
          <span className="w-full text-sm text-muted">メールマガジン登録は準備中です</span>
          <span className="ml-4 flex shrink-0 items-center gap-2 text-xs font-semibold tracking-[0.08em] text-muted">
            準備中 <ArrowRightIcon />
          </span>
        </div>
      </div>
    </section>
  )
}
