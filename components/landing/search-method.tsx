import Link from 'next/link'

const STEPS = [
  {
    num: '01',
    title: 'Cuéntanos qué buscas',
    desc: 'Completa tu ficha con el presupuesto, las plazas y las características que necesitas. Si tienes dudas, puedes dejar preguntas en blanco.',
  },
  {
    num: '02',
    title: 'Revisamos tus preferencias',
    desc: 'El equipo revisa qué es imprescindible para ti y qué opciones podrías valorar. Así preparamos una conversación útil.',
  },
  {
    num: '03',
    title: 'Tu asesor te llama',
    desc: 'Un asesor de CampersNova contactará contigo para comentar tu búsqueda y acordar los siguientes pasos.',
  },
]

export function SearchMethod() {
  return (
    <section id="search-method" className="px-8 pb-20 pt-4 max-[640px]:px-5">
      <div className="mx-auto max-w-[1280px]">
        {/* Section header — 2 columns */}
        <div className="mb-14 grid gap-8 lg:grid-cols-2 lg:items-end">
          <div>
            <p
              className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--cn-terra-500)' }}
            >
              · Búsqueda guiada
            </p>
            <h2
              className="text-[2rem] font-bold leading-tight tracking-[-0.02em] lg:text-[2.4rem]"
              style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
            >
              La camper que buscas empieza por lo que necesitas.
            </h2>
          </div>
          <div>
            <p className="mb-5 text-[15px] leading-relaxed" style={{ color: 'var(--cn-ink-500)' }}>
              Cuéntanos cómo quieres tu camper o autocaravana. Recogemos tus preferencias y te
              llamamos para ayudarte a definir tu búsqueda.
            </p>
            <Link
              href="/busqueda-bajo-pedido"
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--cn-terra-500)' }}
            >
              Completar mi ficha de búsqueda
              <svg
                width="14"
                height="14"
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

        {/* 3-step grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ num, title, desc }) => (
            <div
              key={num}
              className="rounded-[16px] border p-7"
              style={{ borderColor: 'var(--cn-line)', background: 'var(--cn-cream-50)' }}
            >
              <span
                className="mb-4 block font-mono text-[2rem] font-bold leading-none"
                style={{ color: 'rgba(88,71,56,0.12)' }}
              >
                {num}
              </span>
              <h4
                className="mb-2.5 text-[15px] font-semibold leading-snug"
                style={{ color: 'var(--cn-teal-900)' }}
              >
                {title}
              </h4>
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
