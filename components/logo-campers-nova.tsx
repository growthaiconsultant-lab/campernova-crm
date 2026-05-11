import type { CSSProperties } from 'react'

interface LogoCampersNovaProps {
  variant?: 'dark' | 'cream' | 'white'
  /** Tamaño en px de "NOVA". Cuando se usa, sobreescribe los CSS vars internos. */
  novaSize?: number
  className?: string
  style?: CSSProperties
}

const COLOR_MAP = {
  dark: 'var(--cn-teal-900)',
  cream: '#efe9d8',
  white: '#ffffff',
}

/**
 * Logo tipográfico de CampersNova (Cormorant Garamond).
 *
 * Para responsividad en Tailwind, usa las CSS custom properties que el
 * componente expone en lugar del prop novaSize:
 *
 *   <LogoCampersNova
 *     className="[--logo-nova:24px] [--logo-campers:9px] lg:[--logo-nova:30px] lg:[--logo-campers:11px]"
 *   />
 *
 * Internamente: --logo-nova controla "NOVA", --logo-campers controla "CAMPERS".
 * Si se pasa novaSize, sobreescribe los vars vía style inline.
 */
export function LogoCampersNova({
  variant = 'dark',
  novaSize,
  className,
  style,
}: LogoCampersNovaProps) {
  const color = COLOR_MAP[variant]

  const sizeVars: CSSProperties = novaSize
    ? ({
        '--logo-nova': `${novaSize}px`,
        '--logo-campers': `${Math.round(novaSize * 0.38)}px`,
      } as CSSProperties)
    : {}

  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--font-cormorant), "Cormorant Garamond", "Cormorant", serif',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        lineHeight: 1,
        color,
        userSelect: 'none',
        ...sizeVars,
        ...style,
      }}
      aria-label="CampersNova"
    >
      <span
        style={{
          fontSize: 'var(--logo-campers, 11px)',
          fontWeight: 400,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          display: 'block',
          marginBottom: 'calc(var(--logo-nova, 30px) * 0.04)',
        }}
      >
        Campers
      </span>
      <span
        style={{
          fontSize: 'var(--logo-nova, 30px)',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          display: 'block',
        }}
      >
        Nova
      </span>
    </span>
  )
}
