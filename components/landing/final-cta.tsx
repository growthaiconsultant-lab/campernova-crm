import Link from 'next/link'

export function FinalCta() {
  return (
    <section
      className="px-8 py-24 text-center max-[640px]:px-5"
      style={{ background: 'var(--cn-teal-900)' }}
    >
      <div className="mx-auto max-w-[640px]">
        <p
          className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: 'var(--cn-terra-500)' }}
        >
          · Empieza hoy
        </p>
        <h2
          className="mb-5 text-[2rem] font-bold leading-tight tracking-[-0.025em] text-white lg:text-[2.8rem]"
          style={{ fontFamily: 'var(--font-fraunces)' }}
        >
          ¿Listo para vender tu camper?
        </h2>
        <p
          className="mb-10 text-[16px] leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.68)' }}
        >
          Empieza con una tasación gratuita. Sin compromiso. Te respondemos en 24h.
        </p>
        <Link
          href="/vender"
          className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--cn-terra-500)' }}
        >
          Calcular el precio de mi camper
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="M13 5l7 7-7 7" />
          </svg>
        </Link>
        <p className="mt-5 text-[12px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
          O escríbenos a{' '}
          <a
            href="mailto:info@campersnova.com"
            className="underline underline-offset-2 transition-opacity hover:opacity-80"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            info@campersnova.com
          </a>
        </p>
      </div>
    </section>
  )
}
