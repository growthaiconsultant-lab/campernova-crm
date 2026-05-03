const TESTIMONIALS = [
  {
    name: 'Marta & Carlos',
    meta: 'Vendieron una VW T6 · Bilbao',
    quote:
      'Vendimos nuestra furgo en tres semanas. Nos quitaron de encima la parte que más pereza nos daba: las visitas y los curiosos. Profesionales de verdad.',
  },
  {
    name: 'Lucía Reverte',
    meta: 'Compró una Ford Nugget · Valencia',
    quote:
      'Buscábamos nuestra primera camper sin saber muy bien por dónde empezar. Nos asesoraron sin presión y acabamos comprando con la tranquilidad de que era la correcta.',
  },
  {
    name: 'Iñaki Ferrer',
    meta: 'Vendió una Knaus Boxstar · Madrid',
    quote:
      'El trato cercano marca la diferencia. Te atiende siempre la misma persona y notas que conocen el mundo camper y autocaravana de verdad, no solo el papeleo.',
  },
]

const STARS = (
  <span aria-label="5 estrellas" className="text-[14px]">
    ⭐⭐⭐⭐⭐
  </span>
)

export function TestimonialsSection() {
  return (
    <section className="px-8 py-20 max-[640px]:px-5">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-14 text-center">
          <p
            className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'var(--cn-terra-500)' }}
          >
            · Lo que dicen nuestros clientes
          </p>
          <h2
            className="text-[2rem] font-bold leading-tight tracking-[-0.02em] lg:text-[2.4rem]"
            style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
          >
            Propietarios que ya vendieron con nosotros.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map(({ name, meta, quote }) => (
            <div
              key={name}
              className="flex flex-col rounded-[20px] p-7"
              style={{ background: 'var(--cn-cream-50)', border: '1px solid var(--cn-line)' }}
            >
              {STARS}
              <p
                className="mb-6 mt-4 flex-1 text-[14px] leading-relaxed"
                style={{ color: 'var(--cn-ink-700)' }}
              >
                &ldquo;{quote}&rdquo;
              </p>
              <div className="border-t pt-5" style={{ borderColor: 'var(--cn-line)' }}>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--cn-teal-900)' }}>
                  {name}
                </p>
                <p className="mt-0.5 text-[12px]" style={{ color: 'var(--cn-ink-500)' }}>
                  {meta}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
