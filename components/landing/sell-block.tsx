import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

const FEATURES = [
  'Valoración profesional realista',
  'Tu vehículo expuesto en nuestras instalaciones',
  'Publicación optimizada y reportaje profesional',
  'Filtrado y gestión de compradores serios',
  'Acompañamiento hasta la firma',
  'Pagos y trámites protegidos',
]

export function SellBlock() {
  return (
    <div className="px-8 max-[640px]:px-5">
      <div className="mx-auto max-w-[1280px]">
        {/* ── Bloque 1: crema, 2 columnas ── */}
        <section className="py-20">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            {/* Imagen + tarjeta de stats */}
            <div className="relative">
              <div className="relative h-[520px] overflow-hidden rounded-[20px] max-[640px]:h-[340px]">
                <Image
                  src="/images/landing/hero-vw-bus.jpg"
                  alt="Autocaravana VW lista para la venta"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              {/* Stats card */}
              <div
                className="absolute bottom-4 left-4 right-4 flex items-center justify-around rounded-[16px] px-6 py-5"
                style={{
                  background: 'rgba(255,255,255,0.93)',
                  boxShadow: '0 4px 28px rgba(0,0,0,0.13)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div>
                  <p
                    className="text-[1.9rem] font-bold leading-none"
                    style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
                  >
                    42 días
                  </p>
                  <p
                    className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.13em]"
                    style={{ color: 'var(--cn-ink-500)' }}
                  >
                    Tiempo medio de venta
                  </p>
                </div>
                <div className="h-10 w-px" style={{ background: 'var(--cn-line)' }} />
                <div>
                  <p
                    className="text-[1.9rem] font-bold leading-none"
                    style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
                  >
                    98%
                  </p>
                  <p
                    className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.13em]"
                    style={{ color: 'var(--cn-ink-500)' }}
                  >
                    Operaciones cerradas
                  </p>
                </div>
              </div>
            </div>

            {/* Copy */}
            <div>
              <p
                className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--cn-terra-500)' }}
              >
                · Para vendedores
              </p>
              <h2
                className="mb-5 text-[2.4rem] font-bold leading-[1.1] tracking-[-0.025em] max-[640px]:text-[1.9rem]"
                style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
              >
                Vende tu camper o autocaravana con garantías, sin perder tiempo.
              </h2>
              <p
                className="mb-8 max-w-[52ch] text-[15px] leading-relaxed"
                style={{ color: 'var(--cn-ink-500)' }}
              >
                Te acompañamos en todo el proceso: valoración, publicación, gestión de interesados,
                negociación y cierre. Tú ganas tranquilidad; nosotros nos encargamos del proceso.
              </p>

              <ul className="mb-10 flex flex-col gap-3.5">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-[14px] font-medium">
                    <CheckCircle2
                      className="h-5 w-5 shrink-0"
                      style={{ color: 'var(--cn-teal-900)' }}
                      aria-hidden="true"
                    />
                    <span style={{ color: 'var(--cn-teal-900)' }}>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-5">
                <Link
                  href="/vender"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--cn-teal-900)' }}
                >
                  Quiero vender mi vehículo
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
                <Link
                  href="/como-funciona"
                  className="text-[14px] font-medium underline-offset-4 transition-opacity hover:opacity-70"
                  style={{ color: 'var(--cn-teal-900)' }}
                >
                  Ver el proceso paso a paso
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
