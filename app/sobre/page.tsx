import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'

export const metadata: Metadata = {
  title: 'Sobre nosotros · CampersNova',
  description:
    'Conoce CampersNova: nacimos en 2019 especializándonos en compraventa de campers y autocaravanas desde Barcelona. +240 operaciones cerradas.',
}

const MAPS_URL =
  'https://www.google.com/maps/dir//CAMPERS+NOVA,+SL,+Carrer+Torre+de+Cellers,+08150,+Barcelona/@41.4089216,2.1528576,10z/data=!4m8!4m7!1m0!1m5!1m1!1s0x12a4ebf0fa3704c3:0x5219e56327ff3bb7!2m2!1d2.2429082!2d41.5648851'

const BENEFITS = [
  '+240 operaciones cerradas desde 2019',
  '4,6 ★ con 36 reseñas verificadas en Google',
  'Equipo propio de mecánicos colaboradores',
  'Instalaciones propias en Barcelona, custodia incluida',
  'Asesoría legal y fiscal especializada en campers y autocaravanas',
]

export default function SobrePage() {
  return (
    <>
      <PublicNav />

      <main className="min-h-screen pt-20" style={{ background: 'var(--cn-cream-100)' }}>
        {/* Hero */}
        <section
          className="px-8 pb-16 pt-16 max-[640px]:px-5"
          style={{ background: 'var(--cn-teal-900)' }}
        >
          <div className="mx-auto max-w-[1280px]">
            <p
              className="font-mono text-[11px] uppercase tracking-[0.18em]"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              · Sobre nosotros
            </p>
            <h1
              className="mt-4 text-[clamp(2.2rem,5vw,3.5rem)] leading-[1.05] tracking-[-0.02em] text-white"
              style={{ fontFamily: 'var(--font-fraunces)', maxWidth: '22ch' }}
            >
              Nacimos viajando. Trabajamos para que viajes mejor.
            </h1>
            <p
              className="mt-5 text-[18px] leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.72)', maxWidth: '60ch' }}
            >
              Campers Nova nació en 2019 de la unión entre apasionados del mundo camper y
              autocaravana y profesionales de la compraventa. Trabajamos desde nuestras
              instalaciones en Barcelona (Carrer Torre de Cellers, 08150), con cobertura para
              clientes de toda España.
            </p>
          </div>
        </section>

        {/* Mission + benefits */}
        <section className="px-8 py-20 max-[640px]:px-5">
          <div className="mx-auto max-w-[1280px]">
            <div className="grid items-center gap-16 md:grid-cols-2">
              {/* Image placeholder */}
              <div
                className="flex aspect-[4/5] items-center justify-center rounded-cn-xl"
                style={{ background: 'var(--cn-cream-200)', border: '1px solid var(--cn-line)' }}
              >
                <span
                  className="font-mono text-xs tracking-widest"
                  style={{ color: 'var(--cn-ink-300)' }}
                >
                  instalaciones.jpg
                </span>
              </div>

              {/* Copy */}
              <div>
                <h2
                  className="text-[clamp(1.8rem,3vw,2.4rem)] leading-[1.1] tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
                >
                  Lo que nos mueve
                </h2>
                <p
                  className="mt-5 text-[18px] leading-relaxed"
                  style={{ color: 'var(--cn-ink-700)', maxWidth: '52ch' }}
                >
                  Creemos que comprar o vender una camper o autocaravana es mucho más que cerrar una
                  operación. Es abrir o cerrar una etapa de viaje. Por eso ponemos cuidado en los
                  pequeños detalles y honestidad en los grandes.
                </p>
                <ul className="mt-7 flex flex-col gap-3" style={{ listStyle: 'none', padding: 0 }}>
                  {BENEFITS.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-3 text-[15px]"
                      style={{ color: 'var(--cn-ink-700)' }}
                    >
                      <span
                        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ background: 'var(--cn-teal-900)' }}
                      >
                        <Check size={11} className="text-white" />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Visit block */}
        <section
          className="px-8 py-20 max-[640px]:px-5"
          style={{ background: 'var(--cn-cream-50)', borderTop: '1px solid var(--cn-line)' }}
        >
          <div className="mx-auto max-w-[1280px]">
            <div className="grid items-center gap-16 md:grid-cols-2">
              <div>
                <p
                  className="font-mono text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: 'var(--cn-terra-500)' }}
                >
                  · Visítanos
                </p>
                <h2
                  className="mt-4 text-[clamp(1.8rem,3vw,2.6rem)] leading-[1.1] tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
                >
                  Pásate por la nave. Te enseñamos el stock.
                </h2>
                <p
                  className="mt-5 text-[17px] leading-relaxed"
                  style={{ color: 'var(--cn-ink-700)', maxWidth: '52ch' }}
                >
                  Nuestras instalaciones de Barcelona están abiertas para que puedas ver, tocar y
                  probar cualquier vehículo del catálogo. Sin presión, con un café delante.
                </p>

                <div className="mt-8 grid grid-cols-3 gap-6 max-[640px]:grid-cols-1">
                  <div>
                    <h5
                      className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.06em]"
                      style={{ color: 'var(--cn-teal-900)' }}
                    >
                      Dirección
                    </h5>
                    <p
                      className="text-[14px] leading-relaxed"
                      style={{ color: 'var(--cn-ink-500)' }}
                    >
                      Carrer Torre de Cellers
                      <br />
                      08150 Barcelona
                    </p>
                  </div>
                  <div>
                    <h5
                      className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.06em]"
                      style={{ color: 'var(--cn-teal-900)' }}
                    >
                      Horario
                    </h5>
                    <p
                      className="text-[14px] leading-relaxed"
                      style={{ color: 'var(--cn-ink-500)' }}
                    >
                      Lun – Vie · 10:00 – 19:00
                      <br />
                      Sábado · 10:00 – 13:00
                      <br />
                      Domingo · cerrado
                    </p>
                  </div>
                  <div>
                    <h5
                      className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.06em]"
                      style={{ color: 'var(--cn-teal-900)' }}
                    >
                      Contacto
                    </h5>
                    <p
                      className="text-[14px] leading-relaxed"
                      style={{ color: 'var(--cn-ink-500)' }}
                    >
                      <a
                        href="tel:+34629925821"
                        className="hover:underline"
                        style={{ color: 'var(--cn-teal-700)' }}
                      >
                        629 92 58 21
                      </a>
                      <br />
                      <a
                        href="mailto:info@campersnova.com"
                        className="hover:underline"
                        style={{ color: 'var(--cn-teal-700)' }}
                      >
                        info@campersnova.com
                      </a>
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href={MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white transition hover:opacity-90"
                    style={{ background: 'var(--cn-teal-900)' }}
                  >
                    Cómo llegar
                    <ArrowRight size={16} />
                  </a>
                  <Link
                    href="/contacto"
                    className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-[14px] font-semibold transition hover:bg-cn-cream-100"
                    style={{ borderColor: 'var(--cn-line)', color: 'var(--cn-teal-900)' }}
                  >
                    Contactar
                  </Link>
                </div>
              </div>

              {/* Map / image placeholder */}
              <div
                className="flex aspect-[4/3] items-center justify-center rounded-cn-xl"
                style={{ background: 'var(--cn-cream-200)', border: '1px solid var(--cn-line)' }}
              >
                <span
                  className="font-mono text-xs tracking-widest"
                  style={{ color: 'var(--cn-ink-300)' }}
                >
                  Mapa · Barcelona
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  )
}
