import Link from 'next/link'

export function Logo() {
  return (
    <Link
      aria-label="MockShop トップへ"
      className="text-[1.15rem] font-bold tracking-[0.32em] text-ink sm:text-[1.4rem]"
      href="/"
    >
      MockShop
    </Link>
  )
}
