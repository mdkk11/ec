export function OrderDetailLoadingView() {
  return (
    <section className="page-wrap py-16 sm:py-24">
      <div aria-live="polite" className="text-center" role="status">
        <h1 className="font-serif text-4xl sm:text-5xl">
          注文詳細を読み込んでいます
        </h1>
        <p className="mt-5 text-sm text-muted">しばらくお待ちください。</p>
      </div>
    </section>
  )
}
