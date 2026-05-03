const PILLARS = [
  {
    num: '01',
    title: 'Especialistas en camper y autocaravana',
    desc: 'Llevamos años viviendo y revendiendo el sector. Conocemos cada modelo, marca y particularidad.',
  },
  {
    num: '02',
    title: 'Trato cercano',
    desc: 'Te atiende una persona, no un call center. Sin guiones, sin prisa.',
  },
  {
    num: '03',
    title: 'Selección cuidada',
    desc: 'No publicamos cualquier vehículo. Filtramos por estado, historial y honestidad del propietario.',
  },
  {
    num: '04',
    title: 'Transparencia total',
    desc: 'Documentación, kilometraje real y estado mecánico declarado por escrito.',
  },
  {
    num: '05',
    title: 'Acompañamiento real',
    desc: 'Antes, durante y después. También cuando ya estás en la carretera.',
  },
  {
    num: '06',
    title: 'Seguridad jurídica',
    desc: 'Contratos revisados, transferencias gestionadas y pagos protegidos.',
  },
]

export function WhyUsPillars() {
  return (
    <section className="px-8 py-20 max-[640px]:px-5" style={{ background: 'var(--cn-cream-50)' }}>
      <div className="mx-auto max-w-[1280px]">
        {/* Header — 2 columns */}
        <div className="mb-14 grid gap-8 lg:grid-cols-2 lg:items-end">
          <div>
            <p
              className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--cn-terra-500)' }}
            >
              · Por qué Campers Nova
            </p>
            <h2
              className="text-[2rem] font-bold leading-tight tracking-[-0.02em] lg:text-[2.5rem]"
              style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
            >
              No somos solo un escaparate de vehículos.
            </h2>
          </div>
          <p
            className="max-w-[52ch] text-[15px] leading-relaxed lg:pb-1"
            style={{ color: 'var(--cn-ink-500)' }}
          >
            Somos un punto de encuentro entre personas que quieren viajar mejor y propietarios que
            quieren vender con tranquilidad. Esa es la diferencia que se nota desde la primera
            llamada.
          </p>
        </div>

        {/* 6-pillar grid */}
        <div
          className="grid gap-px overflow-hidden rounded-[20px] md:grid-cols-3"
          style={{ border: '1px solid var(--cn-line)' }}
        >
          {PILLARS.map(({ num, title, desc }) => (
            <div
              key={num}
              className="p-8"
              style={{
                background: 'var(--cn-cream-50)',
                borderRight: '1px solid var(--cn-line)',
                borderBottom: '1px solid var(--cn-line)',
              }}
            >
              <span
                className="mb-4 block font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--cn-terra-500)' }}
              >
                {num}
              </span>
              <h3
                className="mb-2.5 text-[15px] font-semibold leading-snug"
                style={{ color: 'var(--cn-teal-900)' }}
              >
                {title}
              </h3>
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
