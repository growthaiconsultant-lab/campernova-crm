import Image from 'next/image'
import Link from 'next/link'

export function SellBlock() {
  return (
    <section className="px-8 py-20 max-[640px]:px-5">
      <div className="mx-auto max-w-[1280px]">
        <div
          className="relative overflow-hidden rounded-[24px]"
          style={{ background: 'var(--cn-teal-900)' }}
        >
          <div className="relative grid gap-10 px-12 py-14 max-[640px]:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <p
                className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--cn-terra-500)' }}
              >
                · Para vendedores
              </p>
              <h2
                className="mb-5 text-[1.75rem] font-bold leading-tight tracking-[-0.025em] text-white lg:text-[2.2rem]"
                style={{ fontFamily: 'var(--font-fraunces)' }}
              >
                ¿Tu camper lleva meses sin salir del garaje?
              </h2>
              <p
                className="mb-8 max-w-[46ch] text-[15px] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.70)' }}
              >
                Tasación gratuita, sin compromiso y sin perder una tarde. Cuando quieras vender, ya
                sabrás cuánto vale.
              </p>
              <Link
                href="/vender"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--cn-terra-500)' }}
              >
                Calcular el precio de mi camper
                <svg
                  width="15"
                  height="15"
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
              <p className="mt-4 text-[12px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
                Sin coste · Sin compromiso · Respuesta en 24h
              </p>
            </div>

            <div className="relative hidden h-[300px] overflow-hidden rounded-[16px] lg:block">
              <Image
                src="/images/landing/hero-sunset-couple.png"
                alt="Propietarios junto a su camper al atardecer"
                fill
                className="object-cover"
                sizes="(max-width: 1280px) 50vw, 600px"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to right, rgba(26,58,55,0.55) 0%, transparent 60%)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
