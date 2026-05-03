import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'
import { WhatsAppFab } from '@/components/whatsapp-fab'

export const metadata: Metadata = {
  title: 'Vender tu camper o autocaravana · CampersNova',
  description:
    'Vende tu camper o autocaravana con valoración profesional, sin curiosos y con pagos protegidos. Tiempo medio de venta: 42 días.',
}

// ─── SVG helpers ─────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="5 12 10 17 19 8" />
    </svg>
  )
}

function YesIcon() {
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full"
      style={{ background: 'rgba(38,77,73,0.10)', color: 'var(--cn-teal-700)' }}
      aria-label="sí"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="5 12 10 17 19 8" />
      </svg>
    </span>
  )
}

function NoIcon() {
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full"
      style={{ background: 'rgba(194,106,74,0.10)', color: 'var(--cn-terra-500)' }}
      aria-label="no"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </svg>
    </span>
  )
}

function PartialIcon() {
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full"
      style={{ background: 'rgba(184,156,110,0.15)', color: 'var(--cn-sand-500)' }}
      aria-label="parcial"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <line x1="6" y1="12" x2="18" y2="12" />
      </svg>
    </span>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const BENEFITS = [
  'Valoración profesional realista',
  'Tu vehículo en nuestras instalaciones, listo para visitas',
  'Sin curiosos, sin pérdidas de tiempo en tu casa',
  'Pagos y trámites protegidos',
  'Tiempo medio de venta: ~42 días',
]

type CellValue = string | React.ReactNode

const COMPARE_ROWS: [string, CellValue, CellValue, CellValue][] = [
  [
    'Tiempo medio de venta',
    <span key="t1" className="font-semibold" style={{ color: 'var(--cn-teal-700)' }}>
      ~42 días
    </span>,
    <span key="t2" className="text-sm" style={{ color: 'var(--cn-ink-500)' }}>
      3–6 meses
    </span>,
    <span key="t3" className="text-sm" style={{ color: 'var(--cn-ink-500)' }}>
      1–3 meses
    </span>,
  ],
  [
    'Custodia del vehículo',
    <span key="c1" className="text-sm font-medium" style={{ color: 'var(--cn-ink-700)' }}>
      En nuestras instalaciones
    </span>,
    <span key="c2" className="text-sm" style={{ color: 'var(--cn-ink-500)' }}>
      En tu casa / garaje
    </span>,
    <span key="c3" className="text-sm" style={{ color: 'var(--cn-ink-500)' }}>
      En el concesionario
    </span>,
  ],
  ['Tasación profesional', <YesIcon key="y1" />, <NoIcon key="n1" />, <PartialIcon key="p1" />],
  ['Filtro de compradores', <YesIcon key="y2" />, <NoIcon key="n2" />, <YesIcon key="y3" />],
  ['Fotos profesionales', <YesIcon key="y4" />, <NoIcon key="n3" />, <YesIcon key="y5" />],
  [
    'Gestión papeleo (ITP, titularidad)',
    <YesIcon key="y6" />,
    <NoIcon key="n4" />,
    <YesIcon key="y7" />,
  ],
  [
    'Precio obtenido',
    <span key="p2" className="text-sm font-medium" style={{ color: 'var(--cn-teal-700)' }}>
      Precio de mercado
    </span>,
    <span key="p3" className="text-sm" style={{ color: 'var(--cn-ink-500)' }}>
      Lo que negocies
    </span>,
    <span key="p4" className="text-sm" style={{ color: 'var(--cn-terra-500)' }}>
      15–25% menos
    </span>,
  ],
  [
    'Coste por adelantado',
    <span key="co1" className="font-semibold" style={{ color: 'var(--cn-teal-700)' }}>
      0 €
    </span>,
    <span key="co2" className="text-sm" style={{ color: 'var(--cn-ink-500)' }}>
      Anuncios / tiempo
    </span>,
    <span key="co3" className="text-sm" style={{ color: 'var(--cn-ink-500)' }}>
      0 €
    </span>,
  ],
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VenderPage() {
  return (
    <>
      <PublicNav />

      <main id="main-content">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden px-8 pb-20 pt-16 max-[640px]:px-5 lg:pt-24"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 80% 0%, rgba(217,201,168,0.45), transparent 60%), var(--cn-cream-100)',
          }}
        >
          <div className="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-[1fr_420px] lg:gap-16">
            {/* Text */}
            <div className="order-2 lg:order-1">
              <p
                className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--cn-terra-500)' }}
              >
                · Vender con nosotros
              </p>

              <h1
                className="mb-5 text-[2.4rem] font-bold leading-[1.12] tracking-[-0.02em] max-[640px]:text-[1.9rem] lg:text-[3rem]"
                style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
              >
                Vende tu camper o autocaravana con garantías, sin complicaciones.
              </h1>

              <p
                className="mb-8 max-w-[52ch] text-[1.05rem] leading-relaxed"
                style={{ color: 'var(--cn-ink-500)' }}
              >
                Valoramos tu vehículo, preparamos su presentación, gestionamos interesados y te
                acompañamos hasta el cierre de la operación.
              </p>

              <ul className="mb-10 flex flex-col gap-3">
                {BENEFITS.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ background: 'rgba(38,77,73,0.10)', color: 'var(--cn-teal-700)' }}
                    >
                      <CheckIcon />
                    </span>
                    <span
                      className="text-[15px] leading-snug"
                      style={{ color: 'var(--cn-ink-700)' }}
                    >
                      {b}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href="/vender/empezar"
                className="inline-flex items-center justify-center rounded-full px-7 py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--cn-terra-500)' }}
              >
                Calcular el precio de mi vehículo
              </Link>
            </div>

            {/* Image */}
            <div className="order-1 lg:order-2">
              <div
                className="relative mx-auto w-full max-w-[380px] overflow-hidden lg:max-w-none"
                style={{ aspectRatio: '4/5', borderRadius: '28px' }}
              >
                <Image
                  src="/images/landing/sell-driver.jpg"
                  alt="Propietario junto a su camper preparada para la venta"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 380px, 420px"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Compare section ───────────────────────────────────────────────── */}
        <section className="px-8 py-20 max-[640px]:px-5">
          <div className="mx-auto max-w-[1080px]">
            <div className="mb-12 flex flex-col items-center gap-3.5 text-center">
              <p
                className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--cn-terra-500)' }}
              >
                · Por qué Campers Nova
              </p>
              <h2
                className="max-w-[18ch] text-[2rem] font-bold leading-tight tracking-[-0.02em] lg:text-[2.4rem]"
                style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
              >
                Compara antes de decidir
              </h2>
              <p
                className="max-w-[52ch] text-base leading-relaxed"
                style={{ color: 'var(--cn-ink-500)' }}
              >
                Esto es lo que obtienes con nosotros frente a vender por tu cuenta.
              </p>
            </div>

            {/* Table — horizontal scroll on mobile */}
            <div
              className="overflow-x-auto rounded-[20px] border"
              style={{ borderColor: 'var(--cn-line)' }}
            >
              <table className="w-full min-w-[600px] border-collapse text-[14px]">
                <thead>
                  <tr
                    className="border-b"
                    style={{ borderColor: 'var(--cn-line)', background: 'var(--cn-cream-50)' }}
                  >
                    <th
                      className="py-4 pl-6 pr-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em]"
                      style={{ color: 'var(--cn-ink-500)', width: '38%' }}
                    >
                      Criterio
                    </th>
                    <th
                      className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-[0.08em]"
                      style={{
                        color: 'var(--cn-teal-900)',
                        background: 'rgba(38,77,73,0.04)',
                        width: '21%',
                      }}
                    >
                      Campers Nova
                    </th>
                    <th
                      className="px-4 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: 'var(--cn-ink-500)', width: '21%' }}
                    >
                      Wallapop / portales
                    </th>
                    <th
                      className="py-4 pl-4 pr-6 text-center text-[11px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: 'var(--cn-ink-500)', width: '20%' }}
                    >
                      Concesionario
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map(([label, nova, portales, conc], i) => (
                    <tr
                      key={i}
                      className="border-b last:border-0"
                      style={{
                        borderColor: 'var(--cn-line)',
                        background: i % 2 === 0 ? 'var(--cn-cream-50)' : 'white',
                      }}
                    >
                      <td
                        className="py-4 pl-6 pr-4 text-[13px] font-medium"
                        style={{ color: 'var(--cn-ink-700)' }}
                      >
                        {label}
                      </td>
                      <td
                        className="px-4 py-4 text-center"
                        style={{ background: 'rgba(38,77,73,0.04)' }}
                      >
                        {nova}
                      </td>
                      <td className="px-4 py-4 text-center">{portales}</td>
                      <td className="py-4 pl-4 pr-6 text-center">{conc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p
              className="mt-6 text-center text-[13px] italic leading-relaxed"
              style={{ color: 'var(--cn-ink-500)' }}
            >
              Por eso solo cobramos si vendemos. Sin venta, sin comisión. Sin riesgo para ti.
            </p>
          </div>
        </section>

        {/* ── Price band CTA ────────────────────────────────────────────────── */}
        <section className="px-8 pb-24 pt-4 max-[640px]:px-5">
          <div className="mx-auto max-w-[1080px]">
            <div
              className="flex flex-col items-center gap-6 px-8 py-14 text-center max-[640px]:px-5"
              style={{ background: 'var(--cn-teal-900)', borderRadius: '28px' }}
            >
              <h2
                className="max-w-[24ch] text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-white lg:text-[2.25rem]"
                style={{ fontFamily: 'var(--font-fraunces)' }}
              >
                Tu camper o autocaravana tiene un precio justo. Descúbrelo en 60 segundos.
              </h2>
              <p
                className="max-w-[46ch] text-base leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                Empieza con una tasación gratuita. Te respondemos en 24h.
              </p>
              <Link
                href="/vender/empezar"
                className="inline-flex items-center justify-center rounded-full px-8 py-4 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--cn-terra-500)' }}
              >
                Calcular el precio de mi vehículo
              </Link>
              <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                O escríbenos a{' '}
                <a
                  href="mailto:info@campersnova.com"
                  className="underline underline-offset-2 transition-opacity hover:opacity-80"
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                >
                  info@campersnova.com
                </a>
              </p>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
      <WhatsAppFab />
    </>
  )
}
