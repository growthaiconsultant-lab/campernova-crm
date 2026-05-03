import Link from 'next/link'

const STEPS = [
  {
    num: '01',
    title: 'Cuéntanos sobre tu camper',
    desc: 'Rellenas un formulario rápido con datos y fotos. Menos de 5 minutos.',
  },
  {
    num: '02',
    title: 'Tasación gratuita en 24h',
    desc: 'Un agente revisa todo y te llama con el precio definitivo y los siguientes pasos.',
  },
  {
    num: '03',
    title: 'Publicamos y filtramos compradores',
    desc: 'Gestionamos el anuncio y filtramos visitas: solo compradores reales llegan a ti.',
  },
  {
    num: '04',
    title: 'Cierre y papeleo',
    desc: 'Cuando aparece la oferta correcta, gestionamos la transferencia y el ITP. Tú firmas y cobras.',
  },
]

export function HowItWorksSection() {
  return (
    <section className="px-8 py-20 max-[640px]:px-5" style={{ background: 'var(--cn-teal-900)' }}>
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-14 text-center">
          <p
            className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'var(--cn-terra-500)' }}
          >
            · Cómo funciona
          </p>
          <h2
            className="mb-4 text-[2rem] font-bold leading-tight tracking-[-0.02em] text-white lg:text-[2.4rem]"
            style={{ fontFamily: 'var(--font-fraunces)' }}
          >
            Vende en 4 pasos. Nosotros hacemos el resto.
          </h2>
          <p
            className="mx-auto max-w-[52ch] text-[15px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            Sin intermediarios opacos, sin papeleo complicado, sin esperas interminables. Solo un
            proceso claro desde la tasación hasta el cobro.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ num, title, desc }) => (
            <div
              key={num}
              className="rounded-[16px] p-6"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
            >
              <span
                className="mb-4 block font-mono text-[2.5rem] font-bold leading-none"
                style={{ color: 'rgba(255,255,255,0.15)' }}
              >
                {num}
              </span>
              <h3 className="mb-2 text-[15px] font-semibold leading-snug text-white">{title}</h3>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.60)' }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            href="/vender"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--cn-terra-500)' }}
          >
            Empezar la tasación gratuita
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
    </section>
  )
}
