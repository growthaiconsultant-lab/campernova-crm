import type { Metadata } from 'next'
import { PublicVehicleGallery } from '@/components/catalog/public-vehicle-gallery'
import Link from 'next/link'
import { formatEur } from '@/lib/format/currency'
import { notFound } from 'next/navigation'
import { Eye, Handshake, Sparkles, Check, MapPin, Phone } from 'lucide-react'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'
import { JsonLd } from '@/components/json-ld'
import { SITE_URL } from '@/lib/seo'
import {
  getPublishedVehicleBySlug,
  equipmentLabels,
  categoryForType,
  type PublicVehicle,
  type PublicVehicleDetail,
} from '@/lib/public-catalog'

// ISR on-demand: la ficha se renderiza en la primera petición y se cachea 10 min.
// No usamos generateStaticParams para no depender de la DB en el build (resiliencia).
export const revalidate = 600
export const dynamicParams = true

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtKm(n: number | null) {
  if (n == null) return 'Km sin especificar'
  return new Intl.NumberFormat('es-ES').format(n) + ' km'
}

/** Título + año, omitiendo el año si aún no se ha capturado (CAP-1). */
function titleYear(v: PublicVehicle): string {
  return v.year != null ? `${v.title} ${v.year}` : v.title
}

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await getPublishedVehicleBySlug(params.id)
  if (!v) return {}
  const canonical = `/comprar/${v.slug}`
  const desc =
    v.description ??
    `${titleYear(v)} · ${fmtKm(v.km)} · ${v.typeLabel} seminueva con garantía en CampersNova.`
  return {
    title: titleYear(v),
    description: desc,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: `${SITE_URL}${canonical}`,
      title: titleYear(v),
      description: desc,
      images: v.photos[0] ? [{ url: v.photos[0].url, alt: v.photos[0].alt }] : undefined,
    },
  }
}

function vehicleJsonLd(v: PublicVehicleDetail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: titleYear(v),
    description: v.description ?? undefined,
    ...(v.year != null && { vehicleModelDate: String(v.year) }),
    ...(v.seats != null && { vehicleSeatingCapacity: v.seats }),
    bodyType: v.typeLabel,
    ...(v.brand ? { brand: { '@type': 'Brand', name: v.brand } } : {}),
    ...(v.model ? { model: v.model } : {}),
    image: v.photos.map((p) => p.url),
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: v.km, unitCode: 'KMT' },
    ...(v.price != null && {
      offers: {
        '@type': 'Offer',
        price: v.price,
        priceCurrency: 'EUR',
        availability:
          v.availability === 'Disponible'
            ? 'https://schema.org/InStock'
            : v.availability === 'Vendido'
              ? 'https://schema.org/SoldOut'
              : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/UsedCondition',
        url: `${SITE_URL}/comprar/${v.slug}`,
        seller: { '@type': 'AutoDealer', name: 'CampersNova' },
      },
    }),
  }
}

export default async function VehicleDetailPage({ params }: Props) {
  const v = await getPublishedVehicleBySlug(params.id)
  if (!v) notFound()

  const equipment = equipmentLabels(v.equipment)
  const specs = [
    { lab: 'Año', val: v.year != null ? String(v.year) : 'Sin especificar' },
    { lab: 'Kilómetros', val: fmtKm(v.km) },
    { lab: 'Plazas', val: v.seats != null ? String(v.seats) : 'Sin especificar' },
    ...(v.length ? [{ lab: 'Longitud', val: `${v.length} m` }] : []),
    { lab: 'Tipo', val: v.typeLabel },
    ...(v.location ? [{ lab: 'Ubicación', val: v.location }] : []),
  ]

  return (
    <>
      <JsonLd data={vehicleJsonLd(v)} />
      <PublicNav />

      <main className="min-h-screen" style={{ background: 'var(--cn-cream-100)' }}>
        <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-8 max-[640px]:px-5">
          {/* Breadcrumb */}
          <nav
            className="mb-6 flex flex-wrap items-center gap-2 font-mono text-[13px] tracking-[0.06em]"
            style={{ color: 'var(--cn-ink-500)' }}
            aria-label="Migas de pan"
          >
            <Link href="/" className="hover:underline">
              Inicio
            </Link>
            <span aria-hidden>/</span>
            <Link href="/comprar/vehiculos" className="hover:underline">
              Catálogo
            </Link>
            {(() => {
              const cat = categoryForType(v.type)
              return cat ? (
                <>
                  <span aria-hidden>/</span>
                  <Link href={`/comprar/${cat.slug}`} className="hover:underline">
                    {cat.labelPlural}
                  </Link>
                </>
              ) : null
            })()}
            <span aria-hidden>/</span>
            <span style={{ color: 'var(--cn-teal-900)' }}>{titleYear(v)}</span>
          </nav>

          <PublicVehicleGallery photos={v.photos} />

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
              {v.location && (
                <div className="mb-3.5 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 text-[12px]"
                    style={{ color: 'var(--cn-ink-500)' }}
                  >
                    <MapPin size={12} />
                    {v.location}
                  </span>
                </div>
              )}

              <p className="mb-2 inline-block rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-900">
                {v.availability}
              </p>
              <h1
                className="cn-interior-title text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
              >
                {titleYear(v)}
              </h1>
              {v.description && (
                <p
                  className="mt-5 whitespace-pre-line text-[18px] leading-relaxed"
                  style={{ color: 'var(--cn-ink-700)', maxWidth: '60ch' }}
                >
                  {v.description}
                </p>
              )}

              {/* Spec grid */}
              <div className="mt-12">
                <h2
                  className="text-[24px] tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
                >
                  Ficha técnica
                </h2>
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
              {equipment.length > 0 && (
                <div className="mt-14">
                  <h2
                    className="text-[24px] tracking-[-0.02em]"
                    style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
                  >
                    Equipamiento
                  </h2>
                  <ul
                    className="mt-6 grid grid-cols-2 gap-x-6 gap-y-0"
                    style={{ listStyle: 'none', padding: 0 }}
                  >
                    {equipment.map((item) => (
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
              )}

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
                <h2
                  className="mt-3 text-[22px] tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
                >
                  Comprar con tranquilidad
                </h2>
                <ul className="mt-4 space-y-3" style={{ listStyle: 'none', padding: 0 }}>
                  {[
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
                {v.price != null ? eur(v.price) : 'Precio a consultar'}
              </p>
              {v.monthlyPaymentFrom != null && (
                <p className="mt-2 text-base font-semibold">
                  Desde {formatEur(v.monthlyPaymentFrom, 'cents')}/mes
                </p>
              )}
              {v.price != null && (
                <p
                  className="mt-1.5 font-mono text-[12px] uppercase tracking-[0.06em]"
                  style={{ color: 'var(--cn-ink-500)' }}
                >
                  Precio total · IVA incluido
                </p>
              )}

              <div className="mt-6 flex flex-col gap-2.5">
                <Link
                  href={v.availability === 'Disponible' ? '/comprar' : '/comprar/vehiculos'}
                  className="w-full rounded-cn-sm py-3 text-center text-[14px] font-semibold text-white transition hover:opacity-90"
                  style={{ background: 'var(--cn-teal-900)' }}
                >
                  {v.availability === 'Disponible'
                    ? 'Solicitar información'
                    : 'Ver vehículos disponibles'}
                </Link>
                {v.availability === 'Disponible' && (
                  <a
                    href="tel:+34645639185"
                    className="mx-auto mt-2 flex items-center gap-2 text-[13px] hover:underline"
                    style={{ color: 'var(--cn-teal-700)' }}
                  >
                    <Phone size={14} />
                    645 63 91 85
                  </a>
                )}
              </div>

              {/* Trust icons */}
              <div
                className="mt-7 flex flex-col gap-3 border-t pt-5"
                style={{ borderColor: 'var(--cn-line)' }}
              >
                {[
                  ...(v.availability === 'Disponible'
                    ? [{ Icon: Eye, text: 'Visita presencial sin compromiso' }]
                    : []),
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
                  className="relative z-10 grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px]"
                  style={{
                    background: 'rgba(181,158,125,0.15)',
                    border: '1px solid rgba(181,158,125,0.35)',
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
