'use client'

import { useState } from 'react'

const STEPS = {
  comprar: [
    {
      num: '01',
      title: 'Cuéntanos',
      desc: 'Empieza la conversación describiendo qué buscas. Sin filtros ni formularios eternos.',
    },
    {
      num: '02',
      title: 'Te orientamos',
      desc: 'El asistente afina contigo y te conecta con Esteban del equipo cuando esté claro.',
    },
    {
      num: '03',
      title: 'Propuestas',
      desc: 'Recibes 2-3 vehículos reales que encajan, por WhatsApp o llamada.',
    },
    {
      num: '04',
      title: 'Visita y cierre',
      desc: 'Visita en nuestras instalaciones, prueba dinámica y trámites cubiertos.',
    },
  ],
  vender: [
    {
      num: '01',
      title: 'Cuéntanos',
      desc: 'Envíanos los datos y fotos de tu vehículo en 5 minutos.',
    },
    {
      num: '02',
      title: 'Valoración',
      desc: 'Estudiamos tu camper o autocaravana y te damos un precio realista de mercado.',
    },
    {
      num: '03',
      title: 'Depósito en instalaciones',
      desc: 'Nos dejas tu vehículo en nuestras instalaciones. Lo preparamos, fotografiamos y mostramos a compradores serios por ti.',
    },
    {
      num: '04',
      title: 'Cierre',
      desc: 'Acompañamos hasta la firma con todos los trámites cubiertos.',
    },
  ],
}

type Tab = 'comprar' | 'vender'

export function HowItWorksSection() {
  const [active, setActive] = useState<Tab>('comprar')
  const steps = STEPS[active]

  return (
    <section className="px-8 py-20 max-[640px]:px-5" style={{ background: 'var(--cn-cream-50)' }}>
      <div className="mx-auto max-w-[1280px]">
        {/* Header */}
        <div className="mb-12 text-center">
          <p
            className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'var(--cn-terra-500)' }}
          >
            · Cómo funciona
          </p>
          <h2
            className="mx-auto mb-10 max-w-[18ch] text-[2.2rem] font-bold leading-tight tracking-[-0.025em] lg:text-[3rem]"
            style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
          >
            Un proceso pensado para los dos lados de la operación.
          </h2>

          {/* Tab toggle */}
          <div
            className="inline-flex rounded-full p-1"
            style={{ background: 'rgba(38,77,73,0.08)' }}
            role="tablist"
            aria-label="Selecciona proceso"
          >
            {(['comprar', 'vender'] as Tab[]).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={active === tab}
                onClick={() => setActive(tab)}
                className="rounded-full px-7 py-2.5 text-[14px] font-medium transition-all"
                style={
                  active === tab
                    ? {
                        background: 'var(--cn-teal-900)',
                        color: 'white',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                      }
                    : { color: 'var(--cn-ink-500)' }
                }
              >
                {tab === 'comprar' ? 'Para comprar' : 'Para vender'}
              </button>
            ))}
          </div>
        </div>

        {/* Step cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ num, title, desc }) => (
            <div
              key={num}
              className="rounded-[20px] p-7"
              style={{
                background: 'white',
                border: '1px solid rgba(38,77,73,0.09)',
              }}
            >
              <span
                className="mb-3 block text-[3rem] font-bold leading-none"
                style={{ color: 'var(--cn-terra-500)', fontFamily: 'var(--font-fraunces)' }}
              >
                {num}
              </span>
              <h3
                className="mb-2 text-[15px] font-semibold leading-snug"
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
