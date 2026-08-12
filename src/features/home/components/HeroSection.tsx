import Image from 'next/image'
import Link from 'next/link'

import { ArrowRightIcon } from '@/components/icons/ArrowRightIcon'

export function HeroSection() {
  return (
    <section aria-labelledby="hero-title" className="page-wrap py-5 sm:py-8 lg:py-10">
      <div className="grid min-h-[620px] overflow-hidden bg-sage lg:min-h-[680px] lg:grid-cols-12">
        <div className="relative z-10 flex flex-col justify-between px-6 py-8 sm:px-10 sm:py-11 lg:col-span-5 lg:px-14 lg:py-14">
          <p className="label">SPRING / SUMMER 2026</p>
          <div className="py-16 lg:py-8">
            <h1
              className="max-w-[9ch] font-serif text-[clamp(3.4rem,7vw,7.4rem)] leading-[0.84] tracking-[-0.045em]"
              id="hero-title"
            >
              Made for quieter days.
            </h1>
            <p className="mt-7 max-w-sm text-sm leading-7 sm:text-base">
              軽やかな素材と落ち着いた色を、春から夏の日常へ。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="button-primary" href="/products">
                新着を見る <ArrowRightIcon />
              </Link>
              <a className="button-secondary" href="#edit">
                コレクションを見る
              </a>
            </div>
          </div>
          <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.12em]">
            <span aria-hidden="true" className="h-px w-9 bg-ink" />
            EDIT 01 — LIGHT LAYERS
          </p>
        </div>

        <div className="relative min-h-[420px] lg:col-span-7 lg:min-h-full">
          <Image
            alt="春の軽やかなレイヤードスタイル"
            className="object-cover object-center"
            fill
            priority
            sizes="(min-width: 1024px) 58vw, 100vw"
            src="/images/home/hero.jpg"
          />
        </div>
      </div>
    </section>
  )
}
