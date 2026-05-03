import Image from 'next/image'

export function InspirationSection() {
  return (
    <section className="px-8 py-20 max-[640px]:px-5">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-12 grid gap-8 lg:grid-cols-2 lg:items-end">
          <div>
            <p
              className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--cn-terra-500)' }}
            >
              · Instalaciones y equipo
            </p>
            <h2
              className="text-[2rem] font-bold leading-tight tracking-[-0.02em] lg:text-[2.4rem]"
              style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
            >
              No somos un portal. Somos una empresa con instalaciones propias.
            </h2>
          </div>
          <p
            className="max-w-[52ch] text-[15px] leading-relaxed"
            style={{ color: 'var(--cn-ink-500)' }}
          >
            Tenemos espacio en Barcelona para custodia, limpieza y fotografía profesional. Cada
            vehículo pasa por nuestras manos, no solo por una pantalla.
          </p>
        </div>

        <div className="grid h-[420px] gap-4 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-[16px] md:col-span-2">
            <Image
              src="/images/landing/instalaciones.jpg"
              alt="Instalaciones CampersNova en Barcelona"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 66vw"
            />
          </div>
          <div className="flex flex-col gap-4">
            <div className="relative flex-1 overflow-hidden rounded-[16px]">
              <Image
                src="/images/landing/sell-driver.jpg"
                alt="Entrega de camper a un cliente"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
            <div className="relative flex-1 overflow-hidden rounded-[16px]">
              <Image
                src="/images/landing/hero-sunset-couple.png"
                alt="Propietarios junto a su camper"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
