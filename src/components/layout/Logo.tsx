import Link from 'next/link'

export function Logo() {
  return (
    <Link
      aria-label="MockShop トップへ"
      className="text-sm font-bold tracking-[0.12em] text-ink sm:text-[1.4rem] sm:tracking-[0.32em]"
      href="/"
    >
      MockShop
    </Link>
  )
}
