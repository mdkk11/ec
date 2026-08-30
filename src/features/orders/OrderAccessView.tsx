import Link from 'next/link'

export function OrderAccessView({ status }: { status: 'forbidden' | 'unauthenticated' }) {
  return (
    <section className="page-wrap py-16 sm:py-24">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="font-serif text-4xl sm:text-5xl">
          {status === 'unauthenticated'
            ? '注文を見るにはログインが必要です'
            : '注文機能は購入者専用です'}
        </h1>
        {status === 'unauthenticated' ? (
          <Link className="button-primary mt-8" href="/login">
            ログイン
          </Link>
        ) : (
          <p className="mt-5 text-sm leading-7 text-muted">
            管理者アカウントでは購入者の注文を利用できません。
          </p>
        )}
      </div>
    </section>
  )
}
