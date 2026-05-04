import Image from 'next/image'
import Link from 'next/link'

export function TwoRoutes() {
  return (
    <section className="px-8 py-20 max-[640px]:px-5">
      <div className="mx-auto max-w-[1280px]">
        {/* Section header */}
        <div className="mb-10 grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <p
              className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--cn-terra-500)' }}
            >
              · Dos caminos, un mismo cuidado
            </p>
            <h2
              className="text-[2rem] font-bold leading-tight tracking-[-0.02em] lg:text-[2.4rem]"
              style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
            >
              ¿Empiezas un viaje o cierras uno?
            </h2>
          </div>
          <p
            className="max-w-[52ch] text-[15px] leading-relaxed"
            style={{ color: 'var(--cn-ink-500)' }}
          >
            Elige tu ruta. Cada lado tiene un proceso pensado para que avances sin complicaciones,
            con la seguridad y el acompañamiento que mereces.
          </p>
        </div>

        {/* Route cards */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Comprar */}
          <Link
            href="/comprar"
            className="group relative flex min-h-[440px] flex-col justify-end overflow-hidden"
            style={{ borderRadius: '20px' }}
          >
            <Image
              src="/images/landing/ChatGPT Image 4 may 2026, 09_39_33.png"
              alt="Camper Adria en la playa al atardecer"
              fill
              className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(26,58,55,0.88) 0%, rgba(26,58,55,0.3) 55%, transparent 100%)',
              }}
            />
            <div className="relative p-8">
              <span
                className="mb-4 inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white"
                style={{ background: 'rgba(194,106,74,0.95)' }}
              >
                Comprar
              </span>
              <h3
                className="mb-2 text-[1.35rem] font-bold leading-snug text-white"
                style={{ fontFamily: 'var(--font-fraunces)' }}
              >
                Encuentra tu próxima camper o autocaravana
              </h3>
              <p
                className="mb-5 text-[14px] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                Cuéntanos qué buscas con tus palabras. Te proponemos vehículos reales que encajan
                contigo, sin filtros ni catálogos eternos.
              </p>
              <div
                className="transition-gap inline-flex items-center gap-1.5 text-[13px] font-semibold text-white"
                style={{ color: 'rgba(255,255,255,0.90)' }}
              >
                Empezar conversación
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
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Vender */}
          <Link
            href="/vender"
            className="group relative flex min-h-[440px] flex-col justify-end overflow-hidden"
            style={{ borderRadius: '20px' }}
          >
            <Image
              src="/images/landing/ChatGPT Image 4 may 2026, 10_04_07.png"
              alt="Cierre de venta de autocaravana en instalaciones CampersNova"
              fill
              className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(10,25,22,0.92) 0%, rgba(10,25,22,0.45) 55%, rgba(10,25,22,0.10) 100%)',
              }}
            />
            <div className="relative p-8">
              <span
                className="mb-4 inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
                style={{ background: 'rgba(245,240,230,0.95)', color: 'var(--cn-teal-900)' }}
              >
                Vender
              </span>
              <h3
                className="mb-2 text-[1.35rem] font-bold leading-snug text-white"
                style={{ fontFamily: 'var(--font-fraunces)' }}
              >
                Vende sin complicaciones
              </h3>
              <p
                className="mb-5 text-[14px] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                Valoración profesional, gestión de interesados y acompañamiento hasta el cierre. Tú
                ganas tranquilidad.
              </p>
              <div
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
                style={{ color: 'rgba(255,255,255,0.90)' }}
              >
                Empezar valoración
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
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  )
}
