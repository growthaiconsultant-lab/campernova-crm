import Image from 'next/image'

export function PodcastSection() {
  return (
    <section className="px-8 py-20 max-[640px]:px-5" style={{ background: 'var(--cn-cream-200)' }}>
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="relative h-[360px] overflow-hidden rounded-[20px]">
            <Image
              src="/images/landing/podcast-studio.jpg"
              alt="Estudio del podcast CampersNova"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>

          <div>
            <p
              className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--cn-terra-500)' }}
            >
              · El podcast del mundo camper
            </p>
            <h2
              className="mb-5 text-[2rem] font-bold leading-tight tracking-[-0.02em] lg:text-[2.4rem]"
              style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
            >
              Hablamos de furgo vida con propietarios, viajeros y expertos.
            </h2>
            <p className="mb-8 text-[15px] leading-relaxed" style={{ color: 'var(--cn-ink-500)' }}>
              Cada semana, conversaciones reales sobre compraventa, rutas, mantenimiento y lo que
              significa vivir sobre ruedas. Sin filtros, con alma.
            </p>

            <div className="flex flex-wrap gap-4">
              <div
                className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium"
                style={{
                  background: 'var(--cn-cream-50)',
                  border: '1px solid var(--cn-line)',
                  color: 'var(--cn-teal-900)',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                </svg>
                Disponible en Spotify
              </div>
              <div
                className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium"
                style={{
                  background: 'var(--cn-cream-50)',
                  border: '1px solid var(--cn-line)',
                  color: 'var(--cn-teal-900)',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                </svg>
                Apple Podcasts
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
