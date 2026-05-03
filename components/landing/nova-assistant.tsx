import Link from 'next/link'

const MESSAGES = [
  {
    role: 'user' as const,
    text: '¿Tenéis alguna Fiat Ducato del 2019 con techo elevable y baño?',
  },
  {
    role: 'assistant' as const,
    text: 'Déjame mirar. ¿Cuántas plazas necesitáis y para qué tipo de viajes la pensáis usar?',
  },
  {
    role: 'user' as const,
    text: 'Para 4, escapadas de fin de semana y alguna semana en verano.',
  },
  {
    role: 'assistant' as const,
    text: 'Tengo 2 que encajan muy bien. Una con baño completo a 38.500 €, otra más compacta a 29.000 €. ¿Te mando los detalles?',
  },
]

export function NovaAssistant() {
  return (
    <section className="px-8 pb-20 pt-4 max-[640px]:px-5">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p
              className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--cn-terra-500)' }}
            >
              · Para compradores
            </p>
            <h2
              className="mb-5 text-[2rem] font-bold leading-tight tracking-[-0.02em] lg:text-[2.4rem]"
              style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
            >
              Cuéntanos qué buscas. Nosotros encontramos la camper.
            </h2>
            <p
              className="mb-8 max-w-[46ch] text-[15px] leading-relaxed"
              style={{ color: 'var(--cn-ink-500)' }}
            >
              Sin filtros eternos ni fichas técnicas. Solo una conversación donde nos cuentas qué
              quieres vivir, y te proponemos vehículos que encajan de verdad.
            </p>
            <Link
              href="/comprar"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--cn-teal-900)' }}
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
          </div>

          <div
            className="rounded-[20px] p-5"
            style={{ background: 'var(--cn-cream-50)', border: '1px solid var(--cn-line)' }}
          >
            <div
              className="mb-4 flex items-center gap-3 rounded-[12px] px-4 py-3"
              style={{ background: 'var(--cn-teal-900)' }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-white"
                style={{ background: 'var(--cn-terra-500)', fontSize: '12px' }}
              >
                CN
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">Asistente CampersNova</p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Responde al instante
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {MESSAGES.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[82%] rounded-[12px] px-4 py-2.5 text-[13px] leading-relaxed"
                    style={
                      msg.role === 'user'
                        ? { background: 'var(--cn-terra-500)', color: 'white' }
                        : {
                            background: 'white',
                            color: 'var(--cn-teal-900)',
                            border: '1px solid var(--cn-line)',
                          }
                    }
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
