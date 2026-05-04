import type { Metadata } from 'next'
import Image from 'next/image'
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
        {/* Instalaciones y equipo — 2 columnas texto */}
        <section className="px-8 py-16 max-[640px]:px-5">
          <div className="mx-auto max-w-[1280px]">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
              <div>
                <p
                  className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: 'var(--cn-terra-500)' }}
                >
                  · Instalaciones y equipo
                </p>
                <h2
                  className="text-[2.2rem] font-bold leading-[1.1] tracking-[-0.025em] lg:text-[2.8rem]"
                  style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
                >
                  No somos un portal. Somos una empresa con instalaciones propias.
                </h2>
              </div>
              <p
                className="max-w-[52ch] text-[16px] leading-relaxed lg:pb-1"
                style={{ color: 'var(--cn-ink-500)' }}
              >
                Tenemos espacio en Barcelona para custodia, limpieza y fotografía profesional. Cada
                vehículo pasa por nuestras manos, no solo por una pantalla.
              </p>
            </div>
          </div>
        </section>

        {/* Mission + benefits */}
        <section className="px-8 py-20 max-[640px]:px-5">
          <div className="mx-auto max-w-[1280px]">
            <div className="grid items-center gap-16 md:grid-cols-2">
              {/* Foto instalaciones */}
              <div className="mx-auto w-full max-w-[420px]">
                <div
                  className="relative aspect-[4/3] overflow-hidden rounded-[20px]"
                  style={{ border: '1px solid var(--cn-line)' }}
                >
                  <Image
                    src="/images/landing/instalaciones.jpg"
                    alt="Instalaciones CampersNova en Barcelona"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 40vw"
                  />
                </div>
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
                        href="tel:+34645639185"
                        className="hover:underline"
                        style={{ color: 'var(--cn-teal-700)' }}
                      >
                        645 63 91 85
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

              {/* Mapa Google Maps */}
              <div
                className="relative aspect-[4/3] overflow-hidden rounded-cn-xl"
                style={{ border: '1px solid var(--cn-line)' }}
              >
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2993!2d2.2429082!3d41.5648851!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x12a4ebf0fa3704c3%3A0x5219e56327ff3bb7!2sCampers%20Nova%2C%20SL!5e0!3m2!1ses!2ses!4v1747000000000!5m2!1ses!2ses"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full border-0"
                  allowFullScreen
                  title="CampersNova · Carrer Torre de Cellers, 08150 Barcelona"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  )
}
