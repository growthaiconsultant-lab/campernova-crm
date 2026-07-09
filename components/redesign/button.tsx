import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Botones del rediseño (ESPEC §4/§5): primaria = --brand (hover --brand2);
 * secundaria = borde --line (hover fondo --bg). Radio 10px, texto 12.5–13/600.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand2',
  secondary: 'border border-line bg-card text-ink hover:bg-canvas',
  ghost: 'text-ink2 hover:bg-line2 hover:text-ink',
  danger: 'border border-line bg-card text-bad hover:bg-bad-tint',
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[12.5px] gap-1.5 rounded-[9px]',
  md: 'h-10 px-[15px] text-[13px] gap-[7px] rounded-[10px]',
}

interface BaseProps {
  variant?: Variant
  size?: Size
  className?: string
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: BaseProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap font-hanken font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  href,
}: BaseProps & { href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap font-hanken font-semibold transition-colors',
        VARIANT[variant],
        SIZE[size],
        className
      )}
    >
      {children}
    </Link>
  )
}
