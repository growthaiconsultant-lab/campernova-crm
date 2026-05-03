const PILLARS = [
  {
    stat: 'Solo si vendemos',
    label: '· sin coste de alta',
    desc: 'No pagamos hasta que vendemos tu camper. Sin coste de alta, sin mensualidad. Si no vendemos, no te costamos nada.',
  },
  {
    stat: '42',
    label: 'días de media hasta la venta',
    desc: 'Frente a los 3–6 meses en portales generalistas. Compradores cualificados que ya saben lo que buscan.',
  },
  {
    stat: '0€',
    label: 'de coste por adelantado',
    desc: 'Tasación gratuita, gestión del anuncio y fotos incluidas. Empiezas sin arriesgar nada.',
  },
]

export function WhyUsPillars() {
  return (
    <section className="px-8 py-20 max-[640px]:px-5" style={{ background: 'var(--cn-cream-200)' }}>
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-14 grid gap-8 lg:grid-cols-2 lg:items-end">
          <div>
            <p
              className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--cn-terra-500)' }}
            >
              · Por qué CampersNova
            </p>
            <h2
              className="text-[2rem] font-bold leading-tight tracking-[-0.02em] lg:text-[2.4rem]"
              style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
            >
              El modelo que nos obliga a hacerlo bien.
            </h2>
          </div>
          <p
            className="max-w-[52ch] text-[15px] leading-relaxed"
            style={{ color: 'var(--cn-ink-500)' }}
          >
            Cobramos solo si vendemos. Eso alinea completamente nuestros incentivos con los tuyos.
            Si no encontramos comprador, perdemos el tiempo nosotros, no tú.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PILLARS.map(({ stat, label, desc }) => (
            <div
              key={stat}
              className="rounded-[20px] p-8"
              style={{ background: 'var(--cn-cream-50)', border: '1px solid var(--cn-line)' }}
            >
              <div className="mb-4 flex items-baseline gap-2">
                <span
                  className="font-mono text-[3.5rem] font-bold leading-none tracking-[-0.03em]"
                  style={{ color: 'var(--cn-teal-900)' }}
                >
                  {stat}
                </span>
                <span
                  className="text-[14px] font-medium leading-snug"
                  style={{ color: 'var(--cn-ink-500)' }}
                >
                  {label}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--cn-ink-500)' }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
