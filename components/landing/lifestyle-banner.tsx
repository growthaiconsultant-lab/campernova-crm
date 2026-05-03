import Image from 'next/image'
import Link from 'next/link'

export function LifestyleBanner() {
  return (
    <section className="px-8 py-12 max-[640px]:px-5">
      <div className="mx-auto max-w-[1280px]">
        <div className="relative h-[480px] overflow-hidden rounded-[24px] max-[640px]:h-[560px]">
          <Image
            src="/images/landing/hero-sunset-couple.png"
            alt="Pareja viajando en camper al atardecer frente a los acantilados"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 1280px"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to right, rgba(8,18,16,0.85) 0%, rgba(8,18,16,0.60) 50%, rgba(8,18,16,0.15) 100%)',
            }}
          />
          <div className="relative flex h-full max-w-[600px] flex-col justify-end px-14 pb-14 pt-10 max-[640px]:px-6 max-[640px]:pb-10">
            <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
              · Lifestyle
            </p>
            <h2
              className="mb-5 text-[2.6rem] font-bold leading-[1.1] tracking-[-0.025em] text-white max-[640px]:text-[2rem]"
              style={{ fontFamily: 'var(--font-fraunces)' }}
            >
              La carretera empieza mucho antes de arrancar el motor.
            </h2>
            <p className="mb-9 max-w-[46ch] text-[15px] leading-relaxed text-white/75">
              Empieza cuando decides que quieres viajar diferente, dormir donde el paisaje lo merece
              y tener la libertad de cambiar de plan cuando quieras. En Campers Nova te ayudamos a
              dar ese paso con seguridad.
            </p>
            <Link
              href="/comprar"
              className="inline-flex items-center gap-2 self-start rounded-full bg-white px-7 py-3.5 text-[14px] font-semibold transition-opacity hover:opacity-90"
              style={{ color: 'var(--cn-teal-900)' }}
            >
              Empezar la conversación
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
          </div>
        </div>
      </div>
    </section>
  )
}
