import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Shield, Eye, Handshake, Sparkles, Check, MapPin, Phone } from 'lucide-react'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'
import { DUMMY_VEHICLES } from '@/lib/dummy/vehicles'

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtKm(n: number) {
  return new Intl.NumberFormat('es-ES').format(n) + ' km'
}

const EQUIPMENT = [
  'Techo elevable',
  'Cocina con dos fuegos',
  'Nevera de compresor',
  'Cama trasera fija',
  'Baño con ducha',
  'Calefacción estacionaria',
  'Agua: 100L limpia / 90L gris',
  'Panel solar 150W',
  'Toldo lateral',
  'Cargador USB y 220V',
  'Mosquiteras',
  'Asientos giratorios',
]

const TAG_CLASSES: Record<string, string> = {
  'Nueva entrada': 'bg-cn-terra-500 text-white border-transparent',
  Premium: 'bg-cn-teal-900 text-white border-transparent',
  'Casi nueva': 'bg-cn-teal-900 text-white border-transparent',
}
const DEFAULT_TAG = 'bg-cn-cream-50 text-cn-teal-700 border-cn-line'

interface Props {
  params: { id: string }
}

export function generateStaticParams() {
  return DUMMY_VEHICLES.map((v) => ({ id: v.id }))
}

export function generateMetadata({ params }: Props): Metadata {
  const v = DUMMY_VEHICLES.find((v) => v.id === params.id)
  if (!v) return {}
  return {
    title: `${v.title} · CampersNova`,
    description: v.highlight,
  }
}

export default function VehicleDetailPage({ params }: Props) {
  const v = DUMMY_VEHICLES.find((v) => v.id === params.id)
  if (!v) notFound()

  const specs = [
    { lab: 'Año', val: String(v.year) },
    { lab: 'Kilómetros', val: fmtKm(v.km) },
    { lab: 'Combustible', val: v.fuel },
    { lab: 'Cambio', val: v.transmission },
    { lab: 'Plazas viaje', val: String(v.seats) },
    { lab: 'Plazas dormir', val: String(v.sleeps) },
    { lab: 'Tipo', val: v.type },
    { lab: 'Ubicación', val: v.location },
  ]

  return (
    <>
      <PublicNav />

      <main className="min-h-screen pt-20" style={{ background: 'var(--cn-cream-100)' }}>
        <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-8 max-[640px]:px-5">
          {/* Breadcrumb */}
          <nav
            className="mb-6 flex items-center gap-2 font-mono text-[13px] tracking-[0.06em]"
            style={{ color: 'var(--cn-ink-500)' }}
          >
            <Link href="/" className="hover:underline">
              Inicio
            </Link>
            <span>/</span>
            <Link href="/comprar" className="hover:underline">
              Comprar
            </Link>
            <span>/</span>
            <span style={{ color: 'var(--cn-teal-900)' }}>{v.title}</span>
          </nav>

          {/* Gallery */}
          <div
            className="mb-10 overflow-hidden rounded-cn-lg"
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: 8,
              aspectRatio: '16/9',
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{ background: 'var(--cn-cream-200)' }}
            >
              <span
                className="font-mono text-xs tracking-widest"
                style={{ color: 'var(--cn-ink-500)' }}
              >
                {v.placeholder}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 8 }}>
              <div
                className="flex items-center justify-center"
                style={{ background: 'var(--cn-cream-200)' }}
              >
                <span
                  className="font-mono text-xs tracking-widest"
                  style={{ color: 'var(--cn-ink-500)' }}
                >
                  Interior
                </span>
              </div>
              <div
                className="flex items-center justify-center"
                style={{ background: 'var(--cn-cream-200)' }}
              >
                <span
                  className="rounded-full px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-white"
                  style={{ background: 'rgba(38,77,73,0.85)' }}
                >
                  + 12 fotos
                </span>
              </div>
            </div>
          </div>

          {/* Detail layout */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 380px',
              gap: 56,
              alignItems: 'flex-start',
            }}
            className="max-[1000px]:block"
          >
            {/* LEFT */}
            <div>
              {/* Tags + location */}
              <div className="mb-3.5 flex flex-wrap items-center gap-2">
                {v.tags.map((t) => (
                  <span
                    key={t}
                    className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[12px] font-medium ${TAG_CLASSES[t] ?? DEFAULT_TAG}`}
                  >
                    {t}
                  </span>
                ))}
                <span
                  className="inline-flex items-center gap-1 text-[12px]"
                  style={{ color: 'var(--cn-ink-500)' }}
                >
                  <MapPin size={12} />
                  {v.location}
                </span>
              </div>

              <h1
                className="text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
              >
                {v.title}
              </h1>
              <p
                className="mt-5 text-[18px] leading-relaxed"
                style={{ color: 'var(--cn-ink-700)', maxWidth: '60ch' }}
              >
                {v.highlight}
              </p>

              {/* Spec grid */}
              <div className="mt-12">
                <h3
                  className="text-[24px] tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
                >
                  Ficha técnica
                </h3>
                <div className="mt-6 grid grid-cols-2 gap-x-1">
                  {specs.map(({ lab, val }, i) => (
                    <div
                      key={lab}
                      className="flex gap-3 py-3.5"
                      style={{ borderTop: i >= 2 ? `1px solid var(--cn-line)` : 'none' }}
                    >
                      <div>
                        <div
                          className="font-mono text-[11px] uppercase tracking-[0.06em]"
                          style={{ color: 'var(--cn-ink-500)' }}
                        >
                          {lab}
                        </div>
                        <div
                          className="mt-0.5 text-[14px] font-medium"
                          style={{ color: 'var(--cn-ink-900)' }}
                        >
                          {val}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equipment */}
              <div className="mt-14">
                <h3
                  className="text-[24px] tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
                >
                  Equipamiento
                </h3>
                <ul
                  className="mt-6 grid grid-cols-2 gap-x-6 gap-y-0"
                  style={{ listStyle: 'none', padding: 0 }}
                >
                  {EQUIPMENT.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2.5 border-b py-2.5 text-[14px]"
                      style={{ color: 'var(--cn-ink-700)', borderColor: 'var(--cn-line)' }}
                    >
                      <Check size={16} style={{ color: 'var(--cn-teal-700)', flexShrink: 0 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Warranty block */}
              <div
                className="mt-14 rounded-cn-lg p-7"
                style={{ background: 'var(--cn-cream-50)', border: '1px solid var(--cn-line)' }}
              >
                <p
                  className="font-mono text-[11px] uppercase tracking-[0.14em]"
                  style={{ color: 'var(--cn-teal-700)' }}
                >
                  · Garantía Campers Nova
                </p>
                <h3
                  className="mt-3 text-[22px] tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
                >
                  Comprar con tranquilidad
                </h3>
                <ul className="mt-4 space-y-3" style={{ listStyle: 'none', padding: 0 }}>
                  {[
                    'Vehículo revisado por mecánico independiente',
                    'Documentación completa y kilometraje verificado',
                    'Asesoramiento durante y después de la compra',
                    'Gestión de transferencia incluida',
                  ].map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-3 text-[14px]"
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

            {/* RIGHT — sticky sidebar */}
            <aside
              className="rounded-cn-lg p-7 max-[1000px]:mt-12"
              style={{
                background: '#fff',
                border: '1px solid var(--cn-line)',
                position: 'sticky',
                top: '96px',
              }}
            >
              <p
                className="text-[38px] leading-none"
                style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
              >
                {eur(v.price)}
              </p>
              <p
                className="mt-1.5 font-mono text-[12px] uppercase tracking-[0.06em]"
                style={{ color: 'var(--cn-ink-500)' }}
              >
                Precio total · IVA incluido
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  className="w-full rounded-cn-sm py-3 text-[14px] font-semibold text-white transition hover:opacity-90"
                  style={{ background: 'var(--cn-teal-900)' }}
                >
                  Solicitar información
                </button>
                <button
                  className="w-full rounded-cn-sm border py-3 text-[14px] font-medium transition hover:bg-cn-cream-50"
                  style={{ borderColor: 'var(--cn-line)', color: 'var(--cn-teal-900)' }}
                >
                  Agendar visita
                </button>
                <a
                  href="tel:+34645639185"
                  className="mx-auto mt-2 flex items-center gap-2 text-[13px] hover:underline"
                  style={{ color: 'var(--cn-teal-700)' }}
                >
                  <Phone size={14} />
                  645 63 91 85
                </a>
              </div>

              {/* Trust icons */}
              <div
                className="mt-7 flex flex-col gap-3 border-t pt-5"
                style={{ borderColor: 'var(--cn-line)' }}
              >
                {[
                  { Icon: Shield, text: 'Vehículo revisado y documentado' },
                  { Icon: Eye, text: 'Visita presencial sin compromiso' },
                  { Icon: Handshake, text: 'Trámites de transferencia incluidos' },
                ].map(({ Icon, text }) => (
                  <div
                    key={text}
                    className="flex items-center gap-3 text-[13px]"
                    style={{ color: 'var(--cn-ink-700)' }}
                  >
                    <Icon size={18} style={{ color: 'var(--cn-teal-700)', flexShrink: 0 }} />
                    {text}
                  </div>
                ))}
              </div>

              {/* Nova Assistant badge */}
              <div
                className="relative mt-5 flex items-start gap-3.5 overflow-hidden rounded-cn-md p-4"
                style={{ background: 'var(--cn-teal-900)' }}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(ellipse 60% 80% at 100% 0%, rgba(194,106,74,0.25), transparent 70%)',
                  }}
                />
                <div
                  className="relative z-10 grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px]"
                  style={{
                    background: 'rgba(194,106,74,0.18)',
                    border: '1px solid rgba(194,106,74,0.4)',
                    color: '#f5d4c2',
                  }}
                >
                  <Sparkles size={18} />
                </div>
                <div className="relative z-10">
                  <strong
                    className="block text-[16px] font-medium leading-tight text-white"
                    style={{ fontFamily: 'var(--font-fraunces)' }}
                  >
                    Nova Assistant incluido
                  </strong>
                  <span
                    className="mt-0.5 block text-[12px] leading-snug"
                    style={{ color: 'rgba(255,255,255,0.72)' }}
                  >
                    QR único en tu camper o autocaravana. Pregúntale a tu vehículo lo que necesites,
                    24/7.
                  </span>
                  <span
                    className="mt-1.5 inline-block font-mono text-[9px] uppercase tracking-[0.14em]"
                    style={{ color: '#f5d4c2' }}
                  >
                    · Gratis · Para siempre
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <PublicFooter />
    </>
  )
}
