export default function HomePage() {
  return (
    <section className="page-wrap flex min-h-[calc(100vh-15rem)] items-center py-16 sm:py-24">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.16em] text-accent">
          EC TEST SANDBOX
        </p>
        <h1 className="mt-5 max-w-[12ch] font-serif text-5xl leading-[1.04] tracking-[-0.025em] sm:text-6xl lg:text-7xl">
          テスト境界を、わかりやすく。
        </h1>
        <p className="mt-7 max-w-2xl text-sm leading-7 text-muted sm:text-base sm:leading-8">
          MockShopは、単体・結合・E2E・VRTの責任範囲と、失敗原因の追跡しやすさを検証するための小規模ECです。
        </p>
        <dl className="mt-10 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
          {[
            ['Runtime', 'Next.js App Router'],
            ['Language', 'TypeScript strict'],
            ['Fixtures', 'Local & deterministic'],
          ].map(([term, description]) => (
            <div className="bg-surface p-5" key={term}>
              <dt className="text-[10px] font-semibold tracking-[0.14em] text-muted">
                {term}
              </dt>
              <dd className="mt-2 text-sm font-medium">{description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
