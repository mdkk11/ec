import Link from 'next/link'

export default function NotFound() {
  return (
    <section className="page-wrap py-16 sm:py-24">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="font-serif text-4xl sm:text-5xl">
          注文が見つかりませんでした
        </h1>
        <p className="mt-5 text-sm leading-7 text-muted">
          注文番号を確認するか、注文履歴へ戻ってください。
        </p>
        <Link className="button-primary mt-8" href="/orders">
          注文履歴へ戻る
        </Link>
      </div>
    </section>
  )
}
