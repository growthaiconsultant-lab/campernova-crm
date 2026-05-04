import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'

export const metadata: Metadata = {
  title: 'Cómo funciona · CampersNova',
  description:
    'Descubre cómo trabajamos en CampersNova: proceso claro para comprar o vender tu camper o autocaravana sin sorpresas.',
}

const COMPRA_STEPS = [
  {
    n: '01',
    l: 'Empieza la conversación',
    d: 'Cuéntanos qué buscas con tus palabras. El asistente te orienta sin filtros confusos.',
  },
  {
    n: '02',
    l: 'Te llama el equipo',
    d: 'Esteban te contacta con 2-3 vehículos reales que encajan contigo.',
  },
  {
    n: '03',
    l: 'Visita y prueba',
    d: 'Te enseñamos los vehículos en nuestras instalaciones. Prueba dinámica incluida.',
  },
  {
    n: '04',
    l: 'Cierre con seguridad',
    d: 'Tramitamos transferencia, contrato y entrega.',
  },
]

const VENTA_STEPS = [
  {
    n: '01',
    l: 'Cuéntanos tu vehículo',
    d: 'Formulario rápido con datos y fotos.',
  },
  {
    n: '02',
    l: 'Valoración honesta',
    d: 'Estudio de mercado y precio realista en 24h.',
  },
  {
    n: '03',
    l: 'Depósito en nuestras instalaciones',
    d: 'Nos dejas tu camper o autocaravana. Reportaje profesional y exposición a compradores serios.',
  },
  {
    n: '04',
    l: 'Cierre y pago seguro',
    d: 'Filtramos, negociamos y firmamos por ti.',
  },
]

export default function ComoFuncionaPage() {
  return (
    <>
      <PublicNav />

      <main className="min-h-screen pt-20" style={{ background: 'var(--cn-cream-100)' }}>
        {/* Hero */}
        <section className="px-8 pb-10 pt-16 max-[640px]:px-5">
          <div className="mx-auto max-w-[1280px]">
            <p
              className="mb-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--cn-terra-500)' }}
            >
              · Cómo funciona
            </p>
            <h1
              className="text-[2.2rem] font-bold leading-[1.1] tracking-[-0.025em] lg:text-[3rem]"
              style={{
                fontFamily: 'var(--font-fraunces)',
                color: 'var(--cn-teal-900)',
                maxWidth: '22ch',
              }}
            >
              Un proceso claro de principio a fin.
            </h1>
            <p
              className="mt-7 text-[17px] leading-relaxed"
              style={{ color: 'var(--cn-ink-500)', maxWidth: '56ch' }}
            >
              Sin sorpresas, sin presión, sin gestiones por tu cuenta. Te enseñamos cómo trabajamos
              en cada lado de la operación.
            </p>
          </div>
        </section>

        {/* Two-column steps */}
        <section className="px-8 py-20 max-[640px]:px-5">
          <div className="mx-auto max-w-[1280px]">
            <div className="grid gap-16 md:grid-cols-2">
              {/* Comprar */}
              <div>
                <h3
                  className="mb-10 text-[2rem] tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-700)' }}
                >
                  Si quieres comprar
                </h3>
                <div className="flex flex-col gap-4">
                  {COMPRA_STEPS.map((s) => (
                    <div
                      key={s.n}
                      className="flex items-start gap-6 rounded-[20px] p-6"
                      style={{ background: '#fff', border: '1px solid var(--cn-line)' }}
                    >
                      <span
                        className="flex-shrink-0 text-[2.8rem] leading-none tracking-[-0.03em]"
                        style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-700)' }}
                      >
                        {s.n}
                      </span>
                      <div className="pt-1">
                        <h4
                          className="text-[17px] font-semibold leading-snug tracking-[-0.01em]"
                          style={{ color: 'var(--cn-teal-900)' }}
                        >
                          {s.l}
                        </h4>
                        <p
                          className="mt-2 text-[14px] leading-relaxed"
                          style={{ color: 'var(--cn-ink-500)' }}
                        >
                          {s.d}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-12">
                  <Link
                    href="/comprar"
                    className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white transition hover:opacity-90"
                    style={{ background: 'var(--cn-teal-900)' }}
                  >
                    Empezar conversación
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              {/* Vender */}
              <div>
                <h3
                  className="mb-10 text-[2rem] tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-terra-500)' }}
                >
                  Si quieres vender
                </h3>
                <div className="flex flex-col gap-4">
                  {VENTA_STEPS.map((s) => (
                    <div
                      key={s.n}
                      className="flex items-start gap-6 rounded-[20px] p-6"
                      style={{ background: '#fff', border: '1px solid var(--cn-line)' }}
                    >
                      <span
                        className="flex-shrink-0 text-[2.8rem] leading-none tracking-[-0.03em]"
                        style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-terra-500)' }}
                      >
                        {s.n}
                      </span>
                      <div className="pt-1">
                        <h4
                          className="text-[17px] font-semibold leading-snug tracking-[-0.01em]"
                          style={{ color: 'var(--cn-teal-900)' }}
                        >
                          {s.l}
                        </h4>
                        <p
                          className="mt-2 text-[14px] leading-relaxed"
                          style={{ color: 'var(--cn-ink-500)' }}
                        >
                          {s.d}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-12">
                  <Link
                    href="/vender"
                    className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-[14px] font-semibold transition hover:bg-cn-cream-50"
                    style={{ borderColor: 'var(--cn-terra-500)', color: 'var(--cn-terra-500)' }}
                  >
                    Empezar valoración
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA band */}
        <section
          className="px-8 py-16 max-[640px]:px-5"
          style={{ background: 'var(--cn-cream-50)', borderTop: '1px solid var(--cn-line)' }}
        >
          <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-6 text-center">
            <p
              className="font-mono text-[11px] uppercase tracking-[0.18em]"
              style={{ color: 'var(--cn-terra-500)' }}
            >
              · Próximo paso
            </p>
            <h2
              className="text-[clamp(1.6rem,3vw,2.4rem)] leading-[1.1] tracking-[-0.02em]"
              style={{
                fontFamily: 'var(--font-fraunces)',
                color: 'var(--cn-teal-900)',
                maxWidth: '26ch',
              }}
            >
              ¿Estás pensando en comprar o vender?
            </h2>
            <p className="text-[16px]" style={{ color: 'var(--cn-ink-500)', maxWidth: '48ch' }}>
              Cuéntanos qué necesitas y te ayudamos a dar el siguiente paso con seguridad.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/comprar"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white transition hover:opacity-90"
                style={{ background: 'var(--cn-teal-900)' }}
              >
                Quiero comprar
              </Link>
              <Link
                href="/vender"
                className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-[14px] font-semibold transition hover:bg-cn-cream-100"
                style={{ borderColor: 'var(--cn-line)', color: 'var(--cn-teal-900)' }}
              >
                Quiero vender
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  )
}
