import Image from 'next/image'
import Link from 'next/link'

export function HeroSection() {
  return (
    <section id="main-content" className="relative min-h-[88vh] overflow-hidden">
      {/* Background image */}
      <Image
        src="/images/landing/hero-vw-bus.jpg"
        alt="Camper en ruta — CampersNova"
        fill
        className="object-cover object-center"
        priority
        sizes="100vw"
      />

      {/* Gradient overlay — dark on left, fades right */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(26,58,55,0.90) 0%, rgba(26,58,55,0.60) 50%, rgba(26,58,55,0.25) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative flex min-h-[88vh] flex-col justify-center px-8 pb-28 pt-32 max-[640px]:px-5">
        <div className="mx-auto w-full max-w-[1280px]">
          <div className="max-w-[600px]">
            <p
              className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'rgba(255,255,255,0.80)' }}
            >
              · Compraventa de campers y autocaravanas
            </p>

            <h1
              className="mb-5 text-[2.8rem] font-bold leading-[1.1] tracking-[-0.025em] text-white max-[640px]:text-[2.1rem] lg:text-[3.5rem]"
              style={{ fontFamily: 'var(--font-fraunces)' }}
            >
              Compra o vende tu camper o autocaravana con confianza y alma viajera.
            </h1>

            <p
              className="mb-9 max-w-[50ch] text-[1.05rem] leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.72)' }}
            >
              En CampersNova conectamos personas que quieren vivir la carretera con propietarios que
              quieren vender de forma segura, profesional y transparente.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/comprar"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--cn-terra-500)' }}
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
                >
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/vender"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-semibold text-white transition-colors"
                style={{ border: '1.5px solid rgba(255,255,255,0.38)' }}
              >
                Quiero vender mi vehículo
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Meta pills — bottom left */}
      <div className="absolute bottom-8 left-8 flex flex-wrap gap-2 max-[640px]:left-5">
        <span
          className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium text-white"
          style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
        >
          ⭐ 4,6 · 36 reseñas en Google
        </span>
        <span
          className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium text-white"
          style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
        >
          · Barcelona · Custodia en instalaciones
        </span>
      </div>
    </section>
  )
}
