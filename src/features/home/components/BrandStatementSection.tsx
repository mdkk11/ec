export function BrandStatementSection() {
  return (
    <section
      aria-labelledby="journal-heading"
      className="section-space bg-ink text-white"
      id="journal"
    >
      <div className="page-wrap grid gap-12 py-20 sm:py-28 lg:grid-cols-12 lg:items-center lg:py-36">
        <div className="lg:col-span-4">
          <p className="label text-white/55">OUR POINT OF VIEW</p>
          <h2
            className="mt-5 max-w-[8ch] font-serif text-5xl leading-[0.95] tracking-tight sm:text-6xl"
            id="journal-heading"
          >
            Better things, kept longer.
          </h2>
        </div>
        <div className="lg:col-span-5 lg:col-start-7">
          <p className="text-lg leading-9 text-white/75 sm:text-xl">
            私たちが選ぶのは、時間とともに良くなるもの。つくり手の背景、素材の手触り、手入れの方法まで、ひとつずつ丁寧に届けます。
          </p>
          <p className="mt-8 text-xs font-semibold tracking-[0.1em] text-white/65">
            MOCKSHOP / OUR POINT OF VIEW
          </p>
        </div>
      </div>
    </section>
  )
}
