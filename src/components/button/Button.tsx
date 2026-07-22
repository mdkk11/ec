import type { ButtonHTMLAttributes } from 'react'

const variantClasses = {
  primary: 'border-ink bg-ink text-white hover:bg-[#34342f] active:bg-[#22221f]',
  secondary: 'border-ink bg-transparent text-ink hover:bg-surface active:bg-line',
  text: 'border-transparent bg-transparent px-0 text-ink underline underline-offset-4 active:text-accent',
} as const

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variantClasses
}

export function Button({
  className = '',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center border px-6 text-xs font-semibold tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-muted ${variantClasses[variant]} ${className}`}
      type={type}
      {...props}
    />
  )
}
