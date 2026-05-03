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
            <div className="absolute left-5 top-5">
              <span
                className="rounded-full px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-white"
                style={{ background: 'rgba(204, 97, 25, 0.92)' }}
              >
                ● PRÓXIMAMENTE
              </span>
            </div>
          </div>

          <div>
            <p
              className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--cn-terra-500)' }}
            >
              · Campers Nova Podcasts
            </p>
            <h2
              className="mb-5 text-[2rem] font-bold leading-tight tracking-[-0.02em] lg:text-[2.4rem]"
              style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
            >
              Estamos preparando algo. Y queremos que estés.
            </h2>
            <p className="mb-8 text-[15px] leading-relaxed" style={{ color: 'var(--cn-ink-500)' }}>
              Desde nuestras instalaciones grabamos charlas con viajeros, mecánicos, fabricantes y
              rutas que merecen contarse. Lanzamos pronto y lo anunciaremos en Instagram.
            </p>

            <a
              href="https://www.instagram.com/campersnova/"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-4 rounded-[16px] px-5 py-4 transition-opacity hover:opacity-80"
              style={{
                background: 'var(--cn-cream-50)',
                border: '1px solid var(--cn-line)',
              }}
            >
              {/* Instagram icon */}
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              >
                <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
                <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.8" fill="none" />
                <circle cx="17.2" cy="6.8" r="1.1" fill="white" />
                <defs>
                  <linearGradient id="ig-grad" x1="0" y1="24" x2="24" y2="0">
                    <stop offset="0%" stopColor="#f09433" />
                    <stop offset="25%" stopColor="#e6683c" />
                    <stop offset="50%" stopColor="#dc2743" />
                    <stop offset="75%" stopColor="#cc2366" />
                    <stop offset="100%" stopColor="#bc1888" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="flex-1">
                <p className="text-[14px] font-semibold" style={{ color: 'var(--cn-teal-900)' }}>
                  @campersnova
                </p>
                <p className="text-[12px]" style={{ color: 'var(--cn-ink-500)' }}>
                  Síguenos para enterarte el primero del lanzamiento
                </p>
              </div>

              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
                style={{ color: 'var(--cn-ink-500)', flexShrink: 0 }}
              >
                <path d="M5 12h14" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
